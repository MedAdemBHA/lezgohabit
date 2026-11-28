import { describe, expect, it } from "vitest";
import { rankVisibility } from "@/lib/rank-thresholds";

describe("rank badges only when meaningful", () => {
  it("a one-member crew in a tiny challenge shows no rank", () => {
    expect(rankVisibility(1, 1)).toEqual({ country: false, crew: false, challenge: false });
  });
  it("crew rank needs three ranked crews", () => {
    expect(rankVisibility(50, 2).crew).toBe(false);
    expect(rankVisibility(50, 3).crew).toBe(true);
  });
  it("country rank needs ten participants", () => {
    expect(rankVisibility(9, 5).country).toBe(false);
    expect(rankVisibility(10, 5).country).toBe(true);
  });
  it("unknown counts (loading) hide everything", () => {
    expect(rankVisibility(undefined, undefined)).toEqual({ country: false, crew: false, challenge: false });
  });
});
