import { beforeEach, describe, expect, it } from "vitest";
import {
  AFTER_SIGN_IN,
  LEGACY_WRAPPED_SIGN_IN,
  authReturnError,
  nextFromSearch,
  safeNext,
  takeStoredNext,
} from "@/lib/safe-next";

describe("safeNext", () => {
  it("keeps same-origin app paths with search and hash", () => {
    expect(safeNext("/crew-details?crew=abc#chat")).toBe("/crew-details?crew=abc#chat");
    expect(safeNext("/wrapped?season=x")).toBe("/wrapped?season=x");
  });

  it.each([
    undefined,
    42,
    "",
    "/",
    "https://evil.example/today",
    "//evil.example/today",
    "/\\evil.example",
    "javascript:alert(1)",
    "today",
    "/auth",
    "/auth?next=/today",
    "/api/push",
    "/og/challenge/ABC123",
    `/${"a".repeat(600)}`,
  ])("rejects %s", (value) => {
    expect(safeNext(value)).toBeUndefined();
  });

  it("does not block paths that merely share a prefix", () => {
    expect(safeNext("/authors")).toBe("/authors");
  });
});

describe("nextFromSearch", () => {
  it("upgrades the legacy Wrapped link shape", () => {
    expect(nextFromSearch({ next: "/wrapped", season: "abc" })).toBe("/wrapped?season=abc");
    expect(nextFromSearch({ next: "/wrapped" })).toBe("/wrapped");
    expect(nextFromSearch({ next: "//evil.example" })).toBeUndefined();
  });
});

describe("takeStoredNext", () => {
  beforeEach(() => sessionStorage.clear());

  it("returns and clears the stored destination", () => {
    sessionStorage.setItem(AFTER_SIGN_IN, "/profile");
    expect(takeStoredNext()).toBe("/profile");
    expect(takeStoredNext()).toBeUndefined();
  });

  it("drops an unsafe stored destination", () => {
    sessionStorage.setItem(AFTER_SIGN_IN, "https://evil.example");
    expect(takeStoredNext()).toBeUndefined();
  });

  it("honours the legacy Wrapped key once", () => {
    sessionStorage.setItem(LEGACY_WRAPPED_SIGN_IN, "season-1");
    expect(takeStoredNext()).toBe("/wrapped?season=season-1");
    sessionStorage.setItem(LEGACY_WRAPPED_SIGN_IN, "");
    expect(takeStoredNext()).toBe("/wrapped");
    expect(takeStoredNext()).toBeUndefined();
  });
});

describe("authReturnError", () => {
  it("is null on a normal return", () => {
    expect(authReturnError("?code=abc", "")).toBeNull();
  });

  it("detects a cancelled Google consent", () => {
    expect(authReturnError("?error=access_denied&error_description=User+denied", "")).toBe(
      "cancelled",
    );
  });

  it("detects an expired or reused magic link in the hash", () => {
    expect(
      authReturnError(
        "",
        "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired",
      ),
    ).toBe("expired");
  });

  it("falls back to a generic failure", () => {
    expect(authReturnError("?error=server_error", "")).toBe("failed");
  });
});
