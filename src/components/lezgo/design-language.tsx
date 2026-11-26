import { useTranslation } from "react-i18next";
import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";
import i18next, { applyLang, isRtl, LANGS, type Lang } from "@/lib/i18n";
import { LangFlag } from "@/components/icons";
import { BottomSheet } from "./ui";

/** Each language named in itself, so a reader can always find their own. */
const NATIVE: Record<Lang, string> = { en: "English", fr: "Français", ar: "العربية", aeb: "تونسي" };

/**
 * Language picker: a compact pill (custom icon + current language + chevron) that opens a sheet
 * listing every language by its native name. `segmented` is kept for older call sites.
 */
export function DesignLanguage({
  lang,
  onSelect,
}: {
  segmented?: boolean;
  lang?: Lang;
  onSelect?: (lang: Lang) => void;
}) {
  const { t: translate, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const t = lang ? i18next.getFixedT(lang) : translate;
  const current = ((lang ?? i18n.language) in NATIVE ? (lang ?? i18n.language) : "en") as Lang;
  return (
    <>
      <button
        type="button"
        className="language-pill press"
        aria-haspopup="dialog"
        aria-label={`${t("common.language")}: ${NATIVE[current]}`}
        onClick={() => setOpen(true)}
      >
        <LangFlag lang={current} size={24} />
        <span className={isRtl(current) ? "font-arabic" : undefined}>{NATIVE[current]}</span>
        <ChevronDown size={16} strokeWidth={2.6} aria-hidden="true" />
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title={t("common.language")}>
        <div role="radiogroup" aria-label={t("common.language")} className="language-list">
          {LANGS.map((l) => (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={current === l}
              dir={isRtl(l) ? "rtl" : "ltr"}
              lang={l === "aeb" ? "ar-TN" : l}
              className={`language-row${current === l ? " is-on" : ""}${isRtl(l) ? " font-arabic" : ""}`}
              onClick={() => {
                applyLang(l);
                onSelect?.(l);
                setOpen(false);
              }}
            >
              <span className="language-row-name">
                <LangFlag lang={l} size={30} />
                {NATIVE[l]}
              </span>
              {current === l && <Check size={20} strokeWidth={3} aria-hidden="true" />}
            </button>
          ))}
        </div>
      </BottomSheet>
    </>
  );
}
