import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight } from "lucide-react";
import { Brand } from "@/components/lezgo/brand";
import { LangSwitcher } from "@/components/lezgo/lang-switcher";
import { BottomSheet, Num, StickerButton, StickerCard, inputCls } from "@/components/lezgo/ui";
import { formatDayMonth, LANG_LABELS } from "@/lib/i18n";
import { pad, splitMs, useNow } from "@/lib/time";

export const PENDING_CODE_KEY = "lezgo_pending_code";
const SEASON_END = Date.parse("2026-12-31T23:59:59+01:00");

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "lezgo — Show up. Lezgo. | Winter Arc season" },
      { name: "description", content: "Join Winter Arc: a 40-day habit season with friends, your crew or all of Tunisia. Check in under a minute a day." },
      { property: "og:title", content: "lezgo — Winter Arc · Season 1" },
      { property: "og:description", content: "Pick 1 to 3 habits, check in daily, climb the Tunisia board." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { t, i18n } = useTranslation();
  const nav = useNavigate();
  const now = useNow();
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState("");
  const left = splitMs(now ? SEASON_END - now.getTime() : 0);
  const steps = [t("landing.step1"), t("landing.step2"), t("landing.step3")];

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[440px] flex-col px-5 pb-8 pt-4">
      <header className="flex items-center justify-between"><Brand /><LangSwitcher /></header>

      <h1 className="mt-8 whitespace-pre-line text-[52px] font-extrabold leading-[1.02] tracking-tight rtl:leading-[1.3]">
        {t("landing.hero")}
      </h1>
      <p className="mt-4 text-[17px] font-medium text-muted-foreground">{t("landing.subtitle")}</p>

      <div className="mt-6 rounded-[22px] bg-ink p-5 text-cream sticker-border shadow-hard-orange">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[17px] font-extrabold"><bdi dir="ltr" className="font-sans">Winter Arc</bdi> · {t("common.season1")}</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-lime px-2.5 py-0.5 text-[12px] font-extrabold text-ink">
            <span className="size-2 animate-pulse rounded-full bg-orange" />{t("common.live")}
          </span>
        </div>
        <p className="mt-1 text-[14px] opacity-70">{formatDayMonth("2026-11-22", i18n.language)} – {formatDayMonth("2026-12-31", i18n.language)}</p>
        <p className="mt-4 text-[13px] font-bold uppercase opacity-70">{t("landing.endsIn")}</p>
        <div className="mt-1 grid grid-cols-4 gap-2" dir="ltr">
          {([["d", left.d, t("landing.days")], ["h", left.h, t("landing.hrs")], ["m", left.m, t("landing.min")], ["s", left.s, t("landing.sec")]] as const).map(([k, v, l]) => (
            <div key={k} className="rounded-[14px] bg-cream/10 py-2 text-center">
              <div className="num text-[28px] font-bold text-lime">{pad(v)}</div>
              <div className="text-[12px] opacity-80">{l}</div>
            </div>
          ))}
        </div>
      </div>

      <ol className="mt-6 space-y-3">
        {steps.map((s, i) => (
          <li key={i} className="flex items-center gap-3">
            <span className="num grid size-10 shrink-0 place-items-center rounded-[12px] bg-lime text-[18px] font-bold sticker-border">{i + 1}</span>
            <span className="text-[17px] font-bold">{s}</span>
          </li>
        ))}
      </ol>

      <div className="mt-8 space-y-3">
        <StickerButton block size="lg" onClick={() => nav({ to: "/auth" })}>
          {t("common.cta")} <ArrowRight strokeWidth={3} className="size-5 rtl:-scale-x-100" />
        </StickerButton>
        <StickerButton block variant="secondary" onClick={() => setCodeOpen(true)}>{t("landing.haveCode")}</StickerButton>
      </div>

      <p className="mt-8 text-center text-[13px] font-semibold text-muted-foreground">
        {t("landing.footer")} · <bdi>EN · FR · {LANG_LABELS.ar} · {LANG_LABELS.aeb}</bdi>
      </p>

      <BottomSheet open={codeOpen} onClose={() => setCodeOpen(false)} title={t("landing.codeTitle")}>
        <p className="mb-3 text-[15px] text-muted-foreground">{t("landing.codeHint")}</p>
        <input dir="ltr" value={code} maxLength={6} autoCapitalize="characters" placeholder="ABC123"
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
          className={`${inputCls} num text-center text-[26px] tracking-[0.3em]`} />
        <StickerButton block className="mt-4" disabled={code.length !== 6}
          onClick={() => { sessionStorage.setItem(PENDING_CODE_KEY, code); void nav({ to: "/auth" }); }}>
          {t("common.cta")}
        </StickerButton>
      </BottomSheet>
    </div>
  );
}
