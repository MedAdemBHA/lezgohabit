import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  Image,
  Lock,
  Mail,
  Share2,
  Sparkles,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/lezgo/app-shell";
import { Num, StickerButton } from "@/components/lezgo/ui";
import { exportCard } from "@/components/lezgo/sharing/export-card";
import { activeSeasonQuery } from "@/lib/data";
import { wrappedQuery, type Wrapped } from "@/lib/batch6-data";
import { formatDayMonth, loc } from "@/lib/i18n";
import { pageHead } from "@/lib/page-head";
import { isSeasonId, seasonSearch } from "@/lib/season-id";
import { signatureQuery } from "@/lib/signature-data";
import { daysBetween } from "@/lib/time";

export const Route = createFileRoute("/_authenticated/wrapped")({
  validateSearch: (s: Record<string, unknown>) => ({ season: seasonSearch(s["season"]) }),
  head: () =>
    pageHead(
      "Your Wrapped — lezgo",
      "Your habit highlights, season stats and private time capsule.",
    ),
  component: WrappedPage,
});

function WrappedPage() {
  const { t, i18n } = useTranslation();
  const { user } = Route.useRouteContext();
  const { season: requested } = Route.useSearch();
  const active = useQuery({ ...activeSeasonQuery(user.id), enabled: !requested });
  const sid = requested || active.data?.id || "";
  const valid = isSeasonId(sid);
  const recap = useQuery({
    ...wrappedQuery(user.id, sid),
    enabled: valid,
    refetchOnWindowFocus: true,
    refetchInterval: (query) => (query.state.data?.locked ? 60_000 : false),
  });
  const signature = useQuery({
    ...signatureQuery(user.id, sid),
    enabled: !!recap.data,
    refetchInterval: false,
  });
  const data = recap.data;
  const capsule = signature.data?.capsule;
  const closes = signature.data?.closes;
  const opensOn = data?.ends_on;
  const retry = !requested && !sid ? active : recap;

  return (
    <AppShell todayLayout>
      <div className="wrapped-page">
        <header className="wrapped-page-header">
          <Link to="/seasons" className="wrapped-back press" aria-label={t("common.back")}>
            <ArrowLeft size={22} className="rtl:-scale-x-100" aria-hidden="true" />
          </Link>
          <h1>{t("batch6.wrapped")}</h1>
        </header>
        {(!requested && active.isPending) || (valid && recap.isPending) ? (
          <section className="wrapped-state" aria-busy="true" role="status">
            <span className="wrapped-state-icon">
              <Sparkles aria-hidden="true" />
            </span>
            <h2>{t("wrapped.loading")}</h2>
          </section>
        ) : data?.locked ? (
          <section className="wrapped-locked">
            <div className="wrapped-locked-art" aria-hidden="true">
              <Sparkles className="wrapped-locked-spark" size={30} />
              <div className="wrapped-locked-icon">
                <Lock size={40} strokeWidth={2.5} />
              </div>
            </div>
            <h2>{t("wrapped.locked")}</h2>
            {opensOn && (
              <p className="wrapped-date">
                <CalendarDays size={18} aria-hidden="true" />
                {t("batch6.wrappedLocked", { date: formatDayMonth(opensOn, i18n.language) })}
              </p>
            )}
            <p>{t("wrapped.lockedBody")}</p>
          </section>
        ) : data?.season ? (
          <WrappedRecap key={sid} data={data} season={data.season} />
        ) : retry.isError || data ? (
          <section className="wrapped-state" aria-live="polite">
            <span className="wrapped-state-icon">
              <Image aria-hidden="true" />
            </span>
            <h2>{t("wrapped.error")}</h2>
            <p>{t("wrapped.errorBody")}</p>
            <StickerButton
              block
              variant="lime"
              disabled={retry.isFetching}
              onClick={() => void retry.refetch()}
            >
              {t(retry.isFetching ? "common.loading" : "common.retry")}
            </StickerButton>
          </section>
        ) : (
          <section className="wrapped-state">
            <span className="wrapped-state-icon">
              <Trophy aria-hidden="true" />
            </span>
            <h2>{t(sid ? "wrapped.unavailable" : "wrapped.noSeason")}</h2>
            <p>{t(sid ? "wrapped.unavailableBody" : "wrapped.noSeasonBody")}</p>
            <Link className="wrapped-action press" to="/challenges" search={{ season: "" }}>
              {t("challengeHistory.title")}
            </Link>
            <Link className="wrapped-text-link" to="/start">
              {t("challengeHistory.pickNext")}
            </Link>
          </section>
        )}

        {data && capsule && (data.locked || capsule.sealed) && (
          <section className="wrapped-capsule">
            <span className="wrapped-state-icon">
              <Mail size={23} aria-hidden="true" />
            </span>
            <div>
              <h2>{t("wrapped.capsule")}</h2>
              <p>{t(capsule.locked ? "wrapped.capsuleSealed" : "wrapped.capsulePrivate")}</p>
              <Link className="wrapped-text-link" to="/capsule" search={{ season: sid }}>
                {t(capsule.sealed ? "wrapped.viewCapsule" : "wrapped.writeCapsule")}
              </Link>
            </div>
          </section>
        )}

        {!!data && !!closes?.length && (
          <details className="wrapped-moods">
            <summary>
              {t("batch8.moods")}
              <ChevronDown size={20} aria-hidden="true" />
            </summary>
            <ul>
              {closes.map((close) => (
                <li key={close.day}>
                  <time dateTime={close.day}>{formatDayMonth(close.day, i18n.language)}</time>
                  <span>{t(`batch8.${close.mood}`)}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </AppShell>
  );
}

function WrappedRecap({ data, season }: { data: Wrapped; season: NonNullable<Wrapped["season"]> }) {
  const { t, i18n } = useTranslation();
  const [square, setSquare] = useState(false);
  const [busy, setBusy] = useState(false);
  const card = useRef<HTMLElement>(null);
  const number = new Intl.NumberFormat(i18n.language === "aeb" ? "ar-TN" : i18n.language, {
    maximumFractionDigits: 1,
  });
  const name = loc(season.name, i18n.language) || t("wrapped.recap");
  const length = daysBetween(season.starts_on, season.ends_on) + 1;
  const days = data.days ?? 0;
  const rank =
    (season.challenge_owned ? data.result?.rank_challenge : data.result?.rank_country) ?? data.rank;
  const result = data.result;
  const metrics = [
    ...(result
      ? [
          { label: t("challengeHistory.points"), value: number.format(result.score) },
          { label: t("profile.bestStreak"), value: number.format(result.best_streak) },
        ]
      : []),
    ...(rank != null
      ? [
          {
            label: t(season.challenge_owned ? "challengeHistory.rank" : "wrapped.countryRank"),
            value: `#${number.format(rank)}`,
          },
        ]
      : []),
  ];
  const habits = (data.stats ?? []).flatMap((stat) => {
    const label = loc(stat.name, i18n.language);
    if (!label || !Number.isFinite(stat.value) || stat.value <= 0) return [];
    const minutes = Math.round(stat.value * 60);
    const value =
      stat.key === "sleep" || stat.key === "sleep7"
        ? t("wrapped.duration", {
            h: number.format(Math.floor(minutes / 60)),
            m: number.format(minutes % 60),
          })
        : [number.format(stat.value), stat.kind === "count" ? stat.unit : null]
            .filter(Boolean)
            .join(" ");
    return [{ key: stat.key, label, value }];
  });
  const highlights = [
    ...(result
      ? [
          {
            key: "perfect-days",
            label: t("challengeHistory.perfectDays"),
            value: number.format(result.perfect_days),
          },
        ]
      : []),
    ...habits,
    ...((data.lift_days ?? 0) > 0
      ? [
          {
            key: "lift-days",
            label: t("batch6.workouts"),
            value: number.format(data.lift_days ?? 0),
          },
        ]
      : []),
    ...((data.bosses_total ?? 0) > 0
      ? [
          {
            key: "bosses",
            label: t("batch6.bosses"),
            value: `${number.format(data.bosses_done ?? 0)}/${number.format(data.bosses_total ?? 0)}`,
          },
        ]
      : []),
  ];

  async function share() {
    if (!card.current || busy) return;
    setBusy(true);
    try {
      await exportCard(card.current, `lezgo-wrapped-${season.ends_on}`, square);
    } catch {
      toast.error(t("batch6.exportError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section
        ref={card}
        className={`wrapped-poster${square ? " square" : ""}`}
        aria-label={t("wrapped.recap")}
      >
        <div className="wrapped-poster-top">
          <span>{t("batch6.wrapped")}</span>
          {data.handle && <bdi dir="ltr">@{data.handle}</bdi>}
        </div>
        <div className="wrapped-poster-title">
          <Sparkles className="wrapped-poster-spark" size={31} aria-hidden="true" />
          <h2>{name}</h2>
          <p>
            <time dateTime={season.starts_on}>
              {formatDayMonth(season.starts_on, i18n.language)}
            </time>
            {" – "}
            <time dateTime={season.ends_on}>{formatDayMonth(season.ends_on, i18n.language)}</time>
            {" · "}
            <Num>{season.ends_on.slice(0, 4)}</Num>
          </p>
        </div>
        <div className="wrapped-attendance">
          <Num>
            {number.format(days)}
            <span> / {number.format(length)}</span>
          </Num>
          <span>{t("batch6.showedUp")}</span>
        </div>
        {!!metrics.length && (
          <dl className="wrapped-metrics">
            {metrics.map(({ label, value }) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>
                  <Num>{value}</Num>
                </dd>
              </div>
            ))}
          </dl>
        )}
        <footer className="wrapped-poster-footer">
          <span>{data.crew ? t("batch6.crew", { name: data.crew.name }) : t("batch6.solo")}</span>
          <span className="share-brand">
            lez<span>go</span>
          </span>
        </footer>
      </section>

      <section className="wrapped-share">
        <h2>{t("wrapped.share")}</h2>
        <div className="export-modes" role="group" aria-label={t("wrapped.format")}>
          {[false, true].map((sq) => (
            <StickerButton
              key={String(sq)}
              variant={sq === square ? "lime" : "secondary"}
              size="sm"
              onClick={() => setSquare(sq)}
              aria-pressed={sq === square}
              disabled={busy}
            >
              {t(sq ? "batch6.square" : "batch6.portrait")}
            </StickerButton>
          ))}
        </div>
        <StickerButton block variant="lime" disabled={busy} onClick={() => void share()}>
          <Share2 size={19} aria-hidden="true" />
          {t(busy ? "wrapped.exporting" : "batch6.shareCard")}
        </StickerButton>
      </section>

      <section className="wrapped-highlights">
        <h2>{t("wrapped.highlights")}</h2>
        {highlights.length ? (
          <dl>
            {highlights.map(({ key, label, value }) => (
              <div key={key}>
                <dt>{label}</dt>
                <dd>
                  <Num>{value}</Num>
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p>{t("wrapped.noHighlights")}</p>
        )}
      </section>
    </>
  );
}
