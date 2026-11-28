import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { COUNTRY_RANK_MIN_PLAYERS, PODIUM_MIN_PLAYERS } from "./challenge-plan";
import { challengePulseQuery } from "./feed-data";

/** A crew rank means something once at least this many crews are ranked in the challenge. */
export const CREW_RANK_MIN_CREWS = 3;

/** Pure rule, shared by every screen that shows a rank badge. */
export function rankVisibility(participants: number | undefined, rankedCrews: number | undefined) {
  return {
    country: (participants ?? 0) >= COUNTRY_RANK_MIN_PLAYERS,
    crew: (rankedCrews ?? 0) >= CREW_RANK_MIN_CREWS,
    challenge: (participants ?? 0) >= PODIUM_MIN_PLAYERS,
  };
}

/**
 * Which rank badges a screen may show for this challenge. Counts come from the server
 * (challenge_pulse participants, challenge_scoreboard 'crews' rows); while loading, nothing shows.
 */
export function useRankVisibility(uid: string, seasonId: string, countryCode?: string | null) {
  const pulse = useQuery({ ...challengePulseQuery(uid, seasonId), enabled: !!uid && !!seasonId });
  const crews = useQuery({
    queryKey: ["rankedCrews", seasonId],
    enabled: !!uid && !!seasonId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("challenge_scoreboard", {
        _season_id: seasonId,
        _scope: "crews",
        _country: countryCode ?? "TN",
      });
      if (error) throw error;
      return ((data as unknown as { rows?: unknown[] } | null)?.rows ?? []).length;
    },
  });
  return rankVisibility(pulse.data?.participants, crews.data);
}
