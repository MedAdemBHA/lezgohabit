import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight, CalendarDays, Flag, Footprints, Trophy } from "lucide-react";
import { AppShell } from "@/components/lezgo/app-shell";
import { ChallengeSurrenderSheet } from "@/components/lezgo/challenge-surrender-sheet";
import { FitHeading } from "@/components/lezgo/fit-heading";
import { Num, StickerButton } from "@/components/lezgo/ui";
import { useBase } from "@/lib/data";
import {
  challengeHistoryQuery,
  possibleDays,
  type ChallengeHistoryEntry,
} from "@/lib/challenge-history";
import { loc, formatDayMonth } from "@/lib/i18n";
import { pageHead } from "@/lib/page-head";

export const Route = createFileRoute("/_authenticated/challenges")({
  validateSearch: (s: Record<string, unknown>) => ({
    season: typeof s["season"] === "string" ? s["season"] : "",
  }),
  head: () => pageHead("My challenges · lezgo", "Your challenge history and progress."),
  component: ChallengesPage,
});

function ChallengesPage() {
  const { t, i18n } = useTranslation();
  const { uid, tz } = useBase();
  const { season: selectedSeason } = Route.useSearch();
  const history = useQuery(challengeHistoryQuery(uid));
  const [surrenderOpen, setSurrenderOpen] = useState(false);
  const entries = history.data ?? [];
  const selected = entries.find((entry) => entry.season_id === selectedSeason);
  const pct = (n: number) => `${Math.round(Number(n) || 0)}%`;

  return (
    <AppShell todayLayout>
      {selected ? (
        <Link to="/challenges" search={{ season: "" }} className="self-start">
          <StickerButton variant="secondary" className="icon-control" aria-label={t("common.back")}>
            <ArrowLeft className="rtl:-scale-x-100" />
          </StickerButton>
        </Link>
      ) : (
        <Link to="/profile" className="self-start">
          <StickerButton variant="secondary" className="icon-control" aria-label={t("common.back")}>
            <ArrowLeft className="rtl:-scale-x-100" />
          </StickerButton>
        </Link>
      )}
      <FitHeading requestedSize={42} className="page-title" text={t("challengeHistory.title")} />
      {history.isLoading ? (
        <p>{t("common.loading")}</p>
      ) : history.isError ? (
        <StickerButton variant="secondary" onClick={() => void history.refetch()}>
          {t("common.error")}
        </StickerButton>
      ) : selected ? (
        <>
          <section className="sticker rounded-[22px] bg-yellow p-4 shadow-hard-lg">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] font-extrabold uppercase tracking-wide">
                  {t(`challengeHistory.kind_${selected.kind}`)}
                  {selected.creator
                    ? ` · ${t("challengeHistory.by", { name: selected.creator })}`
                    : ""}
                </p>
                <h1 className="mt-1 break-words text-[24px] font-extrabold leading-tight">
                  {selected.name}
                </h1>
              </div>
              <span className="shrink-0 rounded-full bg-card px-3 py-1 text-[13px] font-extrabold sticker-border">
                {t(
                  selected.end_reason === "moderation"
                    ? "events.removed"
                    : `challengeHistory.status_${selected.status}`,
                )}
              </span>
            </div>
            <div className="mt-4 flex items-center gap-2 text-[13px] font-bold">
              <CalendarDays size={18} />
              <span>
                {formatDayMonth(selected.start_date, i18n.language)} —{" "}
                {formatDayMonth(selected.end_date, i18n.language)}
              </span>
              <span>·</span>
              <Num>
                {t("challengeHistory.days", {
                  done: selected.completed_days,
                  total: possibleDays(selected, tz).possible,
                })}
              </Num>
            </div>
            <p className="mt-2 text-[13px] font-bold">
              {t("ux.trophyTarget", { need: possibleDays(selected, tz).trophy })}
            </p>
            {selected.crew && (
              <p className="mt-3 text-[13px] font-bold">
                {t("challengeHistory.crew", { name: selected.crew.name })}
              </p>
            )}
          </section>

          <section className="grid grid-cols-2 gap-3">
            <Stat
              icon={<Footprints size={18} />}
              label={t("challengeHistory.consistency")}
              value={pct(selected.consistency)}
            />
            <Stat
              icon={<Trophy size={18} />}
              label={t("challengeHistory.points")}
              value={<Num>{selected.points}</Num>}
            />
            <Stat
              icon={<Flag size={18} />}
              label={t("challengeHistory.perfectDays")}
              value={<Num>{selected.perfect_days}</Num>}
            />
            <Stat
              icon={<Trophy size={18} />}
              label={t("challengeHistory.rank")}
              value={selected.rank ? `#${selected.rank}` : "—"}
            />
          </section>

          <section className="mt-4 space-y-2">
            <h2 className="text-[18px] font-extrabold">{t("challengeHistory.habits")}</h2>
            {selected.habits.map((habit) => (
              <article
                key={habit.key}
                className="rounded-[18px] bg-card p-4 sticker-border shadow-hard-sm"
              >
                <h3 className="font-extrabold">{loc(habit.name, i18n.language) || habit.key}</h3>
                <p className="mt-1 text-[14px] font-semibold text-design-muted">
                  {loc(habit.what_counts, i18n.language)}
                </p>
              </article>
            ))}
          </section>

          <Link to="/trail" search={{ season: selected.season_id }} className="mt-4 block">
            <StickerButton block variant="secondary">
              {t("challengeHistory.openTrail")}{" "}
              <ArrowRight className="rtl:-scale-x-100" size={18} />
            </StickerButton>
          </Link>
          <Link
            className="wrapped-action press"
            to="/wrapped"
            search={{ season: selected.season_id }}
          >
            {t("batch6.wrapped")}
          </Link>
          {selected.status === "active" && (
            <StickerButton
              block
              variant="secondary"
              className="mt-3 text-destructive"
              onClick={() => setSurrenderOpen(true)}
            >
              {t("challengeHistory.surrender")}
            </StickerButton>
          )}
          <ChallengeSurrenderSheet
            seasonId={selected.season_id}
            name={selected.name}
            open={surrenderOpen}
            onClose={() => setSurrenderOpen(false)}
          />
        </>
      ) : entries.length ? (
        <div className="space-y-3">
          {entries.map((entry) => (
            <HistoryCard key={entry.season_id} entry={entry} />
          ))}
        </div>
      ) : (
        <div className="rounded-[22px] bg-card p-5 text-center sticker-border">
          <p className="font-bold">{t("challengeHistory.empty")}</p>
          <Link to="/start" className="mt-3 block">
            <StickerButton block variant="lime">
              {t("challengeHistory.pickNext")}
            </StickerButton>
          </Link>
        </div>
      )}
    </AppShell>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[72px] items-center gap-2 rounded-[16px] bg-card p-3 sticker-border">
      <span>{icon}</span>
      <span className="min-w-0 flex-1 text-[13px] font-bold">{label}</span>
      <strong className="text-[18px]">{value}</strong>
    </div>
  );
}

function HistoryCard({ entry }: { entry: ChallengeHistoryEntry }) {
  const { tz } = useBase();
  const { t, i18n } = useTranslation();
  return (
    <Link
      to="/challenges"
      search={{ season: entry.season_id }}
      className="block rounded-[20px] bg-card p-4 sticker-border shadow-hard-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-[18px] font-extrabold">{entry.name}</h2>
          <p className="mt-1 text-[13px] font-semibold">
            {formatDayMonth(entry.start_date, i18n.language)} —{" "}
            {formatDayMonth(entry.end_date, i18n.language)} · {entry.length}{" "}
            {t("challengeHistory.dayUnit")}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-yellow px-3 py-1 text-[13px] font-extrabold">
          {t(
            entry.end_reason === "moderation"
              ? "events.removed"
              : `challengeHistory.status_${entry.status}`,
          )}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] font-bold">
        <span>
          {t("challengeHistory.days", {
            done: entry.completed_days,
            total: possibleDays(entry, tz).possible,
          })}
        </span>
        <span>{t("challengeHistory.consistencyShort", { n: Math.round(entry.consistency) })}</span>
        <span>
          <Num>{entry.points}</Num> {t("challengeHistory.pointsTotal")}
        </span>
        {entry.rank && <span>#{entry.rank}</span>}
      </div>
      {entry.crew && (
        <p className="mt-2 text-[13px] font-semibold">
          {t("challengeHistory.crew", { name: entry.crew.name })}
        </p>
      )}
    </Link>
  );
}
