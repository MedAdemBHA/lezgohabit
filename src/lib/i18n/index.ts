import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { en } from "./en";
import { fr } from "./fr";
import { ar } from "./ar";
import { aeb } from "./aeb";
import { batch4en, batch4fr, batch4ar, batch4aeb } from "./batch4";
import { batch5en, batch5fr, batch5ar, batch5aeb } from "./batch5";

import { batch6en, batch6fr, batch6ar, batch6aeb } from "./batch6";
import { batch7en, batch7fr, batch7ar, batch7aeb } from "./batch7";
import { batch8en, batch8fr, batch8ar, batch8aeb } from "./batch8";

import { batch9en, batch9fr, batch9ar, batch9aeb } from "./batch9";
import { integrityEn, integrityFr, integrityAr, integrityAeb } from "./integrity";
import { eventsEn, eventsFr, eventsAr, eventsAeb, moderationEn, moderationFr, moderationAr, moderationAeb } from "./events";
import { guestEn, guestFr, guestAr, guestAeb } from "./guest";
import { wrappedEn, wrappedFr, wrappedAr, wrappedAeb } from "./wrapped";
import { flowsEn, flowsFr, flowsAr, flowsAeb } from "./flows";
import { uxEn, uxFr, uxAr, uxAeb } from "./ux";

export const LANGS = ["en", "fr", "ar", "aeb"] as const;
export type Lang = (typeof LANGS)[number];
export const LANG_LABELS: Record<Lang, string> = { en: "EN", fr: "FR", ar: "عربي", aeb: "تونسي" };
export const isRtl = (l: string) => l === "ar" || l === "aeb";
export const LANG_KEY = "lezgo_lang";

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources: {
      en: { translation: { ...en, batch4: batch4en, batch5: batch5en, batch6: batch6en, batch7: batch7en, batch8: batch8en, batch9: batch9en, integrity: integrityEn, guest: guestEn, events: eventsEn, moderation: moderationEn, wrapped: wrappedEn, flows: flowsEn, ux: uxEn } },
      fr: { translation: { ...fr, batch4: batch4fr, batch5: batch5fr, batch6: batch6fr, batch7: batch7fr, batch8: batch8fr, batch9: batch9fr, integrity: integrityFr, guest: guestFr, events: eventsFr, moderation: moderationFr, wrapped: wrappedFr, flows: flowsFr, ux: uxFr } },
      ar: { translation: { ...ar, batch4: batch4ar, batch5: batch5ar, batch6: batch6ar, batch7: batch7ar, batch8: batch8ar, batch9: batch9ar, integrity: integrityAr, guest: guestAr, events: eventsAr, moderation: moderationAr, wrapped: wrappedAr, flows: flowsAr, ux: uxAr } },
      aeb: { translation: { ...aeb, batch4: batch4aeb, batch5: batch5aeb, batch6: batch6aeb, batch7: batch7aeb, batch8: batch8aeb, batch9: batch9aeb, integrity: integrityAeb, guest: guestAeb, events: eventsAeb, moderation: moderationAeb, wrapped: wrappedAeb, flows: flowsAeb, ux: uxAeb } },
    },
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
    try {
      localStorage.setItem(LANG_KEY, l);
    } catch {
      /* ignore */
    }
  }
}

/** Localize a {en,fr,ar,aeb} jsonb object with the fallback chain aeb→ar→en, fr→en. */
export function loc(obj: unknown, lang: string): string {
  if (!obj || typeof obj !== "object") return "";
  const o = obj as Record<string, string | undefined>;
  const chain =
    lang === "aeb"
      ? ["aeb", "ar", "en"]
      : lang === "ar"
        ? ["ar", "en"]
        : lang === "fr"
          ? ["fr", "en"]
          : ["en"];
  for (const k of chain) {
    const v = o[k];
    if (v) return v;
  }
  return Object.values(o).find(Boolean) ?? "";
}

const MAGHREB_MONTHS = [
  "جانفي",
  "فيفري",
  "مارس",
  "أفريل",
  "ماي",
  "جوان",
  "جويلية",
  "أوت",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

/** Day + month with Western digits; Maghreb month names for ar/aeb. */
export function formatDayMonth(iso: string, lang: string): string {
  const [, m, d] = iso.split("-").map(Number);
  if (isRtl(lang)) return `${d} ${MAGHREB_MONTHS[(m ?? 1) - 1]}`;
  return new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${iso}T12:00:00Z`));
}

export default i18n;
