import { useTranslation } from "react-i18next";
import type { CSSProperties } from "react";
import type { AdminDashboard } from "@/lib/admin-data";
import { Num } from "@/components/lezgo/ui";
import { formatDayMonth, formatNumber } from "@/lib/i18n";
export function Bars({
  rows,
  today = false,
}: {
  rows: { label: string; value: number }[];
  today?: boolean;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div
      className="admin-bars"
      role="img"
      aria-label={rows.map((r) => `${r.label}: ${r.value}`).join(", ")}
    >
      {rows.map((r, i) => (
        <div className="admin-bar-col" key={`${r.label}-${i}`}>
          <Num>{r.value}</Num>
          <div className="admin-bar-track">
            <div
              className={today && i === rows.length - 1 ? "admin-bar is-today" : "admin-bar"}
              style={{ "--bar-height": `${Math.max(2, (r.value / max) * 100)}%` } as CSSProperties}
            />
          </div>
          <BarLabel label={r.label} />
        </div>
      ))}
    </div>
  );
}
/** "26 Nov" / "26 نوفمبر": on phones only the day number fits under a bar, so the month hides. */
function BarLabel({ label }: { label: string }) {
  const match = /^(\d+) (.+)$/.exec(label);
  if (!match) return <Num className="admin-bar-label">{label}</Num>;
  return (
    <Num className="admin-bar-label">
      {match[1]}
      <span className="admin-bar-month"> {match[2]}</span>
    </Num>
  );
}
export function AdminOverview({ data }: { data: AdminDashboard }) {
  const { t, i18n } = useTranslation();
  const labels = [
    "active_today",
    "checkins_today",
    "average_score",
    "retention7",
    "reports",
  ] as const;
  const colors = ["bg-lime", "bg-blue", "bg-yellow", "bg-purple", "bg-pink"];
  const previous = ["active_previous", "checkins_previous", "average_previous"];
  const shortDate = (day: string) => formatDayMonth(day, i18n.language);
  const countries = new Intl.DisplayNames([i18n.language === "aeb" ? "ar" : i18n.language], {
    type: "region",
  });
  const max = Math.max(1, ...data.countries.map((r) => r.value));
  const trendMax = Math.max(1, ...data.activity.map((r) => r.wau));
  const line = (key: "dau" | "wau") =>
    data.activity
      .map(
        (r, i) =>
          `${25 + (i * 550) / Math.max(1, data.activity.length - 1)},${170 - (r[key] / trendMax) * 145}`,
      )
      .join(" ");
  return (
    <>
      <div className="admin-kpis">
        {labels.map((key, i) => {
          const value = data.kpis[key] ?? 0;
          const p = previous[i];
          const delta = p ? value - (data.kpis[p] ?? 0) : null;
          return (
            <article className={`admin-kpi ${colors[i] ?? "bg-card"}`} key={key}>
              <p>{t(`batch7.${key}`)}</p>
              <Num className="admin-kpi-value">
                {formatNumber(value, i18n.language)}
                {key === "retention7" ? "%" : ""}
              </Num>
              {key !== "reports" && (
                <span className="admin-delta">
                  {delta !== null ? (
                    <>
                      <Num>
                        {delta > 0 ? "+" : ""}
                        {delta}
                      </Num>{" "}
                      {t("batch7.vsYesterday")}
                    </>
                  ) : key === "retention7" ? (
                    <Num>D7</Num>
                  ) : null}
                </span>
              )}
            </article>
          );
        })}
      </div>
      <div className="admin-chart-grid">
        <section className="admin-panel">
          <h2>{t("batch7.chart")}</h2>
          <Bars rows={data.chart.map((r) => ({ label: shortDate(r.day), value: r.value }))} today />
        </section>
        <section className="admin-panel">
          <h2>{t("batch7.countries")}</h2>
          <div className="admin-country-list">
            {data.countries.map((r, i) => (
              <div key={r.name}>
                <div className="flex justify-between gap-2">
                  <strong>{countries.of(r.name) ?? r.name}</strong>
                  <Num>{r.value}</Num>
                </div>
                <div className="admin-country-track">
                  <div
                    className={i === 0 ? "bg-orange" : "bg-ink"}
                    style={{ width: `${(r.value / max) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
      <div className="admin-secondary-grid">
        <section className="admin-panel">
          <h2>{t("batch7.activity")}</h2>
          <div className="flex gap-4 text-[12px] font-bold">
            <span className="text-warning">DAU</span>
            <span>WAU</span>
          </div>
          <svg
            viewBox="0 0 600 200"
            role="img"
            aria-label={t("batch7.activity")}
            className="w-full"
          >
            <path d="M25 25V170H575" fill="none" stroke="var(--ink)" strokeWidth="2" />
            <polyline points={line("wau")} fill="none" stroke="var(--ink)" strokeWidth="3" />
            <polyline points={line("dau")} fill="none" stroke="var(--orange)" strokeWidth="4" />
            {data.activity.map((r, i) => (
              <circle
                key={r.day}
                cx={25 + (i * 550) / Math.max(1, data.activity.length - 1)}
                cy={170 - (r.dau / trendMax) * 145}
                r="5"
                fill="var(--orange)"
                stroke="var(--ink)"
                strokeWidth="2"
              />
            ))}
          </svg>
        </section>
        <section className="admin-panel">
          <h2>{t("batch7.signups")}</h2>
          <Bars rows={data.signups.map((r) => ({ label: shortDate(r.day), value: r.value }))} />
        </section>
        <section className="admin-panel">
          <h2>{t("batch7.distribution")}</h2>
          <Bars rows={data.histogram.map((r) => ({ label: r.label, value: r.value }))} />
        </section>
        <section className="admin-panel">
          <h2>{t("batch7.retention")}</h2>
          <div className="grid grid-cols-3 gap-3 pt-6">
            {data.retention.map((r) => (
              <div key={r.day} className="text-center">
                <span className="font-bold">
                  <Num>D{r.day}</Num>
                </span>
                <Num className="mt-3 block text-[32px] font-bold">
                  {r.eligible ? `${r.value}%` : "—"}
                </Num>
                <p className="mt-3 text-[12px] font-semibold">
                  {r.eligible ? (
                    <>
                      <Num>{r.eligible}</Num> {t("batch7.eligible")}
                    </>
                  ) : (
                    t("batch7.noCohort")
                  )}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
