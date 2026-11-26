import { describe, expect, it } from "vitest";
import { planFor } from "@/lib/challenge-plan";

describe("planFor", () => {
  it("explains a late join on day 5 of 40", () => {
    expect(planFor("2026-11-01", "2026-12-10", "2026-11-05", 3)).toEqual({
      total: 40, day: 5, left: 36, need: 30, reachable: true, goodHabits: 2,
    });
  });

  it("flags a trophy that is out of reach", () => {
    const plan = planFor("2026-11-01", "2026-12-10", "2026-11-20", 3);
    expect(plan.left).toBe(21);
    expect(plan.reachable).toBe(false);
  });

  it("clamps joins before the start to day 1", () => {
    expect(planFor("2026-12-01", "2026-12-07", "2026-11-20").day).toBe(1);
  });

  it("rounds the trophy target up", () => {
    expect(planFor("2026-11-01", "2026-11-07", "2026-11-01").need).toBe(6);
  });
});
