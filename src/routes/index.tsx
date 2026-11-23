import { ClientOnly, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExploreAsGuest } from "@/components/lezgo/guest";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { ArrowRight } from "lucide-react";
import { Brand } from "@/components/lezgo/brand";
import { DesignLanguage } from "@/components/lezgo/design-language";
import { BottomSheet, StickerButton, inputCls } from "@/components/lezgo/ui";
import { pad, splitMs, useNow, winterArcEndLocal } from "@/lib/time";

export const PENDING_CODE_KEY = "lezgo_pending_code";


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
  component: JoinPage,
});

function JoinPage() {
  return <ClientOnly fallback={<div className="design-screen join-screen" />}><Landing /></ClientOnly>;
}

function Landing() {
  const { t, i18n } = useTranslation();
  const nav = useNavigate();
  const now = useNow();
  const featured = useQuery({queryKey:['featuredCreators'],queryFn:async()=>{const {data,error}=await supabase.rpc('featured_creator_challenges');if(error)throw error;return data as unknown as {name:string;code:string;days:number}[];}});
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState("");
  const left = splitMs(now ? winterArcEndLocal() - now.getTime() : 0);
  const steps = [t("landing.step1"), t("landing.step2"), t("landing.step3")];

  return (
    <div className="design-screen join-screen">
      <header className="join-header flex items-center justify-between"><Brand size={38} /><DesignLanguage /></header>
      <div className="flex flex-col gap-2.5"><h1 className="join-hero">{t("landing.hero")}</h1><p className="text-[17px] font-semibold leading-[1.5] text-design-body">{t("landing.subtitle")}</p></div>
      <div className="join-season">
        <div className="flex items-center justify-between gap-2"><span className="text-[16px] font-extrabold">{t("design.season")}</span><span className="rounded-lg bg-lime px-2 py-[3px] text-[12px] font-extrabold text-ink">{t("common.live")}</span></div>
        <div className="grid grid-cols-4 gap-2" dir="ltr">{([["d",left.d,t("landing.days")],["h",left.h,t("landing.hrs")],["m",left.m,t("landing.min")],["s",left.s,t("landing.sec")]] as const).map(([key,value,label]) => <div key={key} className="flex flex-col items-center"><span className={`num text-[28px] font-bold leading-none ${key === "s" ? "text-orange" : ""}`}>{pad(value)}</span><span className="mt-1 text-[11px] font-bold text-countdown-muted">{label}</span></div>)}</div>
      </div>
      <ol className="flex flex-col gap-3">{steps.map((step,i) => <li key={step} className="flex items-center gap-3"><span className={`num flex size-[34px] shrink-0 items-center justify-center rounded-[10px] text-[15px] font-bold sticker-border ${["bg-lime","bg-yellow","bg-blue"][i] ?? "bg-lime"}`}>{i+1}</span><span className="text-[17px] font-bold leading-[1.35]">{step}</span></li>)}</ol>
      {featured.data?.map(c=><StickerButton key={c.code} variant="secondary" onClick={()=>void nav({to:"/c/$code",params:{code:c.code}})}>{c.name}<ArrowRight className="size-4 rtl:rotate-180"/></StickerButton>)}
      <div className="join-actions">
        <StickerButton block className="join-primary" onClick={() => nav({ to: "/auth" })}>{t("common.cta")}</StickerButton>
        <StickerButton block variant="secondary" className="join-code" onClick={() => setCodeOpen(true)}>{t("landing.haveCode")}</StickerButton>
        <ExploreAsGuest />
        <p className="text-center text-[13px] font-semibold text-design-muted">{t("landing.footer")} · <bdi>EN · FR · عربي · تونسي</bdi></p>
      </div>
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
