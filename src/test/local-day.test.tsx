import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useLocalDay } from "@/lib/data";

afterEach(() => vi.useRealTimers());

describe("today stays current without a refresh", () => {
  it("moves to the new day when the app comes back after midnight", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-28T22:50:00Z")); // 23:50 in Tunis
    const { result } = renderHook(() => useLocalDay("Africa/Tunis"));
    expect(result.current).toBe("2026-11-28");
    vi.setSystemTime(new Date("2026-11-29T06:00:00Z"));
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(result.current).toBe("2026-11-29");
  });
});
