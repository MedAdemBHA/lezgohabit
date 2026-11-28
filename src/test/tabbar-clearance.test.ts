import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/styles.css", "utf8");
const px = (re: RegExp) => Number(re.exec(css)?.[1]);

describe("tab bar never covers content", () => {
  it("the shared clearance covers the bar's offset, height and shadow", () => {
    const offset = px(/\.main-tab-wrap \{[^}]*bottom:calc\((\d+)px/);
    const height = px(/\.main-tab-bar \{ height:(\d+)px/);
    const clear = /--tabbar-clear: calc\(([^;]+)\);/.exec(css)?.[1] ?? "";
    const fixed = [...clear.matchAll(/(\d+)px/g)].reduce((sum, m) => sum + Number(m[1]), 0);
    expect(clear).toContain("env(safe-area-inset-bottom");
    expect(fixed).toBeGreaterThanOrEqual(offset + height + 4 + 16);
  });
  it("every tabbed layout uses the shared clearance", () => {
    expect(css).toMatch(/\.today-content \{[^}]*padding:[^;]*var\(--tabbar-clear\)/);
    expect(css).toMatch(/\.page-content \{[^}]*padding-bottom:var\(--tabbar-clear\)/);
  });
});
