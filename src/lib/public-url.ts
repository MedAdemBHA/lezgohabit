/** Public URLs are rooted at APP_URL in server environments and the active app origin in browsers. */
export function publicAppBaseUrl(): string {
  const configured = typeof process !== "undefined" ? process.env["APP_URL"]?.trim() : undefined;
  if (configured) return configured.replace(/\/+$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

export function publicUrl(path: string): string {
  const base = publicAppBaseUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return base ? new URL(normalizedPath, `${base}/`).toString() : normalizedPath;
}
