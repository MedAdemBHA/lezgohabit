import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { HABIT_ICONS, habitIconFor } from "@/components/lezgo/habit-icon";

/** Live habit templates (habit_templates where not archived, 2026-11-28). */
const LIVE = [
  "train",
  "steps",
  "water",
  "coffee",
  "run",
  "cold_shower",
  "wake_early",
  "sleep_before_midnight",
  "steps10k",
  "pushups",
  "plank",
  "stretch",
  "sunlight",
  "sleep7",
  "custom",
  "no_phone_first_hour",
  "screen_limit",
  "dua",
  "tasbih",
  "salat",
  "quran",
  "dhikr",
  "no_sugar",
  "no_fast_food",
  "fruit_veg",
  "protein_meals",
  "make_bed",
  "tidy_10",
  "budget_day",
  "call_friend",
  "read",
  "detox",
  "learn",
  "learn15",
  "journal",
  "no_social_noon",
  "study_blocks",
  "language_practice",
  "meditation",
  "gratitude",
  "energy_drink_free",
  "smoke_free",
];

describe("every habit has its own icon", () => {
  it("each live habit has a dedicated drawing", () => {
    for (const key of LIVE) expect(HABIT_ICONS[key], key).toBeDefined();
  });
  it("no two live habits share a drawing", () => {
    const seen = new Map<unknown, string>();
    for (const key of LIVE) {
      const icon = HABIT_ICONS[key];
      expect(seen.get(icon), `${key} reuses ${seen.get(icon)}`).toBeUndefined();
      seen.set(icon, key);
    }
  });
  it("no two drawings render the same SVG", () => {
    const markup = LIVE.map((key) => {
      const Icon = HABIT_ICONS[key]!;
      return renderToStaticMarkup(<Icon />);
    });
    expect(new Set(markup).size).toBe(LIVE.length);
    for (const svg of markup) expect(svg).toMatch(/^<svg[^>]*viewBox="0 0 48 48"/);
  });
  it("the habit key wins over the shared template icon name", () => {
    expect(habitIconFor("meditation", "thought")).toBe(HABIT_ICONS["meditation"]);
    expect(habitIconFor("gratitude", "thought")).not.toBe(habitIconFor("meditation", "thought"));
    expect(habitIconFor(null, "dumbbell")).toBe(HABIT_ICONS["train"]);
  });
});
