import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Star, Shield, Lock, ArrowRight } from "lucide-react";
import { SignatureFrame } from "@/components/lezgo/signature/frame";
import { Avatar, Num, StickerButton } from "@/components/lezgo/ui";
import { FitHeading } from "@/components/lezgo/fit-heading";
import { useBase, scoresQuery } from "@/lib/data";
import { signatureQuery } from "@/lib/signature-data";
import { snakeDays, tileState } from "@/lib/signature-rules";
import { addDays } from "@/lib/time";
import { loc, formatDayMonth } from "@/lib/i18n";
import { pageHead } from "@/lib/page-head";
export const Route = createFileRoute("/_authenticated/trail")({
  head: () =>
    pageHead("Your Trail — lezgo", "Every go, shield and milestone on your personal season trail."),
  component: Trail,
});
function Trail() {
  const { t, i18n } = useTranslation();
  const { uid, season, today } = useBase();
  const sid = season?.id ?? "";
  const q = useQuery({ ...signatureQuery(uid, sid), enabled: !!uid && !!sid });
  const scores = useQuery({ ...scoresQuery(uid, sid), enabled: !!uid && !!sid });
  const data = q.data;
  const byDay = new Map(scores.data?.map((s) => [s.day, s]));
  return (
    <SignatureFrame>
      <FitHeading className="signature-heading" requestedSize={48} text={t("batch8.trail")} />
      <p className="signature-sub">{t("batch8.trailSub")}</p>
      {season && data ? (
        <>
          <section className="trail-board">
            <header>
              <h2>{t("batch8.season", { name: loc(season.name, i18n.language), n: 1 })}</h2>
              <Num>
                {Math.min(data.day, data.length)} / {data.length}
              </Num>
            </header>
            <div className="trail-grid">
              {snakeDays(data.length).map((row, i) => (
                <div className="trail-row" key={i}>
                  {row.map((n) => {
                    const d = addDays(season.starts_on, n - 1);
                    const state = tileState(d, today, byDay.get(d));
                    const friends = data.crew.filter((c) => c.day === n).slice(0, 2);
                    return (
                      <div
                        className="trail-tile"
                        data-state={state}
                        data-milestone={n === 20 || n === 40}
                        key={n}
                        title={`${d} · ${t(`batch8.${state === "missed" ? "partial" : state === "future" ? "day" : state}`, { n })}`}
                      >
                        {state === "perfect" ? (
                          <Star fill="currentColor" />
                        ) : state === "shield" ? (
                          <Shield />
                        ) : (
                          <Num>{n}</Num>
                        )}
                        {friends.length > 0 && (
                          <div className="trail-friends">
                            {friends.map((c) => (
                              <Avatar
                                key={c.id}
                                id={c.id}
                                name={c.name}
                                url={c.avatar_url}
                                size={24}
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
            <div className="trail-legend">
              {["perfect", "partial", "shield", "today"].map((s) => (
                <span key={s}>
                  <i data-state={s} />
                  {t(`batch8.${s}`)}
                </span>
              ))}
            </div>
          </section>
          <div className="trail-milestone bg-yellow">
            <Star />
            <div>
              <strong>{t("batch8.halfway")}</strong>
              <p>{t("batch8.away", { n: Math.max(0, 20 - data.day) })}</p>
            </div>
          </div>
          <Link to="/capsule" className="trail-milestone bg-ink text-lime">
            <Lock />
            <div>
              <strong>{t("batch8.dayNote")}</strong>
              <p>{t("batch8.opens", { date: formatDayMonth(season.ends_on, i18n.language) })}</p>
            </div>
            <ArrowRight className="ms-auto rtl:-scale-x-100" />
          </Link>
          <footer className="trail-footer">
            <div className="flex -space-x-2 rtl:space-x-reverse">
              {data.crew.slice(0, 4).map((c) => (
                <Avatar key={c.id} id={c.id} name={c.name} url={c.avatar_url} size={32} />
              ))}
            </div>
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
          <Link to="/today">
            <StickerButton block>{t("batch8.keepGoing")}</StickerButton>
          </Link>
        </>
      ) : (
        <p>{t(q.isError ? "common.error" : "common.loading")}</p>
      )}
    </SignatureFrame>
  );
}
