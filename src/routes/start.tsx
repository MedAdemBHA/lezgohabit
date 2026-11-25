import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight, Lock } from "lucide-react";
import { Brand } from "@/components/lezgo/brand";
import { DesignLanguage } from "@/components/lezgo/design-language";
import { HabitIcon } from "@/components/lezgo/habit-icon";
import { Num, StickerButton, Tile, inputCls } from "@/components/lezgo/ui";
import { challengePreview } from "@/lib/challenge-preview.functions";
import { supabase } from "@/integrations/supabase/client";
import { templatesQuery, type Template } from "@/lib/data";
import { loc } from "@/lib/i18n";
import { pageHead } from "@/lib/page-head";
import { saveStartFlow, toggleStartHabit, type StartFlow } from "@/lib/start-flow";
import { localDate } from "@/lib/time";

type CatalogHabit = { key: string; name: unknown; what_counts: unknown; kind: string; target: number; unit: string | null; is_faith: boolean };
type CatalogCard = { id: string; season_id: string; challenge_id: string | null; kind: "official" | "creator"; name: unknown; creator: string; code: string | null; days: number; starts_on: string; ends_on: string; status: string; members: number; habits: CatalogHabit[] };
type Invite = { type: "challenge"; challenge: CatalogCard } | { type: "crew" };
type Step = "challenge" | "personal" | "play" | "invite";
type PlayMode = "solo" | "find" | "create" | "code";

export const Route = createFileRoute("/start")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    ...(typeof s["code"] === "string" ? { code: s["code"].toUpperCase() } : {}),
    ...(s["lang"] === "fr" || s["lang"] === "ar" ? { lang: s["lang"] } : {}),
  }),
  head: () => pageHead("Start a challenge — lezgo", "Choose a challenge and make your first check-in.", {
      privatePage: false,
      canonicalPath: "/start",
      imagePath: "/og-home.png",
      imageAlt: "Choose a challenge on lezgo",
    }),
  component: StartPage,
});

function StartPage() {
  const { t, i18n } = useTranslation();
  const nav = useNavigate();
  const code = Route.useSearch().code ?? "";
  const catalog = useQuery({
    queryKey: ["publicChallengeCatalog"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("public_challenge_catalog");
      if (error) throw error;
      return (data ?? []) as unknown as CatalogCard[];
    },
  });
  const templates = useQuery(templatesQuery);
  const inviteQuery = useQuery({
    queryKey: ["startInvite", code],
    enabled: /^[A-Z0-9]{6}$/.test(code),
    queryFn: async (): Promise<Invite> => {
      const result = await challengePreview({ data: code }) as unknown as (CatalogCard & { full?: boolean; ended?: boolean }) | null;
      if (!result) return { type: "crew" };
      return { type: "challenge", challenge: { ...result, kind: "creator", challenge_id: result.challenge_id ?? result.id, members: result.members ?? 0, status: "live", name: { en: result.name, fr: result.name, ar: result.name, aeb: result.name }, habits: result.habits ?? [] } };
    },
  });
  const [step, setStep] = useState<Step>("challenge");
  const [selected, setSelected] = useState<CatalogCard | null>(null);
  const [personal, setPersonal] = useState(false);
  const [days, setDays] = useState(7);
  const [picked, setPicked] = useState<string[]>([]);
  const [playMode, setPlayMode] = useState<PlayMode>("solo");
  const [crewCode, setCrewCode] = useState("");
  const [busy, setBusy] = useState(false);
  const processedInvite = useRef("");
  const today = localDate("Africa/Tunis");
  const allOfficial = (catalog.data ?? []).filter(
    (card) => card.kind === "official" && card.starts_on <= today && today <= card.ends_on,
  );
  const longerOfficial = allOfficial.filter((card) => card.days > 14);
  const shortOfficial = allOfficial.filter((card) => card.days <= 14);
  const creators = (catalog.data ?? []).filter((card) => card.kind === "creator");
  const templatesList = (templates.data ?? []).filter((tpl) => !tpl.is_faith && tpl.key !== "custom");
  const pickedTemplates = picked.map((key) => templatesList.find((tpl) => tpl.key === key)).filter((tpl): tpl is Template => !!tpl);

  useEffect(() => {
    if (!code || inviteQuery.data === undefined || processedInvite.current === code) return;
    processedInvite.current = code;
    if (inviteQuery.data.type === "challenge") setSelected(inviteQuery.data.challenge);
    else setStep("invite");
  }, [code, inviteQuery.data]);

  function toggleHabit(tpl: Template) {
    setPicked((current) => toggleStartHabit(current, tpl.key));
  }

  function continueToPlay() {
    if (personal) {
      if (picked.length < 1 || picked.length > 6) return;
      setStep("play");
      return;
    }
    if (selected) setStep("play");
  }

  async function continueToSignIn() {
    if (busy) return;
    let flow: StartFlow;
    if (personal) {
      if (!pickedTemplates.length) return;
      flow = {
        challenge: {
          kind: "personal",
          name: t("startFlow.personalName", { n: days }),
          days,
          habits: pickedTemplates.map((tpl) => ({ key: tpl.key, target: Number(tpl.default_target) })),
        },
        play: { mode: "solo" },
      };
    } else if (selected?.kind === "official") {
      flow = playMode === "code"
        ? { challenge: { kind: "official", seasonId: selected.season_id }, play: { mode: "code", code: crewCode } }
        : { challenge: { kind: "official", seasonId: selected.season_id }, play: { mode: playMode as "solo" | "find" | "create" } };
    } else if (selected?.kind === "creator" && selected.code) {
      flow = playMode === "code"
        ? { challenge: { kind: "creator", code: selected.code }, play: { mode: "code", code: crewCode } }
        : { challenge: { kind: "creator", code: selected.code }, play: { mode: playMode as "solo" | "find" | "create" } };
    } else {
      return;
    }
    setBusy(true);
    try {
      saveStartFlow(flow);
      await nav({ to: "/auth" });
    } finally {
      setBusy(false);
    }
  }

  async function continueCrewInvite() {
    if (!/^[A-Z0-9]{6}$/.test(code)) return;
    setBusy(true);
    try {
      saveStartFlow({ challenge: { kind: "crew_invite", code } });
      await nav({ to: "/auth" });
    } finally {
      setBusy(false);
    }
  }

  const challengeSections = [
    { label: t("startFlow.official"), cards: longerOfficial },
    { label: t("startFlow.short"), cards: shortOfficial },
    { label: t("startFlow.creator"), cards: creators },
  ];

  return (
    <main className="design-screen mx-auto flex min-h-screen w-full max-w-[480px] flex-col gap-4 px-5 pb-8 pt-4">
      <header className="flex items-center justify-between"><Brand size={36} /><DesignLanguage /></header>

      {step === "invite" ? (
        <section className="my-auto space-y-4 rounded-[22px] bg-yellow p-5 sticker-border shadow-hard-lg">
          <Lock size={28} />
          <h1 className="text-[28px] font-extrabold">{t("startFlow.inviteTitle")}</h1>
          <Num className="block text-center text-[32px] tracking-[0.25em]">{code}</Num>
          <p className="font-semibold">{t("startFlow.inviteCrewBody")}</p>
          <StickerButton block size="lg" disabled={busy} onClick={() => void continueCrewInvite()}>{t("startFlow.joinInvite")}<ArrowRight className="rtl:-scale-x-100" /></StickerButton>
        </section>
      ) : step === "challenge" ? (
        <>
          <div><p className="text-[12px] font-extrabold uppercase tracking-wide">{t("startFlow.step", { n: 1 })}</p><h1 className="mt-1 text-[30px] font-extrabold leading-tight">{t("startFlow.pickTitle")}</h1><p className="mt-1 text-[14px] font-semibold text-design-muted">{t("startFlow.pickSub")}</p></div>
          {code && inviteQuery.data?.type === "challenge" && selected && <div className="rounded-[18px] bg-yellow p-3 text-[14px] font-extrabold sticker-border">{t("startFlow.inviteSelected")}</div>}
          {catalog.isLoading || (code && inviteQuery.isLoading) ? <p>{t("common.loading")}</p> : catalog.isError ? <p>{t("common.error")}</p> : challengeSections.map((section) => section.cards.length > 0 && (
            <section key={section.label} className="space-y-2">
              <h2 className="text-[13px] font-extrabold uppercase tracking-wide">{section.label}</h2>
              {section.cards.map((card) => <ChallengeChoice key={card.id} card={card} selected={selected?.id === card.id || (!!selected?.code && selected.code === card.code)} onSelect={() => { setPersonal(false); setSelected(card); }} />)}
            </section>
          ))}
          {code && inviteQuery.data?.type === "challenge" && selected && !catalog.data?.some((card) => card.code === code) && <ChallengeChoice card={selected} selected onSelect={() => undefined} />}
          <button type="button" className={`rounded-[18px] border-2 p-4 text-start sticker-border ${personal ? "bg-lime shadow-hard" : "bg-card"}`} onClick={() => { setPersonal(true); setSelected(null); setStep("personal"); }}>
            <span className="block text-[18px] font-extrabold">{t("startFlow.personal")}</span><span className="text-[13px] font-semibold">{t("startFlow.personalPrivate")}</span>
          </button>
          <StickerButton block size="lg" disabled={!selected} onClick={continueToPlay}>{t("common.next")}<ArrowRight className="rtl:-scale-x-100" /></StickerButton>
          <p className="text-center text-[12px] font-semibold text-design-muted">{t("startFlow.noCatalog")}</p>
        </>
      ) : step === "personal" ? (
        <>
          <div className="flex items-center gap-3"><StickerButton variant="secondary" className="size-11 p-0" aria-label={t("common.back")} onClick={() => setStep("challenge")}><ArrowLeft className="rtl:-scale-x-100" /></StickerButton><div><p className="text-[12px] font-extrabold uppercase tracking-wide">{t("startFlow.step", { n: 2 })}</p><h1 className="text-[26px] font-extrabold">{t("startFlow.personal")}</h1></div></div>
          <p className="text-[14px] font-semibold">{t("startFlow.personalHint")}</p>
          <div className="flex flex-wrap gap-2">{[7,14,21,30,40,66,90].map((n) => <button key={n} type="button" aria-pressed={days === n} onClick={() => setDays(n)} className={`min-h-11 rounded-full px-4 font-extrabold sticker-border ${days === n ? "bg-lime shadow-hard-sm" : "bg-card"}`}>{t("batch6.days", { n })}</button>)}</div>
          <div className="flex items-center justify-between"><h2 className="font-extrabold">{t("startFlow.pickHabits")}</h2><Num className="rounded-full bg-ink px-3 py-1 text-lime">{picked.length}/6</Num></div>
          {templates.isLoading ? <p>{t("common.loading")}</p> : <div className="grid grid-cols-2 gap-3">{templatesList.map((tpl) => {
            const on = picked.includes(tpl.key);
            return <Tile key={tpl.id} selected={on} aria-pressed={on} onClick={() => toggleHabit(tpl)}><span className="flex items-center justify-between"><HabitIcon name={tpl.icon} className="size-6" />{on && <span className="rounded-full bg-ink px-2 text-lime">✓</span>}</span><span className="truncate text-[15px] font-extrabold">{loc(tpl.name,i18n.language)}</span><span className="truncate text-[11px] font-semibold text-design-muted">{loc(tpl.what_counts,i18n.language) || loc(tpl.description,i18n.language)}</span></Tile>;
          })}</div>}
          <StickerButton block size="lg" disabled={picked.length < 1 || picked.length > 6} onClick={() => setStep("play")}>{t("common.next")}<ArrowRight className="rtl:-scale-x-100" /></StickerButton>
        </>
      ) : (
        <>
          <div className="flex items-center gap-3"><StickerButton variant="secondary" className="size-11 p-0" aria-label={t("common.back")} onClick={() => setStep(personal ? "personal" : "challenge")}><ArrowLeft className="rtl:-scale-x-100" /></StickerButton><div><p className="text-[12px] font-extrabold uppercase tracking-wide">{t("startFlow.step", { n: personal ? 3 : 2 })}</p><h1 className="text-[26px] font-extrabold">{t("startFlow.playTitle")}</h1></div></div>
          {selected && <div className="rounded-[18px] bg-yellow p-3 sticker-border"><strong>{loc(selected.name,i18n.language)}</strong><p className="text-[13px] font-semibold">{t("batch6.days", { n: selected.days })}</p></div>}
          {personal ? <>
            <button type="button" className="min-h-[60px] rounded-[18px] bg-lime p-4 text-start font-extrabold sticker-border shadow-hard" aria-pressed="true" onClick={() => setPlayMode("solo")}>{t("startFlow.solo")}</button>
            <p className="text-[13px] font-semibold text-design-muted">{t("startFlow.personalSoloHint")}</p>
          </> : <div className="grid grid-cols-2 gap-3">
            {(["solo","find","create","code"] as const).map((mode) => <button key={mode} type="button" aria-pressed={playMode === mode} onClick={() => setPlayMode(mode)} className={`min-h-[76px] rounded-[18px] p-3 text-start font-extrabold sticker-border ${playMode === mode ? "bg-lime shadow-hard" : "bg-card"}`}>{t(`startFlow.${mode}`)}</button>)}
          </div>}
          {!personal && playMode === "code" && <label className="block text-[14px] font-extrabold">{t("startFlow.codeHint")}<input dir="ltr" value={crewCode} maxLength={6} autoCapitalize="characters" onChange={(e) => setCrewCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,""))} className={`${inputCls} num mt-2 text-center text-[24px] tracking-[0.25em]`} /></label>}
          <div className="mt-auto space-y-3"><StickerButton block size="lg" disabled={busy || (!personal && playMode === "code" && crewCode.length !== 6)} onClick={() => void continueToSignIn()}>{t("startFlow.continue")}<ArrowRight className="rtl:-scale-x-100" /></StickerButton><p className="text-center text-[12px] font-semibold text-design-muted">{t("startFlow.signInNext")}</p></div>
        </>
      )}
    </main>
  );
}

function ChallengeChoice({ card, selected, onSelect }: { card: CatalogCard; selected: boolean; onSelect: () => void }) {
  const { t, i18n } = useTranslation();
  return (
    <button type="button" aria-pressed={selected} onClick={onSelect} className={`w-full rounded-[18px] border-2 p-3 text-start sticker-border ${selected ? "bg-lime shadow-hard" : "bg-card shadow-hard-sm"}`}>
      <div className="flex items-start justify-between gap-2"><div className="min-w-0"><h3 className="truncate text-[16px] font-extrabold">{loc(card.name,i18n.language)}</h3>{card.kind === "creator" && <p className="text-[12px] font-semibold">{t("batch6.creatorLabel",{name:card.creator})}</p>}</div><span className="shrink-0 rounded-full bg-yellow px-2 py-1 text-[12px] font-extrabold"><Num>{card.days}</Num> {t("challengeHistory.dayUnit")}</span></div>
      <div className="mt-2 flex flex-wrap gap-1.5">{card.habits.slice(0,6).map((habit) => <span key={habit.key} className="rounded-full bg-background px-2 py-1 text-[12px] font-bold">{loc(habit.name,i18n.language)}</span>)}</div>
      <p className="mt-2 line-clamp-2 text-[12px] font-semibold text-design-muted">{card.habits.slice(0,2).map((habit) => loc(habit.what_counts,i18n.language)).filter(Boolean).join(" · ")}</p>
    </button>
  );
}
