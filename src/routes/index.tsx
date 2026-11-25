import { ClientOnly, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight } from "lucide-react";
import { ExploreAsGuest } from "@/components/lezgo/guest";
import { Brand } from "@/components/lezgo/brand";
import { DesignLanguage } from "@/components/lezgo/design-language";
import { BottomSheet, StickerButton, inputCls } from "@/components/lezgo/ui";
import { officialEventEndsAt, pad, splitMs, useNow } from "@/lib/time";
import { currentOfficialEvent, featuredCreatorChallenges } from "@/lib/challenge-preview.functions";
import { eventColor } from "@/lib/event-data";
import { pageHead } from "@/lib/page-head";
import i18n, { loc } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) =>
    search["lang"] === "fr" || search["lang"] === "ar" ? { lang: search["lang"] } : {},
  loader: async ({ location }) => {
    const requestedLang = new URLSearchParams(location.searchStr).get("lang");
    const lang: "en" | "fr" | "ar" = requestedLang === "fr" || requestedLang === "ar" ? requestedLang : "en";
    const [challenges, event] = await Promise.all([
      featuredCreatorChallenges().catch(() => []),
      currentOfficialEvent().catch(() => null),
    ]);
    return { challenges, event, lang };
  },
  head: ({ loaderData }) => {
    const t = i18n.getFixedT(loaderData?.lang ?? "en");
    return pageHead(
      `lezgo — ${t("landing.hero").replace(/\n/g, " ")}`,
      t("landing.subtitle"),
      { privatePage: false, canonicalPath: "/", imagePath: "/og-home.png", imageAlt: "Show up. Lezgo.", lang: loaderData?.lang ?? "en" },
    );
  },
  component: Landing,
});

function Landing() {
  const { lang, event, challenges: featured } = Route.useLoaderData();
  const t = i18n.getFixedT(lang);
  const nav = useNavigate();
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState("");
  const steps = [t("landing.step1"), t("landing.step2"), t("landing.step3")];

  return (
    <div className="design-screen join-screen">
      <header className="join-header flex items-center justify-between"><Brand size={38} /><DesignLanguage /></header>
      <div className="flex flex-col gap-2.5"><h1 className="join-hero">{t("landing.hero")}</h1><p className="text-[17px] font-semibold leading-[1.5] text-design-body">{t("landing.subtitle")}</p></div>
      {event && <div className="join-season" style={{ borderInlineStart: `6px solid ${eventColor(event.color)}` }}>
        <div className="flex items-center justify-between gap-2"><span className="text-[16px] font-extrabold">{loc(event.name, lang)}</span><span className="rounded-lg bg-lime px-2 py-[3px] text-[12px] font-extrabold text-ink">{t("common.live")}</span></div>
        <ClientOnly fallback={null}><SeasonCountdown endsOn={event.ends_on} /></ClientOnly>
      </div>}
      <ol className="flex flex-col gap-3">{steps.map((step, i) => <li key={step} className="flex items-center gap-3"><span className={`num flex size-[34px] shrink-0 items-center justify-center rounded-[10px] text-[15px] font-bold sticker-border ${["bg-lime", "bg-yellow", "bg-blue"][i] ?? "bg-lime"}`}>{i + 1}</span><span className="text-[17px] font-bold leading-[1.35]">{step}</span></li>)}</ol>
      {featured.map((challenge) => <StickerButton key={challenge.code} variant="secondary" onClick={() => void nav({ to: "/c/$code", params: { code: challenge.code } })}>{challenge.name}<ArrowRight className="size-4 rtl:rotate-180" /></StickerButton>)}
      <div className="join-actions">
        <StickerButton block className="join-primary" onClick={() => nav({ to: "/start" })}>{t("common.cta")}</StickerButton>
        <StickerButton block variant="secondary" className="join-code" onClick={() => setCodeOpen(true)}>{t("landing.haveCode")}</StickerButton>
        <ClientOnly fallback={null}><ExploreAsGuest /></ClientOnly>
        <p className="text-center text-[13px] font-semibold text-design-muted">{t("landing.footer")} · <bdi>EN · FR · عربي · تونسي</bdi></p>
      </div>
      <BottomSheet open={codeOpen} onClose={() => setCodeOpen(false)} title={t("landing.codeTitle")}>
        <p className="mb-3 text-[15px] text-muted-foreground">{t("landing.codeHint")}</p>
        <input dir="ltr" value={code} maxLength={6} autoCapitalize="characters" placeholder="ABC123"
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
          className={`${inputCls} num text-center text-[26px] tracking-[0.3em]`} />
        <StickerButton block className="mt-4" disabled={code.length !== 6}
          onClick={() => void nav({ to: "/c/$code", params: { code } })}>
          {t("common.cta")}
        </StickerButton>
      </BottomSheet>
    </div>
  );
}

function SeasonCountdown({ endsOn }: { endsOn: string }) {
  const { t } = useTranslation();
  const now = useNow();
  const left = splitMs(now ? officialEventEndsAt(endsOn) - now.getTime() : 0);
  return <div className="grid grid-cols-4 gap-2" dir="ltr">{([ ["d", left.d, t("landing.days")], ["h", left.h, t("landing.hrs")], ["m", left.m, t("landing.min")], ["s", left.s, t("landing.sec")] ] as const).map(([key, value, label]) => <div key={key} className="flex flex-col items-center"><span className={`num text-[28px] font-bold leading-none ${key === "s" ? "text-orange" : ""}`}>{pad(value)}</span><span className="mt-1 text-[11px] font-bold text-countdown-muted">{label}</span></div>)}</div>;
}
