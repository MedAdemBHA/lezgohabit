import type { Checkin, UserHabit } from "./data";

export const PRAYERS = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;
export type PrayerState = "on_time" | "late" | "missed";

/** Mirrors the server's _habit_completion for instant UI feedback; the server stays the source of truth. */
export function completion(h: Pick<UserHabit, "kind" | "target">, c?: Pick<Checkin, "value" | "detail"> | null): number {
  if (!c) return 0;
  if (h.kind === "salat") {
    const pr = ((c.detail as { prayers?: Record<string, PrayerState> } | null)?.prayers) ?? {};
    const sum = Object.values(pr).reduce((s, v) => s + (v === "on_time" ? 1 : v === "late" ? 0.5 : 0), 0);
    return Math.min(1, sum / 5);
  }
  if (h.kind === "count") return Math.min(1, Math.max(0, Number(c.value) / Number(h.target || 1)));
  return Number(c.value) > 0 ? 1 : 0;
}

export function stepFor(unit: string | null, target: number) {
  if (unit === "steps") return 1000;
  if (unit === "L") return 0.25;
  if (unit === "min") return 5;
  if (target >= 100) return Math.round(target / 10);
  return 1;
}

export const CHAOS_KEYS = ["pushups", "mom", "nophone", "stairs", "compliment", "cold", "walk", "tidy", "fruit", "plank", "thanks", "sunrise"] as const;
export const chaosFor = (dayIndex: number) => CHAOS_KEYS[((dayIndex % CHAOS_KEYS.length) + CHAOS_KEYS.length) % CHAOS_KEYS.length]!;

export function fmtVal(v: number) {
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}
