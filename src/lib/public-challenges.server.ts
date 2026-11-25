import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { CatalogCard } from "@/lib/challenge-catalog";

export type PublicChallengePreview = {
  id: string;
  season_id: string;
  name: string;
  days: number;
  audience: string;
  creator: string;
  starts_on: string;
  ends_on: string;
  code: string;
  members: number;
  full: boolean;
  ended: boolean;
  habits: { key: string; name: Record<string, string>; what_counts: Record<string, string>; kind: string; target: number; unit: string | null; is_faith: boolean }[];
};

function publicSupabase() {
  const runtimeUrl = process.env["SUPABASE_URL"];
  const runtimeKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
  const url = runtimeUrl && runtimeKey ? runtimeUrl : import.meta.env["VITE_SUPABASE_URL"];
  const key = runtimeUrl && runtimeKey ? runtimeKey : import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("public_supabase_unavailable");

  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_")) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

export async function getPublicChallengePreview(code: string): Promise<PublicChallengePreview | null> {
  if (!/^[A-Z0-9]{6}$/i.test(code)) return null;
  const { data, error } = await publicSupabase().rpc("challenge_preview", { _code: code.toUpperCase() });
  if (error) throw new Error("public_challenge_unavailable");
  return data as unknown as PublicChallengePreview | null;
}

export async function getPublicFeaturedChallenges(): Promise<{ code: string; starts_on: string; ends_on: string }[]> {
  const cards = await getPublicChallengeCatalog();
  return cards.flatMap((card) => card.kind === "creator" && card.code
    ? [{ code: card.code, starts_on: card.starts_on, ends_on: card.ends_on }]
    : []);
}

export async function getPublicChallengeCatalog(): Promise<CatalogCard[]> {
  const { data, error } = await publicSupabase().rpc("public_challenge_catalog");
  if (error) throw new Error("public_challenges_unavailable");
  return (data ?? []) as unknown as CatalogCard[];
}

export type CrewInvitePreview = {
  name: string;
  event: Record<string, string>;
  starts_on: string;
  ends_on: string;
  full: boolean;
  ended: boolean;
};

export async function getCrewInvitePreview(code: string): Promise<CrewInvitePreview | null> {
  const { data, error } = await publicSupabase().rpc("crew_invite_preview", { _code: code });
  if (error) throw new Error("public_challenge_unavailable");
  return data as unknown as CrewInvitePreview | null;
}
