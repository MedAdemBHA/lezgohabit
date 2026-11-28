import { describe, expect, it } from "vitest";
import { hiddenUrl, isFeatureOn } from "@/lib/features";

const off = { bosses: false, buddies: false, lift: false, daily_dare: false };

describe("feature flags", () => {
  it("a missing flag means on; false means off", () => {
    expect(isFeatureOn({}, "bosses")).toBe(true);
    expect(isFeatureOn(undefined, "lift")).toBe(true);
    expect(isFeatureOn(off, "lift")).toBe(false);
    expect(isFeatureOn({ lift: true }, "lift")).toBe(true);
  });
  it("hides inbox links into switched-off routes only", () => {
    expect(hiddenUrl("/boss", off)).toBe(true);
    expect(hiddenUrl("https://lezgo.app/buddies?x=1", off)).toBe(true);
    expect(hiddenUrl("/lift", off)).toBe(true);
    expect(hiddenUrl("/today", off)).toBe(false);
    expect(hiddenUrl("/bossy", off)).toBe(false);
    expect(hiddenUrl("/boss", {})).toBe(false);
    expect(hiddenUrl(null, off)).toBe(false);
  });
});
