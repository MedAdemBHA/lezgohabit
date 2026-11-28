import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { DAILY_MAX, scoringVersion } from "@/lib/scoring-version";

const sql = readFileSync("drizzle/migrations/0083_scoring_v2.sql", "utf8");

/** Same arithmetic as scoring_preview_v2 / recompute_day v2 (fixture check, not a client scorer). */
function v2(picked: number, done: number, streak: number, proof: boolean, crew: boolean) {
  const habits = (100 * done) / picked;
  const stacks = (done === picked ? 20 : 0) + (proof ? 10 : 0) + (crew ? 10 : 0);
  return Math.floor((habits + stacks) * Math.min(1 + 0.05 * streak, 1.1));
}

describe("scoring v2", () => {
  it("only seasons marked v2 use the new rule", () => {
    expect(scoringVersion({ scoring_version: 2 })).toBe(2);
    expect(scoringVersion({ scoring_version: 1 })).toBe(1);
    expect(scoringVersion({})).toBe(1);
    expect(scoringVersion(null)).toBe(1);
  });
  it("fixture days", () => {
    expect(v2(3, 2, 0, false, false)).toBe(66);
    expect(v2(3, 3, 1, true, false)).toBe(136);
    expect(v2(3, 3, 12, true, true)).toBe(154);
    expect(v2(5, 4, 40, true, true)).toBe(110);
  });
  it("the advertised daily max matches the server's", () => {
    expect(DAILY_MAX[2]).toBe(v2(3, 3, 90, true, true));
    expect(sql).toContain("floor((100 + 20 + 10 + 10) * 1.10)");
  });
  it("v1 seasons keep their bonuses and x1.5 cap; nothing is recalculated", () => {
    expect(sql).toContain("IF s.scoring_version<2 THEN IF coalesce(ex.chaos_done,false)");
    expect(sql).toContain("CASE WHEN s.scoring_version>=2 THEN 1.10 ELSE 1.5 END");
    expect(sql).not.toMatch(/(PERFORM|SELECT)\s+public\.(_recompute_with_crew|recompute_day)\(/i);
  });
});
