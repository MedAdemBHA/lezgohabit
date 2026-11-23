import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
export type Post = {
  id: string;
  user_id: string;
  type: "proof" | "thought" | "win";
  body: string;
  image_path: string | null;
  image: string | null;
  day: string;
  created_at: string;
  hidden: boolean;
  visibility: string;
  display_name: string;
  handle: string;
  avatar_url: string | null;
  habit_key: string | null;
  habit_name: Record<string, string> | null;
  category: string | null;
  stats: Record<string, string | number>;
  reactions: number;
  my_reaction: string | null;
};
export type Preferences = Database["public"]["Tables"]["user_preferences"]["Row"];
export const defaultPreferences = (uid: string): Preferences => ({
  user_id: uid,
  is_demo: false,
  active_challenge_id: null,
  distance_unit: "km",
  prayer_enabled: true,
  prayer_method: 18,
  equipment: ["bodyweight"],
  max_dumbbell: 10,
  prayer_reminder: false,
  daily_time: "21:00:00",
  boss_alerts: true,
});
export const preferencesQuery = (uid: string) =>
  queryOptions({
    queryKey: ["preferences", uid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_preferences")
        .select("*")
        .eq("user_id", uid)
        .maybeSingle();
      if (error) throw error;
      return data ?? defaultPreferences(uid);
    },
  });
export async function fetchFeed(
  sid: string,
  scope = "everyone",
  filter = "all",
  before: string | null = null,
) {
  const { data, error } = await supabase.rpc("proof_feed", {
    _season_id: sid,
    _scope: scope,
    _filter: filter,
    ...(before ? { _before: before } : {}),
  });
  if (error) throw error;
  const rows = data as unknown as Post[];
  return Promise.all(
    rows.map(async (p) => {
      if (!p.image_path) return { ...p, image: null };
      const { data: image } = await supabase.storage
        .from("proofs")
        .createSignedUrl(p.image_path, 300);
      return { ...p, image: image?.signedUrl ?? null };
    }),
  );
}
export const feedQuery = (
  uid: string,
  sid: string,
  scope = "everyone",
  filter = "all",
  before: string | null = null,
) =>
  queryOptions({
    queryKey: ["feed", uid, sid, scope, filter, before],
    queryFn: () => fetchFeed(sid, scope, filter, before),
    staleTime: 15_000,
  });
export const REACTIONS = ["respect", "beast", "lol", "legend"] as const;
export const MAX_NOTE = 280;
export function noteLength(note: string) {
  return Array.from(note).length;
}
export async function compressProof(file: File): Promise<Blob> {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 20 * 1024 * 1024
  )
    throw Error("invalid_image");
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
  canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw Error("invalid_image");
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  // Re-encoding pixels drops EXIF, GPS and all original metadata.
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(Error("invalid_image"))),
      "image/jpeg",
      0.84,
    ),
  );
}
