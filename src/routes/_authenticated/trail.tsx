import { createFileRoute, Link } from "@tanstack/react-router";
import { PageTitle } from "@/components/lezgo/page-title";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Check, ChevronRight, Lock, Shield, Star } from "lucide-react";
import { SignatureFrame } from "@/components/lezgo/signature/frame";
import { Avatar, Num, StickerButton } from "@/components/lezgo/ui";
import { useBase, scoresQuery } from "@/lib/data";
import { signatureQuery } from "@/lib/signature-data";
import { legendStates, tileState, trailStats, weekRows } from "@/lib/signature-rules";
import { addDays } from "@/lib/time";
import { formatDayMonth, formatNumber, loc } from "@/lib/i18n";
import { pageHead } from "@/lib/page-head";
import { challengeHistoryQuery, joinedDay } from "@/lib/challenge-history";
import { supabase } from "@/integrations/supabase/client";
export const Route = createFileRoute("/_authenticated/trail")({
  validateSearch: (s: Record<string, unknown>) => ({
    season: typeof s["season"] === "string" ? s["season"] : "",
  }),
  head: () =>
    pageHead("Your Trail · lezgo", "Every go, shield and milestone on your personal season trail."),
  component: Trail,
});
function Trail() {
  const { t, i18n } = useTranslation();
  const { uid, season: activeSeason, today, tz } = useBase();
  const search = Route.useSearch();
  const sid = search.season || activeSeason?.id || "";
  const seasonQuery = useQuery({
    queryKey: ["trailSeason", sid],
    enabled: !!sid,
    queryFn: async () => {
      const { data, error } = await supabase.from("seasons").select("*").eq("id", sid).single();
      if (error) throw error;
      return data;
    },
  });
  const season = seasonQuery.data;
  const history = useQuery({ ...challengeHistoryQuery(uid), enabled: !!uid && !!sid });
  const historyEntry = history.data?.find((entry) => entry.season_id === sid);
  const joinedOn = historyEntry ? joinedDay(historyEntry.joined_at, tz) : null;
  const q = useQuery({ ...signatureQuery(uid, sid), enabled: !!uid && !!sid });
  const scores = useQuery({ ...scoresQuery(uid, sid), enabled: !!uid && !!sid });
  const data = q.data;
  const byDay = new Map(scores.data?.map((s) => [s.day, s]));
  const stats = trailStats(scores.data ?? [], today);
  const fmt = (n: number) => formatNumber(n, i18n.language);
  return (
    <SignatureFrame>
      <header className="trail-head">
        <PageTitle text={t("ux.trailTitle")} />
        <p className="signature-sub">{t("batch8.trailSub")}</p>
      </header>
      {season && data ? (
        <>
          <section className="trail-summary" aria-labelledby="trail-season">
            <div className="trail-summary-top">
              <h2 id="trail-season">{loc(season.name, i18n.language)}</h2>
              <span className="trail-day">
                {t("ux.trailDay", {
                  day: fmt(Math.min(data.day, data.length)),
                  total: fmt(data.length),
                })}
              </span>
            </div>
            <div
              className="trail-progress"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={data.length}
              aria-valuenow={Math.min(data.day, data.length)}
              aria-label={t("ux.trailDay", {
                day: Math.min(data.day, data.length),
                total: data.length,
              })}
            >
              <span
                style={{ width: `${(100 * Math.min(data.day, data.length)) / data.length}%` }}
              />
              <i
                style={{ insetInlineStart: `${(100 * Math.ceil(data.length / 2)) / data.length}%` }}
                aria-hidden="true"
              />
            </div>
            <dl className="trail-stats">
              <div>
                <dt>{t("ux.goodDaysStat")}</dt>
                <dd>
                  <Num>{fmt(stats.good)}</Num>
                </dd>
              </div>
              <div>
                <dt>{t("ux.perfectStat")}</dt>
                <dd>
                  <Num>{fmt(stats.perfect)}</Num>
                </dd>
              </div>
              <div>
                <dt>{t("ux.streakStat")}</dt>
                <dd>
                  <Num>{fmt(stats.streak)}</Num>
                </dd>
              </div>
              <div>
                <dt>{t("ux.daysLeftStat")}</dt>
                <dd>
                  <Num>{fmt(Math.max(0, data.length - data.day))}</Num>
                </dd>
              </div>
            </dl>
          </section>

          <section className="trail-board" aria-label={t("ux.trailTitle")}>
            <div className="trail-grid">
              {weekRows(data.length).map((row, i) => (
                <div className="trail-row" key={i}>
                  {row.map((n) => {
                    const d = addDays(season.starts_on, n - 1);
                    const state = tileState(d, today, byDay.get(d), joinedOn);
                    const friends = data.crew.filter((c) => c.day === n).slice(0, 2);
                    const final = !!byDay.get(d)?.finalized_at;
                    const milestone = n === Math.ceil(data.length / 2);
                    return (
                      <div
                        className="trail-tile"
                        data-state={state}
                        data-milestone={milestone}
                        key={n}
                        data-final={final}
                        title={`${formatDayMonth(d, i18n.language)} · ${state === "missed" ? t("ux.missed") : state === "before" ? t("ux.beforeJoin") : t(`batch8.${state === "future" ? "day" : state}`, { n })}${final ? ` · ${t("integrity.final")}` : ""}`}
                      >
                        {state === "perfect" ? (
                          <Check aria-hidden="true" />
                        ) : state === "shield" ? (
                          <Shield aria-hidden="true" />
                        ) : (
                          <Num>{fmt(n)}</Num>
                        )}
                        {milestone && state !== "perfect" && (
                          <Star
                            className="trail-tile-star"
                            fill="currentColor"
                            aria-hidden="true"
                          />
                        )}
                        {friends.length > 0 && (
                          <div className="trail-friends">
                            {friends.map((c) => (
                              <Avatar
                                key={c.id}
                                id={c.id}
                                name={c.name}
                                url={c.avatar_url}
                                size={22}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <ul className="trail-legend">
              {legendStates(
                Array.from({ length: data.length }, (_, i) =>
                  tileState(
                    addDays(season.starts_on, i),
                    today,
                    byDay.get(addDays(season.starts_on, i)),
                    joinedOn,
                  ),
                ),
              ).map((s) => (
                <li key={s}>
                  <i data-state={s} />
                  {t(
                    s === "missed"
                      ? "ux.missed"
                      : s === "before"
                        ? "ux.beforeJoin"
                        : s === "future"
                          ? "ux.upcoming"
                          : `batch8.${s}`,
                  )}
                </li>
              ))}
            </ul>
          </section>

          <div className="trail-cards">
            <div
              className={`trail-milestone${data.day >= Math.ceil(data.length / 2) ? " is-done" : ""}`}
            >
              <span className="trail-milestone-icon bg-yellow">
                <Star aria-hidden="true" />
              </span>
              <div>
                <strong>{t("ux.halfwayTitle")}</strong>
                <p>
                  {data.day >= Math.ceil(data.length / 2)
                    ? t("ux.halfwayReached")
                    : t("batch8.away", { n: fmt(Math.ceil(data.length / 2) - data.day) })}
                </p>
              </div>
            </div>
            {(!historyEntry || historyEntry.status === "active") && (
              <Link to="/capsule" className="trail-milestone">
                <span className="trail-milestone-icon bg-ink text-lime">
                  <Lock aria-hidden="true" />
                </span>
                <div>
                  <strong>{t("ux.capsuleTitle", { n: fmt(data.length) })}</strong>
                  <p>
                    {t("batch8.opens", { date: formatDayMonth(season.ends_on, i18n.language) })}
                  </p>
                </div>
                <ChevronRight className="ms-auto shrink-0 rtl:-scale-x-100" aria-hidden="true" />
              </Link>
            )}
          </div>

          <footer className="trail-footer">
            {data.crew.length > 0 && (
              <div className="flex -space-x-2 rtl:space-x-reverse">
                {data.crew.slice(0, 4).map((c) => (
                  <Avatar key={c.id} id={c.id} name={c.name} url={c.avatar_url} size={32} />
                ))}
              </div>
            )}
            {data.crew.length ? (
              data.crew
                .slice(0, 2)
                .map((c) => (
                  <p key={c.id}>
                    {c.day === data.day
                      ? t("batch8.withYou", { handle: c.handle, day: c.day })
                      : t("batch8.behind", { handle: c.handle, n: Math.max(0, data.day - c.day) })}
                  </p>
                ))
            ) : (
              <p>{t("batch8.alone")}</p>
            )}
          </footer>
          <div className="trail-actions">
            {historyEntry?.status === "active" && (
              <Link to="/today">
                <StickerButton block>{t("batch8.keepGoing")}</StickerButton>
              </Link>
            )}
            <Link to="/challenges" search={{ season: "" }}>
              <StickerButton block variant="secondary">
                {t("challengeHistory.title")}
              </StickerButton>
            </Link>
          </div>
        </>
      ) : (
        <p>{t(q.isError ? "common.error" : "common.loading")}</p>
      )}
    </SignatureFrame>
  );
}
