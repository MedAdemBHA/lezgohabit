import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isPrivateChallenge } from "@/lib/challenge-history";

const src = (f: string) => readFileSync(`src/routes/_authenticated/${f}.tsx`, "utf8");

describe("private personal challenges have no social controls", () => {
  it("only personal entries are private", () => {
    expect(isPrivateChallenge({ kind: "personal" })).toBe(true);
    expect(isPrivateChallenge({ kind: "official" })).toBe(false);
    expect(isPrivateChallenge({ kind: "creator" })).toBe(false);
    expect(isPrivateChallenge(null)).toBe(false);
  });
  it("Today's crew strip, the feed and Small Wins posting check the entry kind", () => {
    expect(src("today")).toMatch(/!isPrivateChallenge\(entryKind\.data\) && \(\s*<TodayCrewStrip/);
    expect(src("community")).toMatch(/if \(isPrivateChallenge\(entry\.data\)\)/);
    expect(src("small-wins")).toMatch(/!isPrivateChallenge\(entry\.data\) && \(\s*<StickerButton/);
  });
});
