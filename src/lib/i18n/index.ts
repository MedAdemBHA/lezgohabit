import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { en } from "./en";
import { fr } from "./fr";
import { ar } from "./ar";
import { aeb } from "./aeb";

export const LANGS = ["en", "fr", "ar", "aeb"] as const;
export type Lang = (typeof LANGS)[number];
export const LANG_LABELS: Record<Lang, string> = { en: "EN", fr: "FR", ar: "عربي", aeb: "تونسي" };
export const isRtl = (l: string) => l === "ar" || l === "aeb";
export const LANG_KEY = "lezgo_lang";

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources: { en: { translation: en }, fr: { translation: fr }, ar: { translation: ar }, aeb: { translation: aeb } },
    lng: "en",
    fallbackLng: { aeb: ["ar", "en"], fr: ["en"], default: ["en"] },
    interpolation: { escapeValue: false },
    returnObjects: true,
  });
}

export function applyLang(lang: string) {
  const l = (LANGS as readonly string[]).includes(lang) ? lang : "en";
  void i18n.changeLanguage(l);
  if (typeof document !== "undefined") {
    document.documentElement.lang = l;
    document.documentElement.dir = isRtl(l) ? "rtl" : "ltr";
    try { localStorage.setItem(LANG_KEY, l); } catch { /* ignore */ }
  }
}

/** Localize a {en,fr,ar,aeb} jsonb object with the fallback chain aeb→ar→en, fr→en. */
export function loc(obj: unknown, lang: string): string {
  if (!obj || typeof obj !== "object") return "";
  const o = obj as Record<string, string | undefined>;
  const chain = lang === "aeb" ? ["aeb", "ar", "en"] : lang === "ar" ? ["ar", "en"] : lang === "fr" ? ["fr", "en"] : ["en"];
  for (const k of chain) { const v = o[k]; if (v) return v; }
  return Object.values(o).find(Boolean) ?? "";
}

const MAGHREB_MONTHS = ["جانفي", "فيفري", "مارس", "أفريل", "ماي", "جوان", "جويلية", "أوت", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

/** Day + month with Western digits; Maghreb month names for ar/aeb. */
export function formatDayMonth(iso: string, lang: string): string {
  const [, m, d] = iso.split("-").map(Number);
  if (isRtl(lang)) return `${d} ${MAGHREB_MONTHS[(m ?? 1) - 1]}`;
  return new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "short", timeZone: "UTC" })
    .format(new Date(`${iso}T12:00:00Z`));
}

export default i18n;
