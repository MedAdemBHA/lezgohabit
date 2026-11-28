import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("drizzle/migrations/0086_better_official_challenges.sql", "utf8");
const plan = (slug: string) => new RegExp(`\\('${slug}',[\\s\\S]*?\\)(,|;)`).exec(sql)?.[0] ?? "";

describe("better official challenges", () => {
  it("every challenge gets a goal in all four languages", () => {
    for (const slug of [
      "winter-arc-2026",
      "new-year-reset-2027",
      "ramadan-2027",
      "summer-body-2027",
      "comeback-2027",
    ])
      for (const lang of ['"en":', '"fr":', '"ar":', '"aeb":'])
        expect(plan(slug), `${slug} ${lang}`).toContain(lang);
  });
  it("the live Winter Arc keeps its habits and dates", () => {
    expect(plan("winter-arc-2026")).toMatch(/NULL, NULL\)/);
  });
  it("upcoming challenges each get three themed habits, no two sets alike", () => {
    const sets = ["new-year-reset-2027", "ramadan-2027", "summer-body-2027", "comeback-2027"].map(
      (slug) => /ARRAY\[([^\]]*)\]/.exec(plan(slug))?.[1] ?? "",
    );
    for (const set of sets) expect(set.split(",")).toHaveLength(3);
    expect(new Set(sets).size).toBe(4);
    expect(plan("ramadan-2027")).toContain("'salat'");
  });
  it("New Year Reset is the agreed 30 days", () => {
    expect(plan("new-year-reset-2027")).toContain("DATE '2027-01-30'");
  });
  it("habits and dates change only before start and with no players (same lock as the admin editor)", () => {
    expect(sql).toContain("starts_on > (now() AT TIME ZONE 'Africa/Tunis')::date");
    expect(sql).toMatch(/NOT EXISTS \(SELECT 1 FROM public\.season_entries/);
  });
});
