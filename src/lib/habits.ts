import type { TFunction } from "i18next";
import type { Checkin, UserHabit } from "./data";

export const PRAYERS = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;
export type PrayerState = "on_time" | "late" | "missed";

/** True when the server held this check-in for fair-play review (see checkin_upsert). */
export function isHeld(c?: Pick<Checkin, "detail"> | null): boolean {
  return !!(c?.detail as { held?: boolean } | null)?.held;
}

/**
 * Count habits save once the player stops tapping, so 29 taps on "+" become one write
 * instead of 29 (the server's burst rule holds entries after 40 check-ins in a minute).
 */
export const COUNT_SETTLE_MS = 700;

/** Mirrors the server's _habit_completion for instant UI feedback; the server stays the source of truth. */
export function completion(
  h: Pick<UserHabit, "kind" | "target">,
  c?: Pick<Checkin, "value" | "detail"> | null,
): number {
  if (!c) return 0;
  // A held entry waits for review: the server scores it 0 until an admin approves it.
  if (isHeld(c)) return 0;
  const detail = c.detail as { limit_met?: boolean } | null;
  if (detail?.limit_met !== undefined) return detail.limit_met ? 1 : 0;
  if (h.kind === "salat") {
    const pr = (c.detail as { prayers?: Record<string, PrayerState> } | null)?.prayers ?? {};
    const sum = Object.values(pr).reduce(
      (s, v) => s + (v === "on_time" ? 1 : v === "late" ? 0.5 : 0),
      0,
    );
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

export const CHAOS_KEYS = [
  "pushups",
  "mom",
  "nophone",
  "stairs",
  "compliment",
  "cold",
  "walk",
  "tidy",
  "fruit",
  "plank",
  "thanks",
  "sunrise",
] as const;
export const chaosFor = (dayIndex: number) =>
  CHAOS_KEYS[((dayIndex % CHAOS_KEYS.length) + CHAOS_KEYS.length) % CHAOS_KEYS.length]!;

/** A habit unit in the reader's language ("pages" → "صفحات"); unknown units are shown as stored. */
export function unitLabel(t: TFunction, unit: string | null | undefined): string {
  if (!unit) return "";
  return t(`ux.units.${unit}`, { defaultValue: unit });
}

/** Points are whole numbers on screen; the server keeps the exact values (display rounding only). */
export function fmtPts(v: number | null | undefined) {
  const n = Math.round(Number(v ?? 0));
  return String(Object.is(n, -0) ? 0 : n);
}

export const isSleepHabit = (key: string | undefined) => key === "sleep7";

export function fmtVal(v: number) {
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}
