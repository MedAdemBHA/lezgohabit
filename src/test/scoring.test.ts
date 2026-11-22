import { describe, expect, it } from "vitest";
import { completion } from "@/lib/habits";

describe("habit completion (mirrors the server rules)", () => {
  it("salat: on time = 1, late = 0.5, missed = 0, divided by 5", () => {
    const detail = { prayers: { fajr: "on_time", dhuhr: "late", asr: "missed", maghrib: "on_time", isha: "on_time" } };
    expect(completion({ kind: "salat", target: 5 }, { value: 3.5, detail })).toBe(0.7);
  });
  it("count habits: value / target capped at 1", () => {
    expect(completion({ kind: "count", target: 8000 }, { value: 4000, detail: null })).toBe(0.5);
    expect(completion({ kind: "count", target: 10 }, { value: 25, detail: null })).toBe(1);
  });
  it("check habits: done or not", () => {
    expect(completion({ kind: "check", target: 1 }, { value: 1, detail: null })).toBe(1);
    expect(completion({ kind: "check", target: 1 }, null)).toBe(0);
  });
});
