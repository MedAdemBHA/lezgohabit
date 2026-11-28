import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import * as F from "@/components/icons/feature-icons";

describe("feature icons use the sticker set", () => {
  it("every feature drawing is unique and on the 48px sticker grid", () => {
    const svgs = Object.values(F).map((Icon) => renderToStaticMarkup(<Icon />));
    expect(new Set(svgs).size).toBe(svgs.length);
    for (const svg of svgs) expect(svg).toMatch(/viewBox="0 0 48 48"[^>]*stroke="var\(--ink\)"/);
  });
  it("feature tiles no longer use generic line icons", () => {
    const profile = readFileSync("src/routes/_authenticated/profile.tsx", "utf8");
    expect(profile).toContain("<WinsIcon");
    expect(profile).toContain("<BuddyIcon");
    expect(profile).not.toMatch(/<(Sparkles|UsersRound)\b/);
  });
});
