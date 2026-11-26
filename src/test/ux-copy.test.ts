import { describe, expect, it } from "vitest";
import i18n from "@/lib/i18n";

describe("ux copy", () => {
  it("pluralises crew members", () => {
    const en = i18n.getFixedT("en");
    expect(en("ux.members", { count: 1 })).toBe("1 member");
    expect(en("ux.members", { count: 4 })).toBe("4 members");
    const ar = i18n.getFixedT("ar");
    expect(ar("ux.members", { count: 2 })).toBe("عضوان");
    expect(ar("ux.members", { count: 3 })).toBe("3 أعضاء");
  });
});

describe("formatNumber", () => {
  it("formats per locale, with ar-TN digits for Tunisian Arabic", async () => {
    const { formatNumber } = await import("@/lib/i18n");
    expect(formatNumber(1234, "en")).toBe("1,234");
    expect(formatNumber(1234, "aeb")).toBe(new Intl.NumberFormat("ar-TN").format(1234));
    expect(formatNumber(Number.NaN, "fr")).toBe("0");
  });
});

describe("unitLabel", () => {
  it("translates known units and keeps unknown ones", async () => {
    const { unitLabel } = await import("@/lib/habits");
    expect(unitLabel(i18n.getFixedT("aeb"), "pages")).toBe("صفحات");
    expect(unitLabel(i18n.getFixedT("fr"), "steps")).toBe("pas");
    expect(unitLabel(i18n.getFixedT("en"), "laps")).toBe("laps");
    expect(unitLabel(i18n.getFixedT("en"), null)).toBe("");
  });
});
