import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Lock } from "lucide-react";
import { Brand } from "@/components/lezgo/brand";
import { DesignLanguage } from "@/components/lezgo/design-language";
import { HabitIcon } from "@/components/lezgo/habit-icon";
import { Avatar, BottomSheet, Num, StickerButton, Tile, inputCls } from "@/components/lezgo/ui";
import { challengePreview, crewInvitePreview } from "@/lib/challenge-preview.functions";
import { supabase } from "@/integrations/supabase/client";
import { errKey, templatesQuery, useBase, type Template } from "@/lib/data";
import { AppShell } from "@/components/lezgo/app-shell";
import { formatDayMonth, loc } from "@/lib/i18n";
import { pageHead } from "@/lib/page-head";
import { clearStartFlow, finishStartFlow, saveStartFlow, toggleStartHabit, type StartFlow } from "@/lib/start-flow";
import { planFor } from "@/lib/challenge-plan";
import { challengeHistoryQuery } from "@/lib/challenge-history";
import { eventColor, joinErrorKey, myActiveEventQuery } from "@/lib/event-data";
import type { CrewInvitePreview } from "@/lib/public-challenges.server";
import { localDate } from "@/lib/time";

type CatalogHabit = { key: string; name: unknown; what_counts: unknown; kind: string; target: number; unit: string | null; is_faith: boolean };
type CatalogCard = { id: string; season_id: string; challenge_id: string | null; kind: "official" | "creator"; name: unknown; creator: string; code: string | null; days: number; starts_on: string; ends_on: string; status: string; goal?: unknown; color?: string; members: number; habits: CatalogHabit[] };
type Invite =
  | { type: "challenge"; challenge: CatalogCard }
  | { type: "crew"; crew: CrewInvitePreview }
  | { type: "invalid" | "early" | "closed" | "full" };
type Step = "challenge" | "personal" | "play" | "invite";
type PlayMode = "solo" | "find" | "create" | "code";

export const Route = createFileRoute("/start")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    ...(typeof s["code"] === "string" ? { code: s["code"].toUpperCase() } : {}),
    ...(typeof s["season"] === "string" && /^[0-9a-f-]{36}$/i.test(s["season"]) ? { season: s["season"] } : {}),
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
  const preselect = Route.useSearch().season ?? "";
  const { user, profile } = useBase();
  // Signed-in, onboarded players stay inside the app: bottom nav, no "Sign in" button.
  const inApp = !!user && !!profile?.onboarded;
  const active = useQuery({ ...myActiveEventQuery(user?.id ?? ""), enabled: !!user });
  const activeName = loc(active.data?.seasons?.name, i18n.language);
  const catalog = useQuery({
    queryKey: ["publicChallengeCatalog"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("public_challenge_catalog");
      if (error) throw error;
      return (data ?? []) as unknown as CatalogCard[];
    },
  });
  const templates = useQuery(templatesQuery);
  // The viewer's own status per challenge, so left/finished ones aren't offered again.
  const history = useQuery({ ...challengeHistoryQuery(user?.id ?? ""), enabled: !!user });
  const statusBySeason = new Map((history.data ?? []).map((entry) => [entry.season_id, entry.status]));
  const inviteQuery = useQuery({
    queryKey: ["startInvite", code],
    enabled: /^[A-Z0-9]{6}$/.test(code),
    queryFn: async (): Promise<Invite> => {
      const result = await challengePreview({ data: code }) as unknown as (CatalogCard & { full?: boolean; ended?: boolean }) | null;
      if (!result) {
        const crew = await crewInvitePreview({ data: code });
        if (!crew) return { type: "invalid" };
        if (crew.ended) return { type: "closed" };
        if (crew.full) return { type: "full" };
        if (crew.starts_on > localDate("Africa/Tunis")) return { type: "early" };
        return { type: "crew", crew };
      }
      if (result.ended) return { type: "closed" };
      if (result.full) return { type: "full" };
      if (result.starts_on > localDate("Africa/Tunis")) return { type: "early" };
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
  const [confirm, setConfirm] = useState<StartFlow | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [upcoming, setUpcoming] = useState<CatalogCard | null>(null);
  const qc = useQueryClient();
  const processedInvite = useRef("");
  const today = localDate("Africa/Tunis");
  const allOfficial = (catalog.data ?? []).filter(
    (card) => card.kind === "official" && card.starts_on <= today && today <= card.ends_on,
  );
  const longerOfficial = allOfficial.filter((card) => card.days > 14);
  const shortOfficial = allOfficial.filter((card) => card.days <= 14);
  const upcomingOfficial = (catalog.data ?? [])
    .filter((card) => card.kind === "official" && card.starts_on > today)
    .sort((a, b) => a.starts_on.localeCompare(b.starts_on));
  const creators = (catalog.data ?? []).filter((card) => card.kind === "creator");
  const templatesList = (templates.data ?? []).filter((tpl) => !tpl.is_faith && tpl.key !== "custom");
  const pickedTemplates = picked.map((key) => templatesList.find((tpl) => tpl.key === key)).filter((tpl): tpl is Template => !!tpl);

  useEffect(() => {
    if (!code || inviteQuery.data === undefined || processedInvite.current === code) return;
    processedInvite.current = code;
    if (inviteQuery.data.type === "challenge") setSelected(inviteQuery.data.challenge);
    else if (inviteQuery.data.type === "crew") setStep("invite");
  }, [code, inviteQuery.data]);

  // /start?season=<id> (e.g. from the landing event card) opens with that challenge chosen.
  const preselected = useRef(false);
  useEffect(() => {
    if (preselected.current || !preselect || !catalog.data) return;
    preselected.current = true;
    const card = catalog.data.find((item) => item.season_id === preselect && item.starts_on <= today && today <= item.ends_on);
    if (card) { setPersonal(false); setSelected(card); }
  }, [preselect, catalog.data, today]);

  function toggleHabit(tpl: Template) {
    setPicked((current) => toggleStartHabit(current, tpl.key));
  }

  function continueToPlay() {
    if (personal) {
      if (picked.length < 1 || picked.length > 6) return;
      setStep("play");
      return;
    }
    if (selected?.season_id === active.data?.season_id && active.data) {
      void nav({ to: "/today" });
    } else if (selected) setStep("play");
  }

  function buildFlow(): StartFlow | null {
    let flow: StartFlow;
    if (personal) {
      if (!pickedTemplates.length) return null;
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
      return null;
    }
    return flow;
  }

  async function continueToSignIn() {
    if (busy) return;
    const flow = buildFlow();
    if (!flow) return;
    // Signed-in players never go through /auth: they confirm a summary and join right here.
    if (user) { setJoinError(null); setConfirm(flow); return; }
    setBusy(true);
    try {
      saveStartFlow(flow);
      await nav({ to: "/auth" });
    } finally {
      setBusy(false);
    }
  }

  async function confirmJoin() {
    if (!confirm || busy) return;
    setBusy(true);
    setJoinError(null);
    try {
      saveStartFlow(confirm);
      await finishStartFlow();
      await qc.invalidateQueries();
      setConfirm(null);
      await nav({ to: "/today" });
    } catch (error) {
      const key = errKey(error) || (error as { message?: string })?.message || "";
      if (key === "crew_setup_pending") {
        // Joined the challenge; only the crew step failed. Today has the crew tools.
        clearStartFlow();
        await qc.invalidateQueries();
      } else {
        clearStartFlow();
      }
      setJoinError(key);
    } finally {
      setBusy(false);
    }
  }

  async function continueCrewInvite() {
    if (!/^[A-Z0-9]{6}$/.test(code)) return;
    if (user) {
      // Already signed in: join here and keep any error on this screen.
      setConfirm({ challenge: { kind: "crew_invite", code } });
      setJoinError(null);
      return;
    }
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
    { label: t("startFlow.creator"), cards: creators.filter(card => card.starts_on <= today && today <= card.ends_on) },
  ];

  const Wrapper = inApp ? "div" : "main";
  const page = (
    <Wrapper className={`design-screen mx-auto flex w-full max-w-[480px] flex-col gap-4 px-5 pt-4 ${inApp ? "pb-28" : "min-h-screen pb-8"}`}>
      <header className="flex items-center justify-between gap-2">
        <Brand size={36} />
        <div className="flex items-center gap-2">
          <DesignLanguage />
          {user ? (
            <Link to="/today" aria-label={t("ux.backToToday")} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-card px-2 text-sm font-extrabold sticker-border">
              {profile && <Avatar id={profile.id} name={profile.display_name} url={profile.avatar_url} size={30} />}
              <span>{t("ux.backToToday")}</span>
            </Link>
          ) : user === null ? (
            <Link to="/auth" className="inline-flex min-h-11 shrink-0 items-center rounded-xl bg-card px-3 text-sm font-extrabold sticker-border">{t("auth.signIn")}</Link>
          ) : null}
        </div>
      </header>

      {active.data && <div className="space-y-2 rounded-2xl bg-yellow p-3 sticker-border">
        <p className="font-extrabold">{activeName ? t("events.current", { name: activeName }) : t("events.currentGeneric")}</p>
        <p className="text-sm">{t("events.keepPlaying")}</p>
        <div className="flex flex-wrap gap-2">
          <Link to="/today"><StickerButton size="sm">{t("events.goToday")}</StickerButton></Link>
          <Link to="/challenges" search={{ season: active.data.season_id }}><StickerButton size="sm" variant="secondary">{t("events.viewEvent")}</StickerButton></Link>
        </div>
      </div>}
      {code && (!/^[A-Z0-9]{6}$/.test(code) || inviteQuery.isError || inviteQuery.data?.type === "invalid" || inviteQuery.data?.type === "early" ||
        inviteQuery.data?.type === "closed" || inviteQuery.data?.type === "full") &&
        <p role="alert" className="sticker rounded-xl p-3 font-semibold">{t(inviteQuery.isError ? "events.joinError"
          : inviteQuery.data?.type === "early" ? "events.early" : inviteQuery.data?.type === "closed" ? "events.closed"
          : inviteQuery.data?.type === "full" ? "batch6.full" : "events.invalidCode")}</p>}

      {step === "invite" ? (
        <section className="my-auto space-y-4 rounded-[22px] bg-yellow p-5 sticker-border shadow-hard-lg">
          <Lock size={28} />
          <h1 className="text-[28px] font-extrabold">{inviteQuery.data?.type === "crew" ? inviteQuery.data.crew.name : t("startFlow.inviteTitle")}</h1>
          <Num className="block text-center text-[32px] tracking-[0.25em]">{code}</Num>
          <p className="font-semibold">{t("startFlow.inviteCrewBody")}</p>
          <StickerButton block size="lg" disabled={busy} onClick={() => void continueCrewInvite()}>{t("startFlow.joinInvite")}<ArrowRight className="rtl:-scale-x-100" /></StickerButton>
        </section>
      ) : step === "challenge" ? (
        <>
          <div><p className="text-[12px] font-extrabold uppercase tracking-wide">{t("startFlow.step", { n: 1 })}</p><h1 className="mt-1 text-[30px] font-extrabold leading-tight">{t("startFlow.pickTitle")}</h1><p className="mt-1 text-[14px] font-semibold text-design-muted">{t("events.sameHabits")}</p></div>
          {code && inviteQuery.data?.type === "challenge" && selected && <div className="rounded-[18px] bg-yellow p-3 text-[14px] font-extrabold sticker-border">{t("startFlow.inviteSelected")}</div>}
          {catalog.isLoading || (code && inviteQuery.isLoading) ? <p>{t("common.loading")}</p> : catalog.isError ? <p>{t("common.error")}</p> : challengeSections.map((section) => section.cards.length > 0 && (
            <section key={section.label} className="space-y-2">
              <h2 className="text-[13px] font-extrabold uppercase tracking-wide">{section.label}</h2>
              {section.cards.map((card) => <ChallengeChoice key={card.id} card={card} status={statusBySeason.get(card.season_id)} selected={selected?.id === card.id || (!!selected?.code && selected.code === card.code)} onSelect={() => { setPersonal(false); setJoinError(null); setSelected(card); }} />)}
            </section>
          ))}
          {catalog.isSuccess && !allOfficial.length && <p>{t("events.noLive")}</p>}
          {code && inviteQuery.data?.type === "challenge" && selected && !catalog.data?.some((card) => card.code === code) && <ChallengeChoice card={selected} selected onSelect={() => undefined} />}
          <button type="button" className={`rounded-[18px] border-2 p-4 text-start sticker-border ${personal ? "bg-lime shadow-hard" : "bg-card"}`} onClick={() => { setPersonal(true); setSelected(null); setStep("personal"); }}>
            <span className="block text-[18px] font-extrabold">{t("startFlow.personal")}</span><span className="text-[13px] font-semibold">{t("startFlow.personalPrivate")}</span>
          </button>
          {upcomingOfficial.length > 0 && (
            <section aria-labelledby="upcoming-events" className="space-y-2">
              <h2 id="upcoming-events" className="text-[13px] font-extrabold uppercase tracking-wide">{t("socialDesign.upcoming")}</h2>
              <ul className="space-y-2">
                {upcomingOfficial.map((card) => (
                  <li key={card.id}>
                    <button type="button" onClick={() => setUpcoming(card)} className="flex w-full items-center justify-between gap-3 rounded-[18px] bg-card p-3 text-start sticker-border press">
                      <span className="font-extrabold">{loc(card.name, i18n.language)}</span>
                      <span className="flex shrink-0 items-center gap-1 text-sm font-semibold">
                        <time dateTime={card.starts_on}>{formatDayMonth(card.starts_on, i18n.language)}</time>
                        <ArrowRight size={16} className="rtl:-scale-x-100" aria-hidden="true" />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {selected && <div className={`sticky z-10 bg-background py-2 ${inApp ? "bottom-[calc(88px+env(safe-area-inset-bottom,0px))]" : "bottom-0 pb-[max(0.5rem,env(safe-area-inset-bottom))]"}`}>
            <StickerButton block size="lg" onClick={continueToPlay}>{t(active.data?.season_id === selected.season_id ? "events.goToday" : "common.next")}<ArrowRight className="rtl:-scale-x-100" /></StickerButton>
          </div>}
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
          <div className="mt-auto space-y-3"><StickerButton block size="lg" disabled={busy || (!!active.data && playMode !== "code") || (!personal && playMode === "code" && crewCode.length !== 6)} onClick={() => void continueToSignIn()}>{user ? t("ux.joinChallenge", { name: personal ? t("startFlow.personalName", { n: days }) : loc(selected?.name, i18n.language) }) : t("startFlow.continue")}<ArrowRight className="rtl:-scale-x-100" /></StickerButton>{!user && <p className="text-center text-[12px] font-semibold text-design-muted">{t("startFlow.signInNext")}</p>}</div>
        </>
      )}
      <BottomSheet open={upcoming !== null} onClose={() => setUpcoming(null)} title={upcoming ? loc(upcoming.name, i18n.language) : ""}>
        {upcoming && <UpcomingDetail card={upcoming} signedIn={!!user} />}
      </BottomSheet>
      <BottomSheet open={confirm !== null} onClose={() => { if (!busy) setConfirm(null); }} title={t("ux.confirmTitle")}>
        {confirm && <JoinSummary
          name={inviteQuery.data?.type === "crew" && !("play" in confirm) ? inviteQuery.data.crew.name : personal ? t("startFlow.personalName", { n: days }) : loc(selected?.name, i18n.language)}
          startsOn={inviteQuery.data?.type === "crew" && !("play" in confirm) ? inviteQuery.data.crew.starts_on : personal ? today : selected?.starts_on ?? today}
          endsOn={inviteQuery.data?.type === "crew" && !("play" in confirm) ? inviteQuery.data.crew.ends_on : personal ? addDaysIso(today, days - 1) : selected?.ends_on ?? today}
          today={today}
          habits={personal ? picked.length : selected?.habits.length ?? 0}
          mode={"play" in confirm ? confirm.play.mode : "code"}
          busy={busy}
          error={joinError}
          onConfirm={() => void confirmJoin()}
          onCancel={() => setConfirm(null)}
        />}
      </BottomSheet>
    </Wrapper>
  );
  return inApp ? <AppShell todayLayout>{page}</AppShell> : page;
}

/** Upcoming event detail: habits, dates and a reminder (signed-in only; the server keeps the record). */
function UpcomingDetail({ card, signedIn }: { card: CatalogCard; signedIn: boolean }) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const reminders = useQuery({
    queryKey: ["myReminderIds"],
    enabled: signedIn,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_season_reminder_ids");
      if (error) throw error;
      return data ?? [];
    },
  });
  const on = !!reminders.data?.includes(card.season_id);
  const goal = loc(card.goal, i18n.language);
  async function toggle() {
    setBusy(true);
    const { error } = await supabase.rpc("set_season_reminder_by_id", { _season_id: card.season_id, _on: !on });
    setBusy(false);
    if (error) { toast(t(errKey(error) === "guest_read_only" ? "guest.readOnly" : "common.error")); return; }
    await qc.invalidateQueries({ queryKey: ["myReminderIds"] });
    toast(t(on ? "ux.reminderOff" : "ux.reminderOn"));
  }
  return (
    <div className="space-y-3">
      <p className="font-semibold">{formatDayMonth(card.starts_on, i18n.language)} – {formatDayMonth(card.ends_on, i18n.language)} · {t("batch6.days", { n: card.days })}</p>
      {goal && <p className="font-semibold">{goal}</p>}
      <ul className="space-y-2">
        {card.habits.map((habit) => (
          <li key={habit.key} className="rounded-[14px] bg-card p-3 sticker-border">
            <strong className="block">{loc(habit.name, i18n.language)}</strong>
            <span className="text-[13px] font-semibold">{loc(habit.what_counts, i18n.language)}</span>
          </li>
        ))}
      </ul>
      {signedIn ? (
        <StickerButton block size="lg" variant={on ? "secondary" : "lime"} disabled={busy || reminders.isPending} aria-pressed={on} onClick={() => void toggle()}>
          {t(on ? "ux.reminderSet" : "ux.remindMe")}
        </StickerButton>
      ) : (
        <Link to="/auth" search={{ next: "/start" }} className="block">
          <StickerButton block size="lg" variant="lime">{t("ux.signInToRemind")}</StickerButton>
        </Link>
      )}
    </div>
  );
}

function addDaysIso(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function JoinSummary({ name, startsOn, endsOn, today, habits, mode, busy, error, onConfirm, onCancel }: {
  name: string; startsOn: string; endsOn: string; today: string; habits: number; mode: string;
  busy: boolean; error: string | null; onConfirm: () => void; onCancel: () => void;
}) {
  const { t, i18n } = useTranslation();
  const plan = planFor(startsOn, endsOn, today, habits);
  const fmt = new Intl.NumberFormat(i18n.language === "aeb" ? "ar-TN" : i18n.language);
  return (
    <div className="space-y-3">
      <p className="text-[20px] font-extrabold">{name}</p>
      <p className="font-semibold">{formatDayMonth(startsOn, i18n.language)} – {formatDayMonth(endsOn, i18n.language)}</p>
      <ul className="space-y-2 text-[15px] font-semibold">
        <li>{plan.day > 1
          ? t("ux.joiningOn", { day: fmt.format(plan.day), total: fmt.format(plan.total), left: fmt.format(plan.left) })
          : t("ux.joiningStart", { total: fmt.format(plan.total) })}</li>
        {habits > 0 && <li>{t("ux.goodDay", { x: fmt.format(plan.goodHabits), y: fmt.format(habits) })}</li>}
        <li>{t(plan.reachable ? "ux.trophyReachable" : "ux.trophyOut", { need: fmt.format(plan.need) })}</li>
        <li>{t("ux.modeLine", { mode: t(`startFlow.${mode}`) })}</li>
        <li className="text-design-muted">{t("ux.oneActive")}</li>
      </ul>
      {error !== null && <div role="alert" className="space-y-2 rounded-[14px] bg-yellow p-3 font-bold sticker-border">
        <p>{t(joinErrorKey(error))}</p>
        {(error === "crew_setup_pending" || error === "active_challenge_exists") && <Link to="/today"><StickerButton size="sm" variant="lime">{t("events.goToday")}</StickerButton></Link>}
      </div>}
      <StickerButton block size="lg" variant="lime" disabled={busy || error === "crew_setup_pending"} onClick={onConfirm}>{t(busy ? "common.loading" : "ux.confirmJoin")}</StickerButton>
      <StickerButton block variant="secondary" disabled={busy} onClick={onCancel}>{t("common.cancel")}</StickerButton>
    </div>
  );
}

function ChallengeChoice({ card, selected, onSelect, status }: { card: CatalogCard; selected: boolean; onSelect: () => void; status?: string | undefined }) {
  const { t, i18n } = useTranslation();
  const goal = loc(card.goal, i18n.language);
  // Left or finished challenges can't be joined again: show them muted, with no action.
  const closed = status === "surrendered" || status === "completed";
  return (
    <button type="button" aria-pressed={closed ? undefined : selected} aria-disabled={closed || undefined} onClick={closed ? undefined : onSelect} style={{ borderInlineStart: `6px solid ${eventColor(card.color)}` }} className={`w-full rounded-[18px] border-2 p-3 text-start sticker-border ${closed ? "cursor-default bg-card opacity-60" : selected ? "bg-lime shadow-hard" : "bg-card shadow-hard-sm"}`}>
      {status && <span className={`mb-2 inline-block rounded-full px-2 py-0.5 text-[12px] font-extrabold ${status === "active" ? "bg-lime" : "bg-background"}`}>{t(status === "surrendered" ? "ux.youLeft" : status === "completed" ? "ux.youFinished" : "ux.youreIn")}</span>}
      <div className="flex items-start justify-between gap-2"><div className="min-w-0"><h3 className="truncate text-[16px] font-extrabold">{loc(card.name,i18n.language)}</h3>{card.kind === "creator" && <p className="text-[12px] font-semibold">{t("batch6.creatorLabel",{name:card.creator})}</p>}</div><span className="shrink-0 rounded-full bg-yellow px-2 py-1 text-[12px] font-extrabold"><Num>{card.days}</Num> {t("challengeHistory.dayUnit")}</span></div>
      <p className="mt-1 text-[12px] font-bold">{t("events.live")} · {formatDayMonth(card.starts_on, i18n.language)} – {formatDayMonth(card.ends_on, i18n.language)} · {t("events.free")}</p>
      {goal && <p className="mt-1 text-[13px] font-semibold">{goal}</p>}
      <div className="mt-2 flex flex-wrap gap-1.5">{card.habits.slice(0,6).map((habit) => <span key={habit.key} className="rounded-full bg-background px-2 py-1 text-[12px] font-bold">{loc(habit.name,i18n.language)}</span>)}</div>
      <p className="mt-2 line-clamp-2 text-[12px] font-semibold text-design-muted">{card.habits.slice(0,2).map((habit) => loc(habit.what_counts,i18n.language)).filter(Boolean).join(" · ")}</p>
    </button>
  );
}
