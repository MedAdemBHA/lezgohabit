import { describe, expect, it } from "vitest";
import { isAuthExpired, isTransient, shouldRetry, createAppQueryClient } from "@/lib/query-resilience";

describe("calls recover without a manual refresh", () => {
  it("retries network failures and expired sign-ins, at most twice", () => {
    const offline = new TypeError("Failed to fetch");
    const expired = { code: "PGRST301", message: "JWT expired" };
    expect(isTransient(offline)).toBe(true);
    expect(isAuthExpired(expired)).toBe(true);
    expect(shouldRetry(0, offline)).toBe(true);
    expect(shouldRetry(1, expired)).toBe(true);
    expect(shouldRetry(2, offline)).toBe(false);
    expect(shouldRetry(0, { status: 503, message: "Service Unavailable" })).toBe(true);
  });
  it("never retries real answers from the server", () => {
    for (const message of ["forbidden", "day_final", "challenge_full", "invalid_input"])
      expect(shouldRetry(0, { code: "P0001", message })).toBe(false);
  });
  it("refreshes the session once when a call comes back with an expired token", async () => {
    let refreshed = 0;
    const qc = createAppQueryClient(async () => {
      refreshed++;
    });
    let calls = 0;
    const data = await qc.fetchQuery({
      queryKey: ["probe"],
      queryFn: async () => {
        calls++;
        if (calls === 1) throw { code: "PGRST301", message: "JWT expired" };
        return "ok";
      },
    });
    expect(data).toBe("ok");
    expect(refreshed).toBe(1);
  });
  it("comes back to fresh data when the app regains focus or the network", () => {
    const q = createAppQueryClient(async () => {}).getDefaultOptions().queries;
    expect(q?.refetchOnWindowFocus).toBe(true);
    expect(q?.refetchOnReconnect).toBe(true);
  });
});
