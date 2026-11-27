import type { UserHabit, Checkin } from "./data";
export const WIN_KEYS = [
  "water",
  "stairs",
  "coffee",
  "fajr",
  "read",
  "dinner",
  "steps",
  "sleep",
  "dessert",
] as const;
export type WinKey = (typeof WIN_KEYS)[number];
export function prefilledWins(habits: UserHabit[], checkins: Checkin[]): WinKey[] {
  const wins = new Set<WinKey>();
  for (const h of habits) {
    const c = checkins.find((x) => x.user_habit_id === h.id);
    if (!c || c.value <= 0) continue;
    const key = h.template?.key;
    const prayers = (c.detail as { prayers?: Record<string, string> } | null)?.prayers;
    if (key === "water" && c.value >= 2) wins.add("water");
    if (key === "coffee") wins.add("coffee");
    if (key === "salat" && prayers?.["fajr"] === "on_time") wins.add("fajr");
    if (key === "read" && c.value >= 10) wins.add("read");
    if (key === "steps" && c.value >= 8000) wins.add("steps");
    if (key === "no_sugar") wins.add("dessert");
  }
  return [...wins];
}
export function shareableWins(wins: WinKey[], faithPublic: boolean) {
  return wins.filter((w) => w !== "fajr" || faithPublic);
}
export function exportSize(square: boolean) {
  return { width: 1080, height: square ? 1080 : 1920 };
}
/** Captions about the chosen wins come first, then general ones; no line appears twice. */
export function captionPool(
  wins: WinKey[],
  byWin: Partial<Record<WinKey, string[]>>,
  general: string[],
) {
  const specific = [...new Set(wins.flatMap((w) => byWin[w] ?? []))];
  return { specific, pool: [...specific, ...general.filter((c) => !specific.includes(c))] };
}
/** A stable per-person, per-day start so cards shared the same day don't all open on the same line. */
export function pickCaption(
  wins: WinKey[],
  byWin: Partial<Record<WinKey, string[]>>,
  general: string[],
  seed: string,
  step: number,
) {
  const { specific, pool } = captionPool(wins, byWin, general);
  if (!pool.length) return "";
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const start = h % (specific.length || pool.length);
  return pool[(start + step) % pool.length] ?? "";
}
