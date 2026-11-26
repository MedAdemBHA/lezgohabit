import { describe, it, expect } from "vitest";
import {
  snakeDays,
  CAPSULE_MAX,
  TOMORROW_MAX,
  RECORDING_SECONDS,
  tileState,
} from "@/lib/signature-rules";
describe("signature experience rules", () => {
  it("Trail lays out the selected challenge length in an eight-tile snake", () => {
    const rows = snakeDays(40);
    expect(rows[0]).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(rows[1]).toEqual([16, 15, 14, 13, 12, 11, 10, 9]);
    expect(rows.flat().length).toBe(40);
    expect(new Set(rows.flat()).size).toBe(40);
  });
  it("capsule body limit is 1000 characters", () => expect(CAPSULE_MAX).toBe(1000));
  it("tomorrow intention limit is 120 characters", () => expect(TOMORROW_MAX).toBe(120));
  it("audio stops at 30 seconds", () => expect(RECORDING_SECONDS).toBe(30));
  it("Today retains orange state even after a perfect go", () =>
    expect(
      tileState("2026-11-23", "2026-11-23", { perfect: true, completion: 1, shield_used: false }),
    ).toBe("today"));
  it("a shield leaves a saved mark on the past day", () =>
    expect(
      tileState("2026-11-22", "2026-11-23", { perfect: false, completion: 0, shield_used: true }),
    ).toBe("shield"));
});

import { trailStats, weekRows } from "@/lib/signature-rules";
describe("trail layout and summary", () => {
  it("lays days out in reading order, seven per row", () => {
    const rows = weekRows(40);
    expect(rows[0]).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(rows[1]?.[0]).toBe(8);
    expect(rows.at(-1)).toEqual([36, 37, 38, 39, 40]);
    expect(rows.flat()).toHaveLength(40);
  });
  it("counts good and perfect days up to today and takes the latest streak", () => {
    const stats = trailStats(
      [
        { day: "2026-11-01", completion: 1, perfect: true, streak: 1 },
        { day: "2026-11-02", completion: "0.6", perfect: false, streak: 2 },
        { day: "2026-11-03", completion: 0.3, perfect: false, streak: 0 },
        { day: "2026-11-09", completion: 1, perfect: true, streak: 5 },
      ],
      "2026-11-03",
    );
    expect(stats).toEqual({ good: 2, perfect: 1, streak: 0 });
  });
});
