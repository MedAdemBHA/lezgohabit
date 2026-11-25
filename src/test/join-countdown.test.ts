import { expect, it } from "vitest";
import { officialEventEndsAt, splitMs } from "@/lib/time";

it("counts down through the configured last day in Tunis", () => {
  const end = officialEventEndsAt("2027-03-09");
  expect(new Date(end).toISOString()).toBe("2027-03-09T23:00:00.000Z");
  expect(splitMs(end - Date.parse("2027-03-09T22:59:59Z"))).toEqual({ d: 0, h: 0, m: 0, s: 1 });
});
