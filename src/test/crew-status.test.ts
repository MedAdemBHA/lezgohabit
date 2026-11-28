import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canNudge, memberState, type MemberToday } from "@/components/lezgo/today/crew-strip";

const m = (done: number, total: number, extra: Partial<MemberToday> = {}): MemberToday => ({
  user_id: "u2",
  display_name: "Sami",
  avatar_url: null,
  done,
  total,
  nudged: false,
  ...extra,
});

describe("crew status on Today", () => {
  it("done, in progress, not started", () => {
    expect(memberState(m(3, 3))).toBe("done");
    expect(memberState(m(1, 3))).toBe("progress");
    expect(memberState(m(0, 3))).toBe("idle");
    expect(memberState(m(0, 0))).toBe("idle");
  });
  it("nudge only others who haven't finished and weren't nudged today", () => {
    expect(canNudge(m(0, 3), "u1")).toBe(true);
    expect(canNudge(m(1, 3), "u1")).toBe(true);
    expect(canNudge(m(3, 3), "u1")).toBe(false);
    expect(canNudge(m(0, 3, { nudged: true }), "u1")).toBe(false);
    expect(canNudge(m(0, 3, { user_id: "u1" }), "u1")).toBe(false);
  });
  it("sits directly under the habit list", () => {
    const src = readFileSync("src/routes/_authenticated/today.tsx", "utf8");
    const strip = src.indexOf("<TodayCrewStrip");
    expect(strip).toBeGreaterThan(src.indexOf('id="today-habits-heading"'));
    expect(strip).toBeLessThan(src.indexOf("<WelcomeCard"));
  });
});
