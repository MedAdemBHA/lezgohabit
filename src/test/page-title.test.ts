import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dir = "src/routes/_authenticated";
const routes = readdirSync(dir)
  .filter((f) => f.endsWith(".tsx"))
  .map((f) => [f, readFileSync(join(dir, f), "utf8")] as const);

describe("one page title style", () => {
  it("no signed-in screen uses the retired title classes", () => {
    for (const [file, src] of routes)
      expect(src, file).not.toMatch(
        /settings-title|batch5-title|batch6-heading|text-\[30px\] font-extrabold/,
      );
  });
  it("screen titles are sentence case in every language", async () => {
    const { batch5 } = await import("@/lib/i18n/batch5").then((m) => ({
      batch5: m as Record<string, unknown>,
    }));
    const text = JSON.stringify(batch5) + JSON.stringify(await import("@/lib/i18n/batch6"));
    for (const caps of [
      "LIFT LOG",
      "SAISONS",
      "SEASONS",
      "SCROLL DETOX",
      "BOSS FIGHT",
      "CRÉER UN DÉFI",
    ])
      expect(text).not.toContain(`"${caps}"`);
  });
  it("language pickers show names, not flags", () => {
    const pickers = [
      readFileSync("src/components/lezgo/design-language.tsx", "utf8"),
      readFileSync(join(dir, "settings.tsx"), "utf8"),
    ];
    for (const src of pickers) expect(src).not.toContain("LangFlag");
  });
});
