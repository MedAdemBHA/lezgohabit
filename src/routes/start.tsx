import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronRight,
  CircleHelp,
  Lock,
  Plus,
  Ticket,
  User,
  Users,
} from "lucide-react";
import {
  ChallengeDates,
  ChallengeHabits,
  InviteCodeButton,
  PublicHeader,
  usePublicLanguage,
} from "@/components/lezgo/public-entry";
import { HabitIcon } from "@/components/lezgo/habit-icon";
import { AppShell } from "@/components/lezgo/app-shell";
import { BottomSheet, Field, Num, StickerButton, Tile, inputCls } from "@/components/lezgo/ui";
import {
  challengePreview,
  crewInvitePreview,
  publicChallengeCatalog,
} from "@/lib/challenge-preview.functions";
import { groupCatalog, inviteBlock, type CatalogCard } from "@/lib/challenge-catalog";
import { errKey, templatesQuery, useBase, type Template } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";
import { planFor } from "@/lib/challenge-plan";
import { challengeHistoryQuery } from "@/lib/challenge-history";
import { joinErrorKey } from "@/lib/event-data";
import i18n, { formatDayMonth, loc, numberLocale, selectLang, type Lang } from "@/lib/i18n";
import { pageHead } from "@/lib/page-head";
import {
  MAX_CHALLENGE_HABITS,
  clearStartFlow,
  finishStartFlow,
  saveStartFlow,
  toggleStartHabit,
  type StartFlow,
} from "@/lib/start-flow";

type Step = "challenge" | "personal" | "play";
const PLAY_OPTIONS = { solo: User, find: Users, create: Plus, code: Ticket };
type PlayMode = keyof typeof PLAY_OPTIONS;
const INVITE_CODE = /^[A-Z0-9]{6}$/;
const DURATIONS = [7, 14, 21, 30, 40, 66, 90];

export const Route = createFileRoute("/start")({
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    code?: string | undefined;
    season?: string | undefined;
    remind?: string | undefined;
    lang?: Lang | undefined;
  } => ({
    code: typeof search["code"] === "string" ? search["code"].trim().toUpperCase() : undefined,
    season: typeof search["season"] === "string" ? search["season"] : undefined,
    remind: typeof search["remind"] === "string" ? search["remind"] : undefined,
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
    return pageHead(`${t("startFlow.pickTitle")} · lezgo`, t("startFlow.pickSub"), {
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
  const { lang: requestedLang, code = "", season, remind } = Route.useSearch();
  const lang = usePublicLanguage(requestedLang);
  const { open, upcoming, catalogError } = Route.useLoaderData();
  const t = i18n.getFixedT(lang);
  const nav = useNavigate();
  const router = useRouter();
  const suggested = open.find((card) => card.season_id === season) ?? null;
  const [step, setStep] = useState<Step>("challenge");
  const [selected, setSelected] = useState<CatalogCard | null>(null);
  const [days, setDays] = useState(7);
  const [picked, setPicked] = useState<string[]>([]);
  const [playMode, setPlayMode] = useState<PlayMode>("solo");
  const [crewCode, setCrewCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<StartFlow | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const upcomingCard = upcoming.find((card) => card.season_id === remind);
  const qc = useQueryClient();
  const { user, profile, today } = useBase();
  // Signed-in, onboarded players stay inside the app: bottom nav, no "Sign in" button.
  const inApp = !!user && !!profile?.onboarded;
  // The viewer's own status per challenge, so left/finished ones aren't offered again.
  const history = useQuery({ ...challengeHistoryQuery(user?.id ?? ""), enabled: !!user });
  const statusBySeason = new Map(
    (history.data ?? []).map((entry) => [entry.season_id, entry.status]),
  );
  const heading = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(step);
  const templates = useQuery({ ...templatesQuery, enabled: step === "personal" });
  const invite = useQuery({
    queryKey: ["startInvite", code],
    enabled: INVITE_CODE.test(code),
    queryFn: async () => {
      const creator = await challengePreview({ data: code });
      if (creator) return { kind: "creator" as const, preview: creator };
      const crew = await crewInvitePreview({ data: code });
      return crew ? { kind: "crew" as const, preview: crew } : null;
    },
    retry: false,
  });
  const crewInvite = useQuery({
    queryKey: ["startCrewInvite", crewCode],
    enabled: step === "play" && playMode === "code" && INVITE_CODE.test(crewCode),
    queryFn: () => crewInvitePreview({ data: crewCode }),
    retry: false,
  });

  useEffect(() => {
    if (previousStep.current === step) return;
    previousStep.current = step;
    heading.current?.focus();
  }, [step]);

  function enterCode(nextCode: string) {
    if (nextCode === code) {
      void invite.refetch();
      return;
    }
    setSelected(null);
    setStep("challenge");
    void nav({ to: "/start", search: { code: nextCode, lang } });
  }

  function selectUpcoming(next?: string) {
    void nav({
      to: "/start",
      search: { code: code || undefined, lang, season, remind: next },
      replace: !next,
    });
  }

  function selectCard(card: CatalogCard) {
    setSelected(card);
    setPlayMode("solo");
    setCrewCode("");
    setStep("play");
  }

  async function continueToAuth(flow: StartFlow) {
    if (busy || user === undefined) return;
    // Signed-in players never go through /auth: they confirm a summary and join right here.
    if (user) {
      setJoinError(null);
      setConfirm(flow);
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

  const templatesList = (templates.data ?? []).filter(
    (item) => !item.is_faith && item.key !== "custom",
  );
  const pickedTemplates = picked
    .map((key) => templatesList.find((item) => item.key === key))
    .filter((item): item is Template => !!item);
  const blocked = invite.data ? inviteBlock(invite.data.preview, invite.data.kind) : null;
  const preview = invite.data?.kind === "creator" ? invite.data.preview : null;
  const directCrew = !blocked && invite.data?.kind === "crew" ? invite.data.preview : null;
  const crewCodeBlock = crewInvite.data ? inviteBlock(crewInvite.data, "crew") : null;
  const crewCodeError = crewInvite.isError
    ? "events.inviteUnavailable"
    : crewInvite.data === null
      ? "events.invalidCode"
      : crewCodeBlock;
  const inviteCard: CatalogCard | null =
    preview && !blocked
      ? (open.find((card) => card.code === code) ?? {
          ...preview,
          kind: "creator",
          name: { en: preview.name },
        })
      : null;
  const highlighted = inviteCard ?? suggested;
  const visibleCards = highlighted
    ? [highlighted, ...open.filter((card) => card.season_id !== highlighted.season_id)]
    : open;
  const inviteError =
    code && !INVITE_CODE.test(code)
      ? t("landing.codeHint")
      : invite.isError
        ? t("events.inviteUnavailable")
        : invite.data === null
          ? t("events.invalidCode")
          : blocked
            ? t(blocked)
            : "";

  const joinLabel = (name: string) =>
    user ? t("ux.joinChallenge", { name }) : t("startFlow.joinInvite");

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
      clearStartFlow();
      // crew_setup_pending: the challenge was joined; only the crew step failed.
      if (key === "crew_setup_pending") await qc.invalidateQueries();
      setJoinError(key);
    } finally {
      setBusy(false);
    }
  }

  const confirmCard = confirm && "play" in confirm ? selected : null;
  const confirmCrew =
    confirm?.challenge.kind === "crew_invite"
      ? step === "play"
        ? crewInvite.data
        : directCrew
      : null;
  const confirmName = confirm
    ? confirm.challenge.kind === "personal"
      ? t("startFlow.personalName", { n: days })
      : confirm.challenge.kind === "crew_invite"
        ? (confirmCrew?.name ?? confirm.challenge.code)
        : loc(confirmCard?.name, lang)
    : "";

  function startPersonalChallenge() {
    if (!pickedTemplates.length) return;
    void continueToAuth({
      challenge: {
        kind: "personal",
        name: t("startFlow.personalName", { n: days }),
        days,
        habits: pickedTemplates.map((item) => ({
          key: item.key,
          target: Number(item.default_target),
        })),
      },
      play: { mode: "solo" },
    });
  }

  function joinSelectedChallenge() {
    if (!selected) return;
    if (playMode === "code") {
      if (!crewInvite.data || crewCodeError) return;
      void continueToAuth({ challenge: { kind: "crew_invite", code: crewCode } });
      return;
    }
    const play = { mode: playMode };
    if (selected.kind === "official") {
      void continueToAuth({ challenge: { kind: "official", seasonId: selected.season_id }, play });
    } else if (selected.code) {
      void continueToAuth({ challenge: { kind: "creator", code: selected.code }, play });
    }
  }

  const page = (
    <div className={`public-site${inApp ? " public-site-in-app" : ""}`}>
      <div className="public-wrap">
        <PublicHeader
          lang={lang}
          signedIn={!!user}
          onBrowse={() => setStep("challenge")}
          onLanguage={(next) =>
            void nav({
              to: "/start",
              search: { lang: next, code: code || undefined, season, remind },
              replace: true,
            })
          }
        />

        <main className="catalog-page">
          {step === "challenge" ? (
            <>
              <section className="catalog-intro">
                <div>
                  <h1 ref={heading} tabIndex={-1}>
                    {t("startFlow.pickTitle")}
                  </h1>
                  <p>{t("startFlow.pickSub")}</p>
                </div>
                <InviteCodeButton lang={lang} onSubmit={enterCode} />
              </section>
              {invite.isLoading && (
                <p role="status" className="font-semibold">
                  {t("common.loading")}
                </p>
              )}
              {inviteError && (
                <div className="catalog-notice">
                  <p role="alert">{inviteError}</p>
                  {invite.isError && (
                    <button
                      type="button"
                      className="min-h-11 font-extrabold underline"
                      onClick={() => void invite.refetch()}
                    >
                      {t("common.retry")}
                    </button>
                  )}
                </div>
              )}
              {directCrew && (
                <section className="catalog-card space-y-3">
                  <h2 className="text-xl font-extrabold">{directCrew.name}</h2>
                  <p className="font-semibold">
                    {loc(directCrew.event, lang)} · {formatDayMonth(directCrew.starts_on, lang)} –{" "}
                    {formatDayMonth(directCrew.ends_on, lang)}
                  </p>
                  <button
                    type="button"
                    className="public-action public-action-primary"
                    disabled={busy || user === undefined}
                    onClick={() =>
                      void continueToAuth({ challenge: { kind: "crew_invite", code } })
                    }
                  >
                    {user ? t("crew.joinBtn") : t("startFlow.joinInvite")}
                  </button>
                </section>
              )}
              <div className="catalog-grid">
                <section id="open-challenges" aria-labelledby="open-title" className="catalog-open">
                  <h2 id="open-title" className="catalog-section-title">
                    <span className="public-status-dot" />
                    {t("startFlow.openNow")}
                  </h2>
                  {catalogError && (
                    <div className="catalog-notice">
                      <p role="alert">{t("startFlow.catalogError")}</p>
                      <button
                        type="button"
                        className="min-h-11 font-extrabold underline"
                        onClick={() => void router.invalidate()}
                      >
                        {t("common.retry")}
                      </button>
                    </div>
                  )}
                  {!catalogError && !visibleCards.length && (
                    <p className="catalog-notice">{t("startFlow.noOpen")}</p>
                  )}
                  {visibleCards.map((card) => (
                    <ChallengeChoice
                      key={card.id}
                      card={card}
                      lang={lang}
                      invited={!!code && card.code === code && !!invite.data && !inviteError}
                      status={statusBySeason.get(card.season_id)}
                      onSelect={() => selectCard(card)}
                    />
                  ))}
                  <p className="catalog-rule">
                    <CircleHelp className="size-4 shrink-0" aria-hidden="true" />
                    {t("startFlow.oneAtATime")}
                  </p>
                </section>
                <aside className="catalog-side">
                  <section className="catalog-personal">
                    <span className="catalog-personal-icon" aria-hidden="true">
                      <Lock className="size-5" />
                    </span>
                    <h2>{t("startFlow.personal")}</h2>
                    <p>{t("startFlow.personalPrivate")}</p>
                    <button
                      type="button"
                      className="public-action public-action-secondary"
                      onClick={() => {
                        setSelected(null);
                        setStep("personal");
                      }}
                    >
                      {t("startFlow.personalAction")}{" "}
                      <ArrowRight className="size-5 rtl:rotate-180" aria-hidden="true" />
                    </button>
                  </section>
                  {upcoming.length > 0 && (
                    <section className="catalog-upcoming" aria-labelledby="upcoming-events">
                      <h2 id="upcoming-events" className="catalog-section-title">
                        <CalendarDays className="size-5 shrink-0" aria-hidden="true" />
                        {t("socialDesign.upcoming")}
                      </h2>
                      <ul>
                        {upcoming.map((card) => (
                          <li key={card.id}>
                            <button
                              type="button"
                              className="catalog-upcoming-open"
                              aria-haspopup="dialog"
                              onClick={() => selectUpcoming(card.season_id)}
                            >
                              <div className="min-w-0 flex-1 break-words">
                                <div className="font-extrabold leading-tight">
                                  {loc(card.name, lang)}
                                </div>
                                <time dateTime={card.starts_on} className="catalog-upcoming-date">
                                  {t("startFlow.opensOn", {
                                    date: formatDayMonth(card.starts_on, lang),
                                  })}
                                </time>
                              </div>
                              <span className="catalog-upcoming-length shrink-0">
                                {t("batch6.days", { n: card.days })}
                              </span>
                              <ChevronRight
                                className="size-4 shrink-0 rtl:rotate-180"
                                aria-hidden="true"
                              />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                </aside>
              </div>
            </>
          ) : step === "personal" ? (
            <section className="public-flow">
              <StepHeading
                heading={heading}
                title={t("startFlow.personal")}
                back={t("common.back")}
                onBack={() => setStep("challenge")}
              />
              <p className="font-semibold text-design-body">{t("startFlow.personalHint")}</p>
              <fieldset className="space-y-2">
                <legend className="font-extrabold">{t("startFlow.duration")}</legend>
                <div className="flex flex-wrap gap-2">
                  {DURATIONS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      aria-pressed={days === n}
                      onClick={() => setDays(n)}
                      className={`min-h-11 rounded-full px-4 font-extrabold sticker-border ${days === n ? "bg-lime shadow-hard-sm" : "bg-card"}`}
                    >
                      {t("batch6.days", { n })}
                    </button>
                  ))}
                </div>
              </fieldset>
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-extrabold">{t("startFlow.pickHabits")}</h2>
                <Num className="rounded-full bg-ink px-3 py-1 text-lime">
                  {picked.length}/{MAX_CHALLENGE_HABITS}
                </Num>
              </div>
              {templates.isLoading && <p role="status">{t("common.loading")}</p>}
              {templates.isError && (
                <div role="alert">
                  <p>{t("common.error")}</p>
                  <button
                    type="button"
                    className="min-h-11 font-extrabold underline"
                    onClick={() => void templates.refetch()}
                  >
                    {t("common.retry")}
                  </button>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                {templatesList.map((item) => {
                  const on = picked.includes(item.key);
                  return (
                    <Tile
                      key={item.id}
                      className="h-auto min-h-24 gap-2 disabled:opacity-65"
                      selected={on}
                      aria-pressed={on}
                      disabled={!on && picked.length >= MAX_CHALLENGE_HABITS}
                      onClick={() => setPicked((items) => toggleStartHabit(items, item.key))}
                    >
                      <span className="flex w-full items-center justify-between gap-1">
                        <HabitIcon name={item.icon} className="size-6" />
                        {on && <Check className="size-5" aria-hidden="true" />}
                      </span>
                      <span className="text-sm font-extrabold">{loc(item.name, lang)}</span>
                      <span className="text-xs font-semibold text-design-body">
                        {loc(item.what_counts, lang) || loc(item.description, lang)}
                      </span>
                    </Tile>
                  );
                })}
              </div>
              <div className="catalog-flow-action">
                <div>
                  <p className="font-extrabold">{t("startFlow.personalName", { n: days })}</p>
                  <p className="text-sm font-medium text-design-muted">
                    {t("startFlow.personalSoloHint")}
                  </p>
                </div>
                <button
                  type="button"
                  className="public-action public-action-primary"
                  disabled={busy || user === undefined || !pickedTemplates.length}
                  onClick={startPersonalChallenge}
                >
                  {joinLabel(t("startFlow.personalName", { n: days }))}
                  <ArrowRight className="size-5 rtl:rotate-180" aria-hidden="true" />
                </button>
              </div>
            </section>
          ) : (
            <section className="public-flow">
              <StepHeading
                heading={heading}
                title={t("startFlow.playTitle")}
                back={t("common.back")}
                onBack={() => setStep("challenge")}
              />
              {selected && playMode !== "code" && (
                <div className="catalog-play-summary">
                  <p className="font-extrabold">{loc(selected.name, lang)}</p>
                  <div className="public-meta">
                    <ChallengeDates card={selected} lang={lang} />
                    <span>{t("batch6.days", { n: selected.days })}</span>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                {(Object.keys(PLAY_OPTIONS) as PlayMode[]).map((mode) => {
                  const Icon = PLAY_OPTIONS[mode];
                  return (
                    <button
                      key={mode}
                      type="button"
                      aria-pressed={playMode === mode}
                      onClick={() => setPlayMode(mode)}
                      className="catalog-play-option"
                    >
                      <Icon className="mb-1 size-5" aria-hidden="true" />
                      <span className="block font-extrabold">{t(`startFlow.${mode}`)}</span>
                      <span className="block text-sm font-semibold">
                        {t(`startFlow.playHints.${mode}`)}
                      </span>
                    </button>
                  );
                })}
              </div>
              {playMode === "code" && (
                <>
                  <Field label={t("startFlow.codeHint")}>
                    <input
                      dir="ltr"
                      value={crewCode}
                      maxLength={6}
                      autoCapitalize="characters"
                      onChange={(event) =>
                        setCrewCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
                      }
                      className={`${inputCls} num text-center text-[24px] tracking-[0.25em]`}
                    />
                  </Field>
                  {crewInvite.isLoading && <p role="status">{t("common.loading")}</p>}
                  {crewCodeError && (
                    <p role="alert" className="catalog-notice">
                      {t(crewCodeError)}
                    </p>
                  )}
                  {crewInvite.data && !crewCodeError && (
                    <div className="catalog-play-summary">
                      <p className="font-extrabold">{crewInvite.data.name}</p>
                      <p>
                        {loc(crewInvite.data.event, lang)} ·{" "}
                        {formatDayMonth(crewInvite.data.starts_on, lang)} –{" "}
                        {formatDayMonth(crewInvite.data.ends_on, lang)}
                      </p>
                    </div>
                  )}
                </>
              )}
              <button
                type="button"
                className="public-action public-action-primary"
                disabled={
                  busy ||
                  user === undefined ||
                  (playMode === "code" && (!crewInvite.data || !!crewCodeError))
                }
                onClick={joinSelectedChallenge}
              >
                {playMode === "code" && user
                  ? t("crew.joinBtn")
                  : joinLabel(loc(selected?.name, lang))}
                <ArrowRight className="size-5 rtl:rotate-180" aria-hidden="true" />
              </button>
            </section>
          )}
        </main>
        <BottomSheet
          open={!!upcomingCard}
          onClose={() => selectUpcoming()}
          title={upcomingCard ? loc(upcomingCard.name, lang) : ""}
        >
          {upcomingCard && (
            <UpcomingDetail card={upcomingCard} uid={user === null ? null : user?.id} lang={lang} />
          )}
        </BottomSheet>
        <BottomSheet
          open={confirm !== null}
          onClose={() => {
            if (!busy) setConfirm(null);
          }}
          title={t("ux.confirmTitle")}
        >
          {confirm && (
            <JoinSummary
              name={confirmName}
              startsOn={
                confirm.challenge.kind === "personal"
                  ? today
                  : (confirmCrew?.starts_on ?? confirmCard?.starts_on ?? today)
              }
              endsOn={
                confirm.challenge.kind === "personal"
                  ? addDaysIso(today, days - 1)
                  : (confirmCrew?.ends_on ?? confirmCard?.ends_on ?? today)
              }
              today={today}
              habits={
                confirm.challenge.kind === "personal"
                  ? picked.length
                  : (confirmCard?.habits.length ?? 0)
              }
              mode={"play" in confirm ? confirm.play.mode : "code"}
              busy={busy}
              error={joinError}
              onConfirm={() => void confirmJoin()}
              onCancel={() => setConfirm(null)}
            />
          )}
        </BottomSheet>
      </div>
    </div>
  );
  return inApp ? <AppShell todayLayout>{page}</AppShell> : page;
}

function StepHeading({
  heading,
  title,
  back,
  onBack,
}: {
  heading: React.RefObject<HTMLHeadingElement | null>;
  title: string;
  back: string;
  onBack: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <StickerButton
        variant="secondary"
        className="size-11 min-h-11 shrink-0 p-0"
        aria-label={back}
        onClick={onBack}
      >
        <ArrowLeft className="size-5 rtl:rotate-180" aria-hidden="true" />
      </StickerButton>
      <h1 ref={heading} tabIndex={-1} className="catalog-flow-title">
        {title}
      </h1>
    </div>
  );
}

function ChallengeChoice({
  card,
  invited,
  onSelect,
  lang,
  status,
}: {
  card: CatalogCard;
  invited: boolean;
  onSelect: () => void;
  lang: Lang;
  status?: string | undefined;
}) {
  const t = i18n.getFixedT(lang);
  const name = loc(card.name, lang);
  // Left or finished challenges can't be joined again: show them muted, with no action.
  const closed = status === "surrendered" || status === "completed";
  return (
    <article className={`catalog-card${closed ? " opacity-60" : ""}`}>
      {status && (
        <span
          className={`mb-2 inline-block rounded-full px-2 py-0.5 text-[12px] font-extrabold ${status === "active" ? "bg-lime" : "bg-background"}`}
        >
          {t(
            status === "surrendered"
              ? "ux.youLeft"
              : status === "completed"
                ? "ux.youFinished"
                : "ux.youreIn",
          )}
        </span>
      )}
      <div className="catalog-card-heading">
        <div>
          <p className="public-caption">
            {t(
              invited
                ? "startFlow.inviteSelected"
                : card.kind === "creator"
                  ? "startFlow.creator"
                  : "startFlow.official",
            )}
          </p>
          <h3>{name}</h3>
          <div className="public-meta">
            <ChallengeDates card={card} lang={lang} />
            {card.kind === "creator" && card.creator && (
              <span>
                {t("batch6.creatorLabel", { name: `@${card.creator.replace(/^@/, "")}` })}
              </span>
            )}
          </div>
        </div>
        <span className="catalog-duration">{t("batch6.days", { n: card.days })}</span>
      </div>
      <div className="catalog-card-body">
        <ChallengeHabits card={card} lang={lang} />
        {status === "active" ? (
          <Link to="/today" className="public-action public-action-primary">
            {t("events.goToday")}
          </Link>
        ) : closed ? null : (
          <button
            type="button"
            className="public-action public-action-primary"
            aria-label={t("startFlow.chooseNamed", { name })}
            onClick={onSelect}
          >
            {t("startFlow.chooseMode")}{" "}
            <ArrowRight className="size-5 rtl:rotate-180" aria-hidden="true" />
          </button>
        )}
      </div>
    </article>
  );
}

/** Upcoming event detail: habits, dates and a reminder (signed-in only; the server keeps the record). */
function UpcomingDetail({
  card,
  uid,
  lang,
}: {
  card: CatalogCard;
  uid: string | null | undefined;
  lang: Lang;
}) {
  const t = i18n.getFixedT(lang);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const queryKey = ["myReminderIds", uid];
  const reminders = useQuery({
    queryKey,
    enabled: !!uid,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_season_reminder_ids");
      if (error) throw error;
      return data ?? [];
    },
  });
  const on = !!reminders.data?.includes(card.season_id);
  const goal = loc(card.goal, lang);
  const next = `/start?${new URLSearchParams({ lang, remind: card.season_id })}`;
  async function toggle() {
    if (busy || !reminders.isSuccess) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("set_season_reminder_by_id", {
        _season_id: card.season_id,
        _on: !on,
      });
      if (error) throw error;
      qc.setQueryData<string[]>(queryKey, (ids = []) =>
        on ? ids.filter((id) => id !== card.season_id) : [...new Set([...ids, card.season_id])],
      );
      toast(t(on ? "ux.reminderOff" : "ux.reminderOn"));
    } catch (error) {
      toast(t(errKey(error) === "guest_read_only" ? "guest.readOnly" : "common.error"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-3">
      <p className="font-semibold">
        {formatDayMonth(card.starts_on, lang)} – {formatDayMonth(card.ends_on, lang)} ·{" "}
        {t("batch6.days", { n: card.days })}
      </p>
      {goal && <p className="font-semibold">{goal}</p>}
      <ul className="space-y-2">
        {card.habits.map((habit) => (
          <li key={habit.key} className="rounded-[14px] bg-card p-3 sticker-border">
            <strong className="block">{loc(habit.name, lang)}</strong>
            <span className="text-[13px] font-semibold">{loc(habit.what_counts, lang)}</span>
          </li>
        ))}
      </ul>
      {uid === undefined ? (
        <p role="status">{t("common.loading")}</p>
      ) : uid && reminders.isError ? (
        <div className="space-y-2">
          <p role="alert">{t("common.error")}</p>
          <StickerButton onClick={() => void reminders.refetch()} variant="secondary">
            {t("common.retry")}
          </StickerButton>
        </div>
      ) : uid ? (
        <StickerButton
          block
          size="lg"
          variant={on ? "secondary" : "lime"}
          disabled={busy || reminders.isPending}
          aria-pressed={on}
          onClick={() => void toggle()}
        >
          {t(
            busy || reminders.isPending ? "common.loading" : on ? "ux.reminderSet" : "ux.remindMe",
          )}
        </StickerButton>
      ) : (
        <Link to="/auth" search={{ next }} className="public-action public-action-primary w-full">
          {t("ux.signInToRemind")}
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

function JoinSummary({
  name,
  startsOn,
  endsOn,
  today,
  habits,
  mode,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  name: string;
  startsOn: string;
  endsOn: string;
  today: string;
  habits: number;
  mode: string;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t, i18n } = useTranslation();
  const plan = planFor(startsOn, endsOn, today, habits);
  const fmt = new Intl.NumberFormat(numberLocale(i18n.language));
  return (
    <div className="space-y-3">
      <p className="text-[20px] font-extrabold">{name}</p>
      <p className="font-semibold">
        {formatDayMonth(startsOn, i18n.language)} – {formatDayMonth(endsOn, i18n.language)}
      </p>
      <ul className="space-y-2 text-[15px] font-semibold">
        <li>
          {plan.day > 1
            ? t("ux.joiningOn", {
                day: fmt.format(plan.day),
                total: fmt.format(plan.total),
                left: fmt.format(plan.left),
              })
            : t("ux.joiningStart", { total: fmt.format(plan.total) })}
        </li>
        {habits > 0 && (
          <li>{t("ux.goodDay", { x: fmt.format(plan.goodHabits), y: fmt.format(habits) })}</li>
        )}
        <li>
          {t(plan.reachable ? "ux.trophyReachable" : "ux.trophyOut", {
            need: fmt.format(plan.need),
          })}
        </li>
        <li>{t("ux.modeLine", { mode: t(`startFlow.${mode}`) })}</li>
        <li className="text-design-muted">{t("ux.oneActive")}</li>
      </ul>
      {error !== null && (
        <div
          role="alert"
          className="space-y-2 rounded-[14px] bg-yellow p-3 font-bold sticker-border"
        >
          <p>{t(joinErrorKey(error))}</p>
          {(error === "crew_setup_pending" || error === "active_challenge_exists") && (
            <Link to="/today" className="public-action public-action-primary">
              {t("events.goToday")}
            </Link>
          )}
        </div>
      )}
      <StickerButton
        block
        size="lg"
        variant="lime"
        disabled={
          busy ||
          error === "crew_setup_pending" ||
          error === "active_challenge_exists" ||
          error === "guest_read_only"
        }
        onClick={onConfirm}
      >
        {t(busy ? "common.loading" : "ux.confirmJoin")}
      </StickerButton>
      <StickerButton block variant="secondary" disabled={busy} onClick={onCancel}>
        {t("common.cancel")}
      </StickerButton>
    </div>
  );
}
