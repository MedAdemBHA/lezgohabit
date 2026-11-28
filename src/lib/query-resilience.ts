import { QueryClient } from "@tanstack/react-query";

/**
 * Keeps data fresh and calls working when the phone sleeps, the network drops or the sign-in
 * token expires, so nobody has to pull-to-refresh to see their real state.
 */
type MaybeError = { message?: string; code?: string; status?: number; name?: string } | null | undefined;

/** Expired or missing sign-in token (PostgREST PGRST301 / 401). */
export function isAuthExpired(error: unknown) {
  const e = error as MaybeError;
  const text = `${e?.code ?? ""} ${e?.message ?? ""}`.toLowerCase();
  return e?.status === 401 || text.includes("pgrst301") || text.includes("jwt expired") || text.includes("invalid jwt");
}

/** The request never got an answer (offline, flaky mobile network, server hiccup). */
export function isTransient(error: unknown) {
  const e = error as MaybeError;
  const text = (e?.message ?? "").toLowerCase();
  return (
    e?.name === "TypeError" ||
    text.includes("failed to fetch") ||
    text.includes("load failed") ||
    text.includes("network") ||
    text.includes("timeout") ||
    (typeof e?.status === "number" && e.status >= 500)
  );
}

/**
 * Retry only what a retry can fix. Business errors from the server (forbidden, day_final,
 * challenge_full...) are answers, not glitches: retrying them just delays the message.
 */
export function shouldRetry(failureCount: number, error: unknown) {
  if (failureCount >= 2) return false;
  return isAuthExpired(error) || isTransient(error);
}

export const retryDelay = (attempt: number) => Math.min(800 * 2 ** attempt, 4000);

export function createAppQueryClient(onAuthExpired: () => Promise<unknown>) {
  let refreshing: Promise<unknown> | null = null;
  // Refresh the session as soon as a call fails with an expired token, before the retry fires
  // (the retry delay leaves time for the new token); one refresh at a time.
  const retry = (failureCount: number, error: unknown) => {
    if (isAuthExpired(error) && !refreshing)
      refreshing = onAuthExpired()
        .catch(() => {})
        .finally(() => (refreshing = null));
    return shouldRetry(failureCount, error);
  };
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry,
        retryDelay,
        // Coming back to the app (or back online) refreshes anything older than staleTime.
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
    },
  });
}
