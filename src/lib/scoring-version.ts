import { supabase } from "@/integrations/supabase/client";

/**
 * Seasons carry the scoring rule they were created with (migration 0083). v1 is the
 * original rule (Winter Arc); v2 drops the Daily Dare and Lift bonuses and caps the streak
 * multiplier at x1.10. The server computes every score; this only picks the explanation.
 */
export type ScoringVersion = 1 | 2;

export function scoringVersion(season: unknown): ScoringVersion {
  return (season as { scoring_version?: number } | null | undefined)?.scoring_version === 2 ? 2 : 1;
}

/** Highest normal day under each rule (a comeback day can double habit points). */
export const DAILY_MAX: Record<ScoringVersion, number> = { 1: 247, 2: 154 };

export type Preview = {
  habits: number;
  stacks: number;
  multiplier: number;
  total: number;
  max: number;
};

/** v2 calculator RPC (not yet in the generated types). */
export async function previewV2(args: {
  _picked: number;
  _done: number;
  _streak: number;
  _proof: boolean;
  _crew: boolean;
}) {
  const rpc = supabase.rpc as unknown as (
    fn: string,
    params: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: Error | null }>;
  const { data, error } = await rpc("scoring_preview_v2", args);
  if (error) throw error;
  return data as Preview;
}
