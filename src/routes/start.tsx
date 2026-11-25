import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
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
import { Field, Num, StickerButton, Tile, inputCls } from "@/components/lezgo/ui";
import { challengePreview, publicChallengeCatalog } from "@/lib/challenge-preview.functions";
import { groupCatalog, type CatalogCard } from "@/lib/challenge-catalog";
import { templatesQuery, type Template } from "@/lib/data";
import i18n, { formatDayMonth, loc, selectLang, type Lang } from "@/lib/i18n";
import { pageHead } from "@/lib/page-head";
import {
  MAX_CHALLENGE_HABITS,
  saveStartFlow,
  toggleStartHabit,
  type StartFlow,
} from "@/lib/start-flow";

type Step = "challenge" | "personal" | "play" | "invite";
const PLAY_OPTIONS = { solo: User, find: Users, create: Plus, code: Ticket };
type PlayMode = keyof typeof PLAY_OPTIONS;
const INVITE_CODE = /^[A-Z0-9]{6}$/;
const DURATIONS = [7, 14, 21, 30, 40, 66, 90];

export const Route = createFileRoute("/start")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { code?: string | undefined; season?: string | undefined; lang?: Lang | undefined } => ({
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
  const { lang: requestedLang, code = "", season } = Route.useSearch();
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
  const heading = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(step);
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
    if (code && invite.data === null) setStep("invite");
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
    setStep("play");
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

  const templatesList = (templates.data ?? []).filter(
    (item) => !item.is_faith && item.key !== "custom",
  );
  const pickedTemplates = picked
    .map((key) => templatesList.find((item) => item.key === key))
    .filter((item): item is Template => !!item);
  const preview = invite.data;
  const inviteCard: CatalogCard | null =
    preview && !preview.full && !preview.ended
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
        ? t("common.error")
        : invite.data?.ended
          ? t("batch6.challengeClosed")
          : invite.data?.full
            ? t("batch6.full")
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
    const play = playMode === "code" ? { mode: playMode, code: crewCode } : { mode: playMode };
    if (selected.kind === "official") {
      void continueToAuth({ challenge: { kind: "official", seasonId: selected.season_id }, play });
    } else if (selected.code) {
      void continueToAuth({ challenge: { kind: "creator", code: selected.code }, play });
    }
  }

  return (
    <div className="public-site">
      <div className="public-wrap">
        <PublicHeader
          lang={lang}
          onBrowse={() => setStep("challenge")}
          onLanguage={(next) =>
            void nav({
              to: "/start",
              search: { lang: next, code: code || undefined, season },
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
                <p role="alert" className="catalog-notice">
                  {inviteError}
                </p>
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
                            <div>
                              <div className="font-extrabold leading-tight">
                                {loc(card.name, lang)}
                              </div>
                              <time dateTime={card.starts_on} className="catalog-upcoming-date">
                                {t("startFlow.opensOn", {
                                  date: formatDayMonth(card.starts_on, lang),
                                })}
                              </time>
                            </div>
                            <span className="catalog-upcoming-length">
                              {t("batch6.days", { n: card.days })}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                </aside>
              </div>
            </>
          ) : step === "invite" ? (
            <section className="public-flow catalog-invite">
              <StepHeading
                heading={heading}
                title={t("startFlow.inviteTitle")}
                back={t("common.back")}
                onBack={() => enterCode()}
              />
              <Num className="block text-center text-[32px] tracking-[0.25em]">{code}</Num>
              <p className="font-semibold">{t("startFlow.inviteCrewBody")}</p>
              <StickerButton
                block
                size="lg"
                disabled={busy || !INVITE_CODE.test(code)}
                onClick={() => void continueToAuth({ challenge: { kind: "crew_invite", code } })}
              >
                {t("startFlow.joinInvite")}
                <ArrowRight className="size-5 rtl:rotate-180" aria-hidden="true" />
              </StickerButton>
            </section>
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
                  disabled={busy || !pickedTemplates.length}
                  onClick={startPersonalChallenge}
                >
                  {t("startFlow.joinInvite")}
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
              {selected && (
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
              )}
              <button
                type="button"
                className="public-action public-action-primary"
                disabled={busy || (playMode === "code" && !INVITE_CODE.test(crewCode))}
                onClick={joinSelectedChallenge}
              >
                {t("startFlow.joinInvite")}
                <ArrowRight className="size-5 rtl:rotate-180" aria-hidden="true" />
              </button>
            </section>
          )}
        </main>
      </div>
    </div>
  );
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
}: {
  card: CatalogCard;
  invited: boolean;
  onSelect: () => void;
  lang: Lang;
}) {
  const t = i18n.getFixedT(lang);
  const name = loc(card.name, lang);
  return (
    <article className="catalog-card">
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
        <button
          type="button"
          className="public-action public-action-primary"
          aria-label={t("startFlow.chooseNamed", { name })}
          onClick={onSelect}
        >
          {t("startFlow.chooseMode")}{" "}
          <ArrowRight className="size-5 rtl:rotate-180" aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}
