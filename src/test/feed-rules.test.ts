import { describe, it, expect } from "vitest";
import { noteLength, MAX_NOTE } from "@/lib/feed-data";
describe("post note length", () => {
  it("allows 280 Unicode characters, including astral emoji", () => {
    expect(MAX_NOTE).toBe(280);
    expect(noteLength("🙂".repeat(280))).toBe(280);
  });
  it("counts 281 characters as over the limit", () => {
    expect(noteLength("x".repeat(281))).toBeGreaterThan(MAX_NOTE);
  });
});
