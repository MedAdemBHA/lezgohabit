import { useId } from "react";
import { ArrowUpRight, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CountUp } from "@/components/lezgo/count-up";
import { FitHeading } from "@/components/lezgo/fit-heading";
import type { DailyScore } from "@/lib/data";
import { formatNumber } from "@/lib/i18n";

export type ProgressHabit = { id: string; name: string; color: string; completion: number };

export function TodayScoreCard({
  score,
  habits,
  busy,
  onOpen,
}: {
  score: DailyScore | null | undefined;
  habits: ProgressHabit[];
  busy: boolean;
  onOpen: () => void;
}) {
  const { t, i18n } = useTranslation();
  const heading = useId();
  const done = habits.filter((habit) => habit.completion >= 1).length;
  const allDone = done > 0 && done === habits.length;

  return (
    <section className="today-score" aria-labelledby={heading} data-complete={allDone}>
      <div className="today-score-row">
        <FitHeading id={heading} text={t("nav.today")} className="today-title" requestedSize={42} />
        <button
          className="score-total"
          type="button"
          onClick={onOpen}
          aria-label={`${formatNumber(score?.total ?? 0, i18n.language)} ${t("common.pts")} · ${t("socialDesign.scoring")}`}
          aria-busy={busy}
        >
          <CountUp value={score?.total ?? 0} className="today-score-number" />
          <span>{t("common.pts")}</span>
          <ArrowUpRight size={15} className="rtl:-scale-x-100" aria-hidden="true" />
        </button>
      </div>
      {habits.length > 0 && (
        <>
          <p className="today-score-done" role="status">
            {allDone && <Check size={17} aria-hidden="true" />}
            {allDone
              ? t("appRefresh.allHabitsDone")
              : t("ux.habitsDone", {
                  done: formatNumber(done, i18n.language),
                  total: formatNumber(habits.length, i18n.language),
                })}
          </p>
          <div className="habit-progress" aria-hidden="true">
            {habits.map((habit) => (
              <div key={habit.id} className="progress-segment" title={habit.name}>
                <span
                  data-color={habit.color}
                  className="progress-fill"
                  style={{ width: `${habit.completion * 100}%` }}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
