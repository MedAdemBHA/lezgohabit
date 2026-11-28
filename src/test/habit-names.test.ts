import { describe, expect, it } from "vitest";
import { habitName } from "@/components/lezgo/today/habit-tile";
import type { UserHabit } from "@/lib/data";

const t = (key: string) => `t:${key}`;
function habit(key: string, name: Record<string, string>, extra: Partial<UserHabit> = {}) {
  return {
    custom_name: null,
    kind: "count",
    target: 7,
    template: { key, name, default_target: 7 },
    ...extra,
  } as unknown as UserHabit;
}

describe("one name per habit", () => {
  it("Today uses the template name, not a short label", () => {
    expect(habitName(habit("train", { fr: "Entraînement" }, { kind: "check" }), t, "fr")).toBe(
      "Entraînement",
    );
    expect(habitName(habit("sleep7", { fr: "Dormir 7 heures" }), t, "fr")).toBe("Dormir 7 heures");
  });
  it("a player's own name wins", () => {
    expect(habitName(habit("custom", { en: "x" }, { custom_name: "Call mum" }), t, "en")).toBe(
      "Call mum",
    );
  });
  it("a changed target shows in the name", () => {
    expect(
      habitName(
        habit("read", { en: "Read 10 pages" }, {
          target: 20,
          template: { key: "read", name: { en: "Read 10 pages" }, default_target: 10 },
        } as unknown as Partial<UserHabit>),
        t,
        "en",
      ),
    ).toBe("Read 20 pages");
  });
});
