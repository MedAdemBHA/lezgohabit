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
  is_pinned: boolean;
};
export type ChallengePulse = {
  participants: number;
  checked_in: number;
  crew_id: string | null;
  crew: { id: string; name: string; handle: string; avatar_url: string | null; checked_in: boolean }[];
};
export type ChallengeEvent = {
  id: string;
  type: "surrender" | "perfect_day" | "streak" | "boss" | "crew_all_in" | "challenge_complete";
  user_id: string | null;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
  day: string;
  payload: Record<string, string | number | boolean | null>;
  respects: number;
  mine: boolean;
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
  scope = "challenge",
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
  scope = "challenge",
  filter = "all",
  before: string | null = null,
) =>
  queryOptions({
    queryKey: ["feed", uid, sid, scope, filter, before],
    queryFn: () => fetchFeed(sid, scope, filter, before),
    staleTime: 15_000,
  });
export const challengePulseQuery = (uid: string, sid: string) =>
  queryOptions({
    queryKey: ["challengePulse", uid, sid],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("challenge_pulse", { _season_id: sid });
      if (error) throw error;
      return data as unknown as ChallengePulse;
    },
    refetchInterval: 30_000,
    enabled: !!uid && !!sid,
  });
export const challengeEventsQuery = (uid: string, sid: string, scope: string) =>
  queryOptions({
    queryKey: ["challengeEvents", uid, sid, scope],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("challenge_feed", { _season_id: sid, _scope: scope });
      if (error) throw error;
      return (data ?? []) as unknown as ChallengeEvent[];
    },
    enabled: !!uid && !!sid,
  });
export const REACTIONS = ["respect", "beast", "lol", "legend"] as const;
export const MAX_NOTE = 280;
export function noteLength(note: string) {
  return Array.from(note).length;
}
// Moved to proof-image.ts so Today proofs and feed posts share one metadata-stripping path.
export { compressProof } from "./proof-image";
