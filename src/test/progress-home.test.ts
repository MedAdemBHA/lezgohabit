import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resultsFinal } from "@/lib/challenge-history";

describe("progress has one home", () => {
  it("Wrapped waits until the last day is locked (03:00 the day after the end)", () => {
    expect(resultsFinal("2026-12-31", "2026-12-31", 23)).toBe(false);
    expect(resultsFinal("2026-12-31", "2027-01-01", 2)).toBe(false);
    expect(resultsFinal("2026-12-31", "2027-01-01", 3)).toBe(true);
    expect(resultsFinal("2026-12-31", "2027-01-05", 0)).toBe(true);
  });
  it("/seasons redirects to /challenges", () => {
    const src = readFileSync("src/routes/_authenticated/seasons.tsx", "utf8");
    expect(src).toMatch(/beforeLoad:\(\)=>\{throw redirect\(\{to:'\/challenges'/);
  });
  it("no screen links to /seasons any more", () => {
    for (const f of ["profile", "wrapped", "challenges", "today", "trail"]) {
      const src = readFileSync(`src/routes/_authenticated/${f}.tsx`, "utf8");
      expect(src, f).not.toMatch(/to="\/seasons"/);
    }
  });
});
