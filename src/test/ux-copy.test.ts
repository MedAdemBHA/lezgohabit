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
