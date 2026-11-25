import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Check, Lock, Plus, Ticket, User, Users } from "lucide-react";
import { PublicHeader, InviteCodeButton } from "@/components/lezgo/public-entry";
import { HabitIcon } from "@/components/lezgo/habit-icon";
import { Field, Num, StickerButton, Tile, inputCls } from "@/components/lezgo/ui";
import { challengePreview, publicChallengeCatalog } from "@/lib/challenge-preview.functions";
import { groupCatalog, type CatalogCard } from "@/lib/challenge-catalog";
import { templatesQuery, type Template } from "@/lib/data";
import i18n, { formatDayMonth, loc, selectLang, type Lang } from "@/lib/i18n";
import { pageHead } from "@/lib/page-head";
import { MAX_CHALLENGE_HABITS, saveStartFlow, toggleStartHabit, type StartFlow } from "@/lib/start-flow";

type Step = "challenge" | "personal" | "play" | "invite";
const PLAY_OPTIONS = { solo: User, find: Users, create: Plus, code: Ticket };
type PlayMode = keyof typeof PLAY_OPTIONS;
const INVITE_CODE = /^[A-Z0-9]{6}$/;
const DURATIONS = [7, 14, 21, 30, 40, 66, 90];

export const Route = createFileRoute("/start")({
  validateSearch: (search: Record<string, unknown>): { code?: string | undefined; season?: string | undefined; lang?: Lang | undefined } => ({
    code: typeof search["code"] === "string" ? search["code"].trim().toUpperCase() : undefined,
    season: typeof search["season"] === "string" ? search["season"] : undefined,
    lang: selectLang(search["lang"]),
  }),
  loader: async () => {
    try {
      return { ...groupCatalog(await publicChallengeCatalog()), catalogError: false };
    } catch {
      return { open: [], upcoming: [], catalogError: true };
    }
  },
  head: ({ match }) => {
    const lang = match.search.lang ?? "en";
    const t = i18n.getFixedT(lang);
    return pageHead(`${t("startFlow.pickTitle")} — lezgo`, t("startFlow.pickSub"), {
      privatePage: false,
      canonicalPath: "/start",
      imagePath: "/og-home.png",
      imageAlt: t("landing.hero").replace(/\n/g, " "),
      lang,
    });
  },
  component: StartPage,
});

function StartPage() {
  const { lang = "en", code = "", season } = Route.useSearch();
  const { open, upcoming, catalogError } = Route.useLoaderData();
  const t = i18n.getFixedT(lang);
  const nav = useNavigate();
  const router = useRouter();
  const suggested = open.find((card) => card.season_id === season) ?? null;
  const [step, setStep] = useState<Step>("challenge");
  const [selected, setSelected] = useState<CatalogCard | null>(suggested);
  const [days, setDays] = useState(7);
  const [picked, setPicked] = useState<string[]>([]);
  const [playMode, setPlayMode] = useState<PlayMode>("solo");
  const [crewCode, setCrewCode] = useState("");
  const [busy, setBusy] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(step);
  const checkedInvite = useRef("");
  const templates = useQuery({ ...templatesQuery, enabled: step === "personal" });
  const invite = useQuery({
    queryKey: ["startInvite", code],
    enabled: INVITE_CODE.test(code),
    queryFn: () => challengePreview({ data: code }),
    retry: false,
  });

  useEffect(() => {
    if (previousStep.current === step) return;
    previousStep.current = step;
    heading.current?.focus();
  }, [step]);

  useEffect(() => {
    if (!code) {
      checkedInvite.current = "";
      return;
    }
    if (invite.data === undefined || checkedInvite.current === code) return;
    checkedInvite.current = code;
    if (invite.data === null) {
      setStep("invite");
      return;
    }
    if (invite.data.full || invite.data.ended) return;
    const result = invite.data;
    setSelected({
      ...result,
      kind: "creator",
      name: { en: result.name },
    });
  }, [code, invite.data]);

  function enterCode(nextCode?: string) {
    if (nextCode === code) return;
    setSelected(null);
    setStep("challenge");
    void nav({ to: "/start", search: { code: nextCode, lang } });
  }

  function selectCard(card: CatalogCard) {
    setSelected(card);
    setPlayMode("solo");
    setCrewCode("");
  }

  async function continueToAuth(flow: StartFlow) {
    if (busy) return;
    setBusy(true);
    try {
      saveStartFlow(flow);
      await nav({ to: "/auth" });
    } finally {
      setBusy(false);
    }
  }

  const templatesList = (templates.data ?? []).filter((item) => !item.is_faith && item.key !== "custom");
  const pickedTemplates = picked.map((key) => templatesList.find((item) => item.key === key)).filter((item): item is Template => !!item);
  const challengeSections = [
    { label: t("startFlow.official"), cards: open.filter((card) => card.kind === "official" && card.days > 14) },
    { label: t("startFlow.short"), cards: open.filter((card) => card.kind === "official" && card.days <= 14) },
    { label: t("startFlow.creator"), cards: open.filter((card) => card.kind === "creator") },
  ];
  const inviteCard = selected && selected.code === code && !open.some((card) => card.id === selected.id) ? selected : null;
  const inviteError = code && !INVITE_CODE.test(code) ? t("landing.codeHint")
    : invite.isError ? t("common.error")
    : invite.data?.ended ? t("batch6.challengeClosed")
    : invite.data?.full ? t("batch6.full")
    : "";

  function startPersonalChallenge() {
    if (!pickedTemplates.length) return;
    void continueToAuth({
      challenge: {
        kind: "personal",
        name: t("startFlow.personalName", { n: days }),
        days,
        habits: pickedTemplates.map((item) => ({ key: item.key, target: Number(item.default_target) })),
      },
      play: { mode: "solo" },
    });
  }

  function joinSelectedChallenge() {
    if (!selected) return;
    const play = playMode === "code" ? { mode: playMode, code: crewCode } : { mode: playMode };
    if (selected.kind === "official") {
      void continueToAuth({ challenge: { kind: "official", seasonId: selected.season_id }, play });
    } else if (selected.code) {
      void continueToAuth({ challenge: { kind: "creator", code: selected.code }, play });
    }
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-[980px] flex-col gap-6 px-5 pb-7 pt-4 sm:px-8">
      <PublicHeader lang={lang} onLanguage={(next) => void nav({ to: "/start", search: { lang: next, code: code || undefined, season }, replace: true })} />

      {step === "challenge" ? (
        <>
          <section className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 ref={heading} tabIndex={-1} className="text-[clamp(2.15rem,6vw,3.8rem)] font-extrabold leading-tight tracking-tight">{t("startFlow.pickTitle")}</h1>
              <p className="mt-2 max-w-[53ch] text-base font-semibold text-design-body">{t("startFlow.pickSub")}</p>
            </div>
            <InviteCodeButton lang={lang} onSubmit={enterCode} />
          </section>
          {invite.isLoading && <p role="status" className="font-semibold">{t("common.loading")}</p>}
          {inviteError && <p role="alert" className="rounded-xl bg-yellow p-3 font-bold sticker-border">{inviteError}</p>}
          <div className="grid items-start gap-6 md:grid-cols-[1.6fr_1fr]">
            <section aria-labelledby="open-challenges" className="space-y-4">
              <h2 id="open-challenges" className="text-xl font-extrabold">{t("startFlow.openNow")}</h2>
              {catalogError && <div className="rounded-2xl bg-card p-4 sticker-border">
                <p role="alert" className="font-semibold">{t("startFlow.catalogError")}</p>
                <button type="button" className="min-h-11 font-extrabold underline" onClick={() => void router.invalidate()}>{t("common.retry")}</button>
              </div>}
              {!catalogError && !open.length && !inviteCard && <p className="rounded-2xl bg-card p-4 font-semibold sticker-border">{t("startFlow.noOpen")}</p>}
              {inviteCard && <ChallengeChoice card={inviteCard} lang={lang} selected onSelect={() => selectCard(inviteCard)} />}
              {challengeSections.map(({ label, cards }) => cards.length > 0 && (
                <section key={label} className="space-y-2.5">
                  <h3 className="text-sm font-extrabold text-design-muted">{label}</h3>
                  {cards.map((card) => <ChallengeChoice key={card.id} card={card} lang={lang} selected={selected?.id === card.id || (!!selected?.code && selected.code === card.code)} onSelect={() => selectCard(card)} />)}
                </section>
              ))}
              <p className="text-sm font-semibold text-design-muted">{t("startFlow.oneAtATime")}</p>
            </section>
            <aside className="space-y-5">
              <button type="button" className="press w-full rounded-2xl bg-yellow p-4 text-start sticker-border shadow-hard" onClick={() => { setSelected(null); setStep("personal"); }}>
                <span className="flex items-center gap-2 text-lg font-extrabold"><Lock className="size-5 shrink-0" aria-hidden="true" />{t("startFlow.personal")}</span>
                <span className="mt-1 block text-sm font-semibold">{t("startFlow.personalPrivate")}</span>
                <span className="mt-3 flex items-center gap-2 text-sm font-extrabold">{t("startFlow.pickHabits")}<ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" /></span>
              </button>
              {upcoming.length > 0 && <section aria-labelledby="upcoming-events" className="space-y-2">
                <h2 id="upcoming-events" className="text-lg font-extrabold">{t("socialDesign.upcoming")}</h2>
                <ul className="divide-y divide-ink/20 rounded-2xl bg-card px-4 sticker-border">
                  {upcoming.map((card) => (
                    <li key={card.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-3">
                      <span className="font-extrabold">{loc(card.name, lang)}</span>
                      <time dateTime={card.starts_on} className="text-sm font-semibold text-design-muted">
                        {t("startFlow.opensOn", { date: formatDayMonth(card.starts_on, lang) })}
                      </time>
                    </li>
                  ))}
                </ul>
              </section>}
            </aside>
          </div>
          {selected && <div className="sticky bottom-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-card p-3 sticker-border shadow-hard">
            <p className="px-2 text-sm font-extrabold">{loc(selected.name, lang)}</p>
            <StickerButton className="max-sm:w-full" onClick={() => setStep("play")}>
              {t("startFlow.chooseMode")}<ArrowRight className="size-5 rtl:rotate-180" aria-hidden="true" />
            </StickerButton>
          </div>}
        </>
      ) : step === "invite" ? (
        <section className="mx-auto w-full max-w-lg space-y-4 rounded-3xl bg-yellow p-5 sticker-border shadow-hard">
          <StepHeading heading={heading} title={t("startFlow.inviteTitle")} back={t("common.back")} onBack={() => enterCode()} />
          <Num className="block text-center text-[32px] tracking-[0.25em]">{code}</Num>
          <p className="font-semibold">{t("startFlow.inviteCrewBody")}</p>
          <StickerButton block size="lg" disabled={busy || !INVITE_CODE.test(code)} onClick={() => void continueToAuth({ challenge: { kind: "crew_invite", code } })}>
            {t("startFlow.joinInvite")}<ArrowRight className="size-5 rtl:rotate-180" aria-hidden="true" />
          </StickerButton>
        </section>
      ) : step === "personal" ? (
        <section className="mx-auto w-full max-w-[620px] space-y-5">
          <StepHeading heading={heading} title={t("startFlow.personal")} back={t("common.back")} onBack={() => setStep("challenge")} />
          <p className="font-semibold text-design-body">{t("startFlow.personalHint")}</p>
          <fieldset className="space-y-2">
            <legend className="font-extrabold">{t("startFlow.duration")}</legend>
            <div className="flex flex-wrap gap-2">{DURATIONS.map((n) => <button key={n} type="button" aria-pressed={days === n} onClick={() => setDays(n)} className={`min-h-11 rounded-full px-4 font-extrabold sticker-border ${days === n ? "bg-lime shadow-hard-sm" : "bg-card"}`}>{t("batch6.days", { n })}</button>)}</div>
          </fieldset>
          <div className="flex items-center justify-between gap-2"><h2 className="font-extrabold">{t("startFlow.pickHabits")}</h2><Num className="rounded-full bg-ink px-3 py-1 text-lime">{picked.length}/{MAX_CHALLENGE_HABITS}</Num></div>
          {templates.isLoading && <p role="status">{t("common.loading")}</p>}
          {templates.isError && <div role="alert"><p>{t("common.error")}</p><button type="button" className="min-h-11 font-extrabold underline" onClick={() => void templates.refetch()}>{t("common.retry")}</button></div>}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{templatesList.map((item) => {
            const on = picked.includes(item.key);
            return (
              <Tile key={item.id} className="h-auto min-h-24 gap-2 disabled:opacity-65" selected={on} aria-pressed={on} disabled={!on && picked.length >= MAX_CHALLENGE_HABITS} onClick={() => setPicked((items) => toggleStartHabit(items, item.key))}>
                <span className="flex w-full items-center justify-between gap-1"><HabitIcon name={item.icon} className="size-6" />{on && <Check className="size-5" aria-hidden="true" />}</span>
                <span className="text-sm font-extrabold">{loc(item.name, lang)}</span>
                <span className="text-xs font-semibold text-design-body">{loc(item.what_counts, lang) || loc(item.description, lang)}</span>
              </Tile>
            );
          })}</div>
          <div className="sticky bottom-0 space-y-1 rounded-2xl bg-card p-3 sticker-border shadow-hard">
            <StickerButton block disabled={busy || !pickedTemplates.length} onClick={startPersonalChallenge}>{t("startFlow.joinInvite")}<ArrowRight className="size-5 rtl:rotate-180" aria-hidden="true" /></StickerButton>
            <p className="text-center text-sm font-semibold text-design-muted">{t("startFlow.personalSoloHint")}</p>
          </div>
        </section>
      ) : (
        <section className="mx-auto w-full max-w-[620px] space-y-5">
          <StepHeading heading={heading} title={t("startFlow.playTitle")} back={t("common.back")} onBack={() => setStep("challenge")} />
          {selected && <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-yellow p-4 font-extrabold sticker-border">
            <span>{loc(selected.name, lang)}</span><span className="text-sm">{t("batch6.days", { n: selected.days })}</span>
          </div>}
          <div className="grid grid-cols-2 gap-3">
            {(Object.keys(PLAY_OPTIONS) as PlayMode[]).map((mode) => {
              const Icon = PLAY_OPTIONS[mode];
              return <button key={mode} type="button" aria-pressed={playMode === mode} onClick={() => setPlayMode(mode)} className={`press space-y-1 rounded-2xl p-3 text-start sticker-border ${playMode === mode ? "bg-lime shadow-hard" : "bg-card"}`}>
                <Icon className="mb-1 size-5" aria-hidden="true" />
                <span className="block font-extrabold">{t(`startFlow.${mode}`)}</span>
                <span className="block text-sm font-semibold">{t(`startFlow.playHints.${mode}`)}</span>
              </button>;
            })}
          </div>
          {playMode === "code" && <Field label={t("startFlow.codeHint")}>
            <input dir="ltr" value={crewCode} maxLength={6} autoCapitalize="characters" onChange={(event) => setCrewCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} className={`${inputCls} num text-center text-[24px] tracking-[0.25em]`} />
          </Field>}
          <StickerButton block size="lg" disabled={busy || (playMode === "code" && !INVITE_CODE.test(crewCode))} onClick={joinSelectedChallenge}>
            {t("startFlow.joinInvite")}<ArrowRight className="size-5 rtl:rotate-180" aria-hidden="true" />
          </StickerButton>
        </section>
      )}
    </main>
  );
}

function StepHeading({ heading, title, back, onBack }: { heading: React.RefObject<HTMLHeadingElement | null>; title: string; back: string; onBack: () => void }) {
  return <div className="flex items-center gap-3">
    <StickerButton variant="secondary" className="size-11 min-h-11 shrink-0 p-0" aria-label={back} onClick={onBack}><ArrowLeft className="size-5 rtl:rotate-180" aria-hidden="true" /></StickerButton>
    <h1 ref={heading} tabIndex={-1} className="text-2xl font-extrabold sm:text-3xl">{title}</h1>
  </div>;
}

function ChallengeChoice({ card, selected, onSelect, lang }: { card: CatalogCard; selected: boolean; onSelect: () => void; lang: Lang }) {
  const t = i18n.getFixedT(lang);
  return (
    <button type="button" aria-pressed={selected} onClick={onSelect} className={`press w-full rounded-2xl p-4 text-start sticker-border ${selected ? "bg-lime shadow-hard" : "bg-card"}`}>
      <span className="flex items-start justify-between gap-2">
        <span className="min-w-0">
          <span className="block break-words text-lg font-extrabold">{loc(card.name, lang)}</span>
          {card.kind === "creator" && card.creator && <span className="block text-xs font-bold">{t("batch6.creatorLabel", { name: `@${card.creator.replace(/^@/, "")}` })}</span>}
        </span>
        <span className="flex shrink-0 items-center gap-1 rounded-lg bg-yellow px-2 py-1 text-xs font-extrabold sticker-border">{selected && <Check className="size-4" aria-hidden="true" />}{t("batch6.days", { n: card.days })}</span>
      </span>
      <span className="mt-1.5 flex items-center gap-2 text-sm font-semibold">
        <CalendarDays className="size-4 shrink-0" aria-hidden="true" />
        {formatDayMonth(card.starts_on, lang)} – {formatDayMonth(card.ends_on, lang)}
      </span>
      {card.habits.length > 0 && <span className="mt-2.5 flex flex-wrap gap-1.5">{card.habits.map((habit) => <span key={habit.key} className="rounded-lg bg-background px-2 py-1 text-xs font-bold sticker-border">{loc(habit.name, lang)}</span>)}</span>}
    </button>
  );
}
