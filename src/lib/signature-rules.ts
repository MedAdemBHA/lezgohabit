export const MOODS = ["strong", "proud", "okay", "tired", "low"] as const;
export const CAPSULE_MAX = 1000;
export const TOMORROW_MAX = 120;
export const RECORDING_SECONDS = 30;
export function snakeDays(length: number) {
  return Array.from({ length: Math.ceil(length / 8) }, (_, row) => {
    const days = Array.from(
      { length: Math.min(8, length - row * 8) },
      (_, col) => row * 8 + col + 1,
    );
    return row % 2 ? days.reverse() : days;
  });
}
/** Trail rows of seven days in reading order (week 1, week 2, …). */
export function weekRows(length: number) {
  return Array.from({ length: Math.ceil(length / 7) }, (_, row) =>
    Array.from({ length: Math.min(7, length - row * 7) }, (_, col) => row * 7 + col + 1),
  );
}

/** Display-only trail summary from saved daily scores (scores themselves come from the server). */
export function trailStats(
  scores: { day: string; completion: number | string; perfect: boolean; streak: number }[],
  today: string,
) {
  const played = scores.filter((s) => s.day <= today);
  const latest = [...played].sort((a, b) => b.day.localeCompare(a.day))[0];
  return {
    good: played.filter((s) => Number(s.completion) >= 0.6).length,
    perfect: played.filter((s) => s.perfect).length,
    streak: latest?.streak ?? 0,
  };
}

export function tileState(
  day: string,
  today: string,
  score?: { perfect: boolean; completion: number; shield_used: boolean },
) {
  if (day === today) return "today";
  if (day > today) return "future";
  if (score?.shield_used) return "shield";
  if (score?.perfect) return "perfect";
  return score && score.completion > 0 ? "partial" : "missed";
}
