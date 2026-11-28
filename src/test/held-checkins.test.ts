import { describe, expect, it } from "vitest";
import { COUNT_SETTLE_MS, completion, isHeld } from "@/lib/habits";

// Mirrors public._habit_completion: a held check-in scores 0 until an admin approves it.
describe("held check-ins", () => {
  const sleep = { kind: "count", target: 7 };

  it("counts a held entry as not done, even above target", () => {
    expect(completion(sleep, { value: 11, detail: { held: true } })).toBe(0);
    expect(isHeld({ detail: { held: true } })).toBe(true);
  });

  it("counts the same entry as done once the hold is lifted", () => {
    expect(completion(sleep, { value: 11, detail: {} })).toBe(1);
    expect(isHeld({ detail: {} })).toBe(false);
    expect(isHeld({ detail: null })).toBe(false);
    expect(isHeld(null)).toBe(false);
  });

  it("holds a check habit too", () => {
    expect(completion({ kind: "check", target: 1 }, { value: 1, detail: { held: true } })).toBe(0);
  });

  it("waits long enough to merge a run of taps into one write", () => {
    expect(COUNT_SETTLE_MS).toBeGreaterThanOrEqual(500);
    expect(COUNT_SETTLE_MS).toBeLessThanOrEqual(1500);
  });
});
