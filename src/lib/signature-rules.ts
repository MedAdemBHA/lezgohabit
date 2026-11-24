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
