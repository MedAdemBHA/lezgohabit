import { publicUrl } from "@/lib/public-url";

type PublicHeadOptions = {
  /** Public pages opt out of the default noindex metadata. */
  privatePage?: boolean;
  canonicalPath?: string;
  imagePath?: string;
  imageAlt?: string;
  localeAlternates?: boolean;
};

/** App routes are private by default; public routes must opt in explicitly. */
export function pageHead(
  title: string,
  description: string,
  options: PublicHeadOptions | boolean = {},
) {
  const normalized = typeof options === "boolean" ? { privatePage: options } : options;
  const privatePage = normalized.privatePage ?? true;
  const canonical = normalized.canonicalPath ? publicUrl(normalized.canonicalPath) : undefined;
  const image = normalized.imagePath ? publicUrl(normalized.imagePath) : undefined;
  const links = canonical
    ? [
        { rel: "canonical", href: canonical },
        ...(normalized.localeAlternates === false
          ? []
          : (["en", "fr", "ar"] as const).map((lang) => ({
              rel: "alternate",
              hrefLang: lang,
              href: `${publicUrl(normalized.canonicalPath!)}${normalized.canonicalPath!.includes("?") ? "&" : "?"}lang=${lang}`,
            }))),
      ]
    : [];

  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      ...(canonical ? [{ property: "og:url", content: canonical }] : []),
      { name: "twitter:card", content: "summary_large_image" },
      ...(image
        ? [
            { property: "og:image", content: image },
            { property: "og:image:width", content: "1200" },
            { property: "og:image:height", content: "630" },
            { property: "og:image:alt", content: normalized.imageAlt ?? title },
            { name: "twitter:image", content: image },
            { name: "twitter:image:alt", content: normalized.imageAlt ?? title },
          ]
        : []),
      ...(privatePage ? [{ name: "robots", content: "noindex, nofollow" }] : []),
    ],
    links,
  };
}
