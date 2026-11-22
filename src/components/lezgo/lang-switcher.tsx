import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Languages } from "lucide-react";
import { applyLang, LANGS, LANG_LABELS, type Lang } from "@/lib/i18n";
import { BottomSheet, Chip } from "./ui";
import { cn } from "@/lib/utils";

export function LangSwitcher({ onChange }: { onChange?: (l: Lang) => void }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Chip onClick={() => setOpen(true)} aria-label={t("common.language")}>
        <Languages strokeWidth={2.5} className="size-4" /> {LANG_LABELS[(i18n.language as Lang)] ?? "EN"}
      </Chip>
      <BottomSheet open={open} onClose={() => setOpen(false)} title={t("common.language")}>
        <LangGrid onPick={(l) => { onChange?.(l); setOpen(false); }} />
      </BottomSheet>
    </>
  );
}

export function LangGrid({ onPick }: { onPick?: (l: Lang) => void }) {
  const { i18n } = useTranslation();
  const names: Record<Lang, string> = { en: "English", fr: "Français", ar: "العربية", aeb: "تونسي (دارجة)" };
  return (
    <div className="grid grid-cols-2 gap-3">
      {LANGS.map((l) => (
        <button key={l} type="button" onClick={() => { applyLang(l); onPick?.(l); }}
          className={cn("press min-h-[56px] rounded-[16px] px-3 text-[17px] font-extrabold sticker-border shadow-hard-sm",
            i18n.language === l ? "bg-lime" : "bg-card")}>
          {names[l]}
        </button>
      ))}
    </div>
  );
}
