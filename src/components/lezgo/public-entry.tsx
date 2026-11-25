import { Link } from "@tanstack/react-router";
import { ArrowRight, Ticket } from "lucide-react";
import { useState } from "react";
import i18n, { type Lang } from "@/lib/i18n";
import { Brand } from "./brand";
import { DesignLanguage } from "./design-language";
import { BottomSheet, Field, StickerButton, inputCls } from "./ui";

export function PublicHeader({ lang, onLanguage }: { lang: Lang; onLanguage: (lang: Lang) => void }) {
  const t = i18n.getFixedT(lang);
  return (
    <header className="flex min-h-14 items-center justify-between gap-2 border-b-2 border-ink pb-3">
      <Link to="/" search={{ lang }} aria-label={t("landing.home")} className="shrink-0" dir="ltr">
        <Brand size={36} />
      </Link>
      <div className="flex items-center gap-2">
        <DesignLanguage lang={lang} onSelect={onLanguage} />
        <Link to="/auth" className="inline-flex min-h-11 items-center rounded-xl bg-card px-3 text-center text-sm font-extrabold sticker-border">
          {t("auth.signIn")}
        </Link>
      </div>
    </header>
  );
}

export function InviteCodeButton({ lang, onSubmit }: { lang: Lang; onSubmit: (code: string) => void }) {
  const t = i18n.getFixedT(lang);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  return (
    <>
      <StickerButton variant="secondary" className="join-code" onClick={() => setOpen(true)}>
        <Ticket className="size-5" aria-hidden="true" /> {t("landing.haveCode")}
      </StickerButton>
      <BottomSheet open={open} onClose={() => setOpen(false)} title={t("landing.codeTitle")}>
        <form className="space-y-4" onSubmit={(event) => {
          event.preventDefault();
          if (code.length !== 6) return;
          setOpen(false);
          onSubmit(code);
        }}>
          <Field label={t("landing.codeHint")}>
            <input dir="ltr" autoFocus value={code} maxLength={6} autoCapitalize="characters"
              autoComplete="off" placeholder="ABC123" onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
              className={`${inputCls} num text-center text-[24px] tracking-[0.25em]`} />
          </Field>
          <StickerButton block type="submit" disabled={code.length !== 6}>
            {t("common.next")} <ArrowRight className="size-5 rtl:rotate-180" aria-hidden="true" />
          </StickerButton>
        </form>
      </BottomSheet>
    </>
  );
}
