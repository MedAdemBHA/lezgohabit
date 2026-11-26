import { daysBetween } from "@/lib/time";

/** A day counts as good at 60% of habits; the trophy needs ceil(75%) of the challenge's days. */
export const GOOD_DAY_SHARE = 0.6;
export const TROPHY_SHARE = 0.75;
/** Podiums need a field; country ranks need enough players to mean something. */
export const PODIUM_MIN_PLAYERS = 3;
export const COUNTRY_RANK_MIN_PLAYERS = 10;

export type ChallengePlan = {
  total: number;
  /** 1-based day of the challenge the player joins on (1 when joining before it starts). */
  day: number;
  /** Days still playable from today, today included. */
  left: number;
  need: number;
  reachable: boolean;
};

/**
 * Explains the challenge rules to a (late) joiner. Display only: the server awards trophies
 * from saved scores, this just tells the player what is still possible.
 */
export function planFor(
  startsOn: string,
  endsOn: string,
  today: string,
  habits = 0,
): ChallengePlan & { goodHabits: number } {
  const total = Math.max(1, daysBetween(startsOn, endsOn) + 1);
  const day = Math.min(total, Math.max(1, daysBetween(startsOn, today) + 1));
  const left = Math.max(0, total - day + 1);
  const need = Math.ceil(total * TROPHY_SHARE);
  return {
    total,
    day,
    left,
    need,
    reachable: left >= need,
    goodHabits: Math.max(1, Math.ceil(habits * GOOD_DAY_SHARE)),
  };
}
