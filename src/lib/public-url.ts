import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestUrl } from "@tanstack/react-start/server";

/**
 * The origin serving this request. Used only when APP_URL is unset, so link-preview
 * crawlers (WhatsApp, Facebook, X) always receive absolute og:image/og:url values.
 */
const activeOrigin = createIsomorphicFn()
  .server(() => {
    try {
      return getRequestUrl({ xForwardedHost: true }).origin;
    } catch {
      return "";
    }
  })
  .client(() => window.location.origin);

/** Public URLs are rooted at APP_URL when configured, otherwise at the active request/app origin. */
export function publicAppBaseUrl(): string {
  const configured = typeof process !== "undefined" ? process.env["APP_URL"]?.trim() : undefined;
  if (configured) return configured.replace(/\/+$/, "");
  return activeOrigin();
}

export function publicUrl(path: string): string {
  const base = publicAppBaseUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return base ? new URL(normalizedPath, `${base}/`).toString() : normalizedPath;
}
