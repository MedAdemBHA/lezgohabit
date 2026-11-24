import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ChallengeHistoryEntry = {
  season_id: string;
  challenge_id: string | null;
  name: string;
  kind: "official" | "creator" | "personal";
  status: "active" | "completed" | "surrendered";
  creator: string | null;
  start_date: string;
  end_date: string;
  length: number;
  joined_at: string;
  ended_at: string | null;
  end_reason: string | null;
  completed_days: number;
  perfect_days: number;
  consistency: number;
  points: number;
  rank: number | null;
  crew: { id: string; name: string; code: string } | null;
  habits: {
    key: string;
    name: unknown;
    what_counts: unknown;
    kind: string;
    target: number;
    unit: string | null;
    is_faith: boolean;
  }[];
  trail: { day: string; completion: number; points: number; perfect: boolean; finalized: boolean }[];
  active: boolean;
  started: string;
};

export const challengeHistoryQuery = (uid: string) =>
  queryOptions({
    queryKey: ["challengeHistory", uid],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_challenge_history");
      if (error) throw error;
      return (data ?? []) as unknown as ChallengeHistoryEntry[];
    },
    enabled: !!uid,
  });
