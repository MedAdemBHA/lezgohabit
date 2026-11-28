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
  trail: {
    day: string;
    completion: number;
    points: number;
    perfect: boolean;
    finalized: boolean;
  }[];
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

/** The calendar day the player joined, in their own time zone (joined_at is a UTC timestamp). */
export function joinedDay(joinedAt: string, tz = "Africa/Tunis") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(joinedAt));
}

/** Days the player could actually play (from their join day), and the trophy target for the challenge. */
export function possibleDays(
  entry: Pick<ChallengeHistoryEntry, "start_date" | "end_date" | "joined_at" | "length">,
  tz?: string,
) {
  const joined = joinedDay(entry.joined_at, tz);
  const from = joined > entry.start_date ? joined : entry.start_date;
  const possible = Math.max(
    1,
    Math.round(
      (Date.parse(`${entry.end_date}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000,
    ) + 1,
  );
  return { possible: Math.min(possible, entry.length), trophy: Math.ceil(entry.length * 0.75) };
}

/**
 * Results are final once the challenge's last day has been locked by the server
 * (03:00 local on the day after it ends). Wrapped is only offered from then on.
 */
export function resultsFinal(endDate: string, today: string, localHourNow: number) {
  const dayAfter = new Date(`${endDate}T00:00:00Z`);
  dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);
  const lockDay = dayAfter.toISOString().slice(0, 10);
  return today > lockDay || (today === lockDay && localHourNow >= 3);
}
