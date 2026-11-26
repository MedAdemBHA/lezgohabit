/** Session key that carries the post-sign-in destination across an OAuth round trip. */
export const AFTER_SIGN_IN = "lezgo_after_sign_in";
/** Older builds stored only a Wrapped season id; still honoured once after an upgrade. */
export const LEGACY_WRAPPED_SIGN_IN = "lezgo_wrapped_sign_in";

const BLOCKED = ["/auth", "/api/", "/og/"];

/**
 * Returns a same-origin path (with search and hash) that is safe to send the player to after
 * sign-in, or undefined. Rejects absolute/protocol-relative URLs, backslash tricks and the auth
 * page itself so a crafted link can never bounce a player off-site or into a redirect loop.
 */
export function safeNext(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 512) return undefined;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return undefined;
  let url: URL;
  try {
    url = new URL(value, "https://lezgo.invalid");
  } catch {
    return undefined;
  }
  if (url.origin !== "https://lezgo.invalid") return undefined;
  const path = url.pathname;
  if (
    path === "/" ||
    BLOCKED.some((p) => path === p || path.startsWith(p.endsWith("/") ? p : `${p}/`))
  )
    return undefined;
  return `${path}${url.search}${url.hash}`;
}

/** Back-compat for links built as /auth?next=/wrapped&season=<id>. */
export function nextFromSearch(search: Record<string, unknown>): string | undefined {
  const next = safeNext(search["next"]);
  if (next === "/wrapped" && typeof search["season"] === "string" && search["season"])
    return `/wrapped?season=${encodeURIComponent(search["season"])}`;
  return next;
}

/** Reads and clears the stored destination (new key first, then the legacy Wrapped key). */
export function takeStoredNext(): string | undefined {
  try {
    const stored = sessionStorage.getItem(AFTER_SIGN_IN);
    const legacy = sessionStorage.getItem(LEGACY_WRAPPED_SIGN_IN);
    sessionStorage.removeItem(AFTER_SIGN_IN);
    sessionStorage.removeItem(LEGACY_WRAPPED_SIGN_IN);
    if (stored) return safeNext(stored);
    if (legacy !== null)
      return legacy ? `/wrapped?season=${encodeURIComponent(legacy)}` : "/wrapped";
  } catch {
    /* Storage blocked: fall back to the default destination. */
  }
  return undefined;
}

/** Maps Supabase/OAuth error params returned to /auth onto a copy key. */
export function authReturnError(
  search: string,
  hash: string,
): "cancelled" | "expired" | "failed" | null {
  const params = new URLSearchParams(search);
  const fromHash = new URLSearchParams(hash.replace(/^#/, ""));
  const error = params.get("error") ?? fromHash.get("error");
  if (!error) return null;
  const code = params.get("error_code") ?? fromHash.get("error_code") ?? "";
  const description = (
    params.get("error_description") ??
    fromHash.get("error_description") ??
    ""
  ).toLowerCase();
  if (code === "otp_expired" || description.includes("expired") || description.includes("invalid"))
    return "expired";
  if (error === "access_denied") return "cancelled";
  return "failed";
}
