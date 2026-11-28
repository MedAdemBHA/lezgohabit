import { describe, it, expect } from "vitest";
import {
  exportSize,
  shareableWins,
  prefilledWins,
  captionPool,
  pickCaption,
} from "@/lib/batch6-rules";
import { TEMPLATE_DAYS, AUDIENCE_SIZE } from "@/lib/batch6-data";
import type { UserHabit, Checkin } from "@/lib/data";
const habit = (key: string) => ({ id: key, template: { key } }) as UserHabit;
const check = (key: string, value: number) => ({ user_habit_id: key, value }) as Checkin;
describe("batch 6 concrete rules", () => {
  it("story export is exactly 1080 × 1920", () =>
    expect(exportSize(false)).toEqual({ width: 1080, height: 1920 }));
  it("square export is exactly 1080 × 1080", () =>
    expect(exportSize(true)).toEqual({ width: 1080, height: 1080 }));
  it("private Fajr wins are excluded from shares", () =>
    expect(shareableWins(["water", "fajr"], false)).toEqual(["water"]));
  it("explicit public consent permits Fajr sharing", () =>
    expect(shareableWins(["water", "fajr"], true)).toEqual(["water", "fajr"]));
  it("water needs 2 L, not 1.9 L", () => {
    expect(prefilledWins([habit("water")], [check("water", 1.9)])).toEqual([]);
    expect(prefilledWins([habit("water")], [check("water", 2)])).toEqual(["water"]);
  });
  it("reading needs 10 pages, not 9", () => {
    expect(prefilledWins([habit("read")], [check("read", 9)])).toEqual([]);
    expect(prefilledWins([habit("read")], [check("read", 10)])).toEqual(["read"]);
  });
  it("steps need 8000, not 7999", () => {
    expect(prefilledWins([habit("steps")], [check("steps", 7999)])).toEqual([]);
    expect(prefilledWins([habit("steps")], [check("steps", 8000)])).toEqual(["steps"]);
  });
  it("a logged no-sugar day prefills the dessert win", () =>
    expect(prefilledWins([habit("no_sugar")], [check("no_sugar", 1)])).toEqual(["dessert"]));
  it("captions about chosen wins come first, without duplicates", () =>
    expect(
      captionPool(["coffee", "dessert"], { coffee: ["a", "s"], dessert: ["s", "b"] }, ["g", "s"])
        .pool,
    ).toEqual(["a", "s", "b", "g"]));
  it("the first caption is about a chosen win and cycles through every line", () => {
    const by = { water: ["w1", "w2"] };
    const seen = new Set(
      [0, 1, 2, 3].map((n) => pickCaption(["water"], by, ["g1", "g2"], "me|2026-11-27", n)),
    );
    expect(["w1", "w2"]).toContain(pickCaption(["water"], by, ["g1", "g2"], "me|2026-11-27", 0));
    expect(seen.size).toBe(4);
  });
  it("no wins falls back to general captions", () =>
    expect(["g1", "g2"]).toContain(pickCaption([], {}, ["g1", "g2"], "x", 0)));
  it("templates use the requested lengths", () =>
    expect(TEMPLATE_DAYS).toEqual({
      winter_arc: 40,
      ramadan: 30,
      summer_body: 45,
      reading: 21,
      steps: 30,
      custom: 7,
    }));
  it("audiences retain the requested group bands", () =>
    expect(AUDIENCE_SIZE).toMatchObject({
      solo: "1",
      duo: "2",
      squad: "3–10",
      club: "11–100",
      company: "100+",
    }));
});

import { readFileSync } from "node:fs";
import { WIN_KEYS } from "@/lib/batch6-rules";
describe("Small Wins suggests the player's own habits", () => {
  const sleep7 = { id: "sleep7", target: 7, template: { key: "sleep7" } } as unknown as UserHabit;
  it("sport, reading and sleep become their own wins", () => {
    expect(
      prefilledWins(
        [habit("train"), habit("read"), sleep7],
        [check("train", 1), check("read", 29), check("sleep7", 11)],
      ).sort(),
    ).toEqual(["read", "rest", "train"]);
  });
  it("no generic wins are suggested for habits the player doesn't have", () => {
    const wins = prefilledWins([habit("train")], [check("train", 1)]);
    expect(wins).not.toContain("water");
    expect(wins).not.toContain("steps");
  });
  it("short sleep is not a win", () =>
    expect(prefilledWins([sleep7], [check("sleep7", 5)])).toEqual([]));
  it("the page suggests only logged wins", () => {
    const src = readFileSync("src/routes/_authenticated/small-wins.tsx", "utf8");
    expect(src).toContain("const suggestions: WinKey[] = loggedWins;");
  });
  it("every win key is accepted by the server", () => {
    const sql = readFileSync("drizzle/migrations/0084_small_wins_train_rest.sql", "utf8");
    expect(WIN_KEYS).toContain("train");
    expect(WIN_KEYS).toContain("rest");
    expect(sql).toContain('"train":');
    expect(sql).toContain('"rest":');
    expect(new Set(WIN_KEYS).size).toBe(WIN_KEYS.length);
  });
});
