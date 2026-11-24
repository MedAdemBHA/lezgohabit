import { createFileRoute } from "@tanstack/react-router";

const escapeXml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { getPublicFeaturedChallenges } = await import("@/lib/public-challenges.server");
        const challenges = await getPublicFeaturedChallenges();
        const configuredBase = process.env["APP_URL"]?.trim().replace(/\/+$/, "");
        const base = configuredBase || new URL(request.url).origin;
        const paths = ["/", "/start", ...challenges.map(({ code }) => `/c/${encodeURIComponent(code)}`)];
        const entries = paths.map((path) => {
          const canonical = new URL(path, `${base}/`).toString();
          const alternates = (["en", "fr", "ar"] as const).map((lang) => {
            const localized = new URL(canonical);
            localized.searchParams.set("lang", lang);
            return `<xhtml:link rel="alternate" hreflang="${lang}" href="${escapeXml(localized.toString())}"/>`;
          }).join("");
          return `<url><loc>${escapeXml(canonical)}</loc>${alternates}</url>`;
        }).join("");
        const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${entries}</urlset>`;
        return new Response(xml, {
          headers: {
            "content-type": "application/xml; charset=utf-8",
            "cache-control": "public, max-age=300, s-maxage=900",
            "x-content-type-options": "nosniff",
          },
        });
      },
    },
  },
});
