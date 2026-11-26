import { publicUrl } from "@/lib/public-url";
import type { Lang } from "@/lib/i18n";

type PublicHeadOptions = {
  /** Public pages opt out of the default noindex metadata. */
  privatePage?: boolean;
  canonicalPath?: string;
  imagePath?: string;
  imageAlt?: string;
  localeAlternates?: boolean;
  /** Page language, published as og:locale. */
  lang?: Lang;
};

const OG_LOCALES = { en: "en_US", fr: "fr_FR", ar: "ar_AR", aeb: "ar_TN" } as const;
/** Every page shares with a preview image. The default card is Tunisian (our main audience);
 *  pages explicitly in English or French get the English card. */
const DEFAULT_IMAGE = "/og-home.jpg";
export const shareImage = (lang?: Lang) =>
  lang === "en" || lang === "fr" ? "/og-home-en.jpg" : DEFAULT_IMAGE;
export const DEFAULT_SHARE_TITLE = "lezgo · بالشوية بالشوية… توصل";
export const DEFAULT_SHARE_DESCRIPTION = "دقيقة في النهار، وحدك ولا مع صحابك. بلاش.";

/** App routes are private by default; public routes must opt in explicitly. */
export function pageHead(
  title: string,
  description: string,
  options: PublicHeadOptions | boolean = {},
) {
  const normalized = typeof options === "boolean" ? { privatePage: options } : options;
  const privatePage = normalized.privatePage ?? true;
  const canonical = normalized.canonicalPath ? publicUrl(normalized.canonicalPath) : undefined;
  const image = publicUrl(normalized.imagePath ?? DEFAULT_IMAGE);
  const imageAlt = normalized.imagePath ? (normalized.imageAlt ?? title) : "بالشوية بالشوية… توصل.";
  const locale = OG_LOCALES[normalized.lang ?? "aeb"];
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
      { property: "og:site_name", content: "lezgo" },
      { property: "og:locale", content: locale },
      ...(canonical ? [{ property: "og:url", content: canonical }] : []),
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { property: "og:image", content: image },
      ...(image.startsWith("https:") ? [{ property: "og:image:secure_url", content: image }] : []),
      { property: "og:image:type", content: image.endsWith(".png") ? "image/png" : "image/jpeg" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: imageAlt },
      { name: "twitter:image", content: image },
      { name: "twitter:image:alt", content: imageAlt },
      ...(privatePage ? [{ name: "robots", content: "noindex, nofollow" }] : []),
    ],
    links,
  };
}
