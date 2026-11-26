import type { KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { CountUp } from "@/components/lezgo/count-up";
import { FitHeading } from "@/components/lezgo/fit-heading";
import { Num } from "@/components/lezgo/ui";
import type { DailyScore } from "@/lib/data";
import { formatNumber } from "@/lib/i18n";
import { fmtPts } from "@/lib/habits";

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
  const keyActivate = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen();
    }
  };
  return (
    <section
      className="today-score"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={keyActivate}
      aria-busy={busy}
      aria-label={t("todayDesign.scoreBreakdown")}
    >
      <div className="today-score-row">
        <div className="score-heading">
          <FitHeading text={t("todayDesign.today")} className="today-title" requestedSize={40} />
          <p className="score-breakdown">{t("todayDesign.scoreBreakdown")}</p>
        </div>
        <div className="score-total">
          <CountUp value={score?.total ?? 0} className="today-score-number" />
          <span>{t("common.pts")}</span>
        </div>
      </div>
      <p className="today-score-done">
        {t("ux.habitsDone", {
          done: formatNumber(habits.filter((h) => h.completion >= 1).length, i18n.language),
          total: formatNumber(habits.length, i18n.language),
        })}
      </p>
      <div className="habit-progress" aria-hidden="true">
        {habits.map((habit) => (
          <div
            key={habit.id}
            className="progress-segment"
            role="progressbar"
            aria-label={habit.name}
            aria-valuenow={Math.round(habit.completion * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span
              data-color={habit.color}
              className="progress-fill"
              style={{ width: `${habit.completion * 100}%` }}
            />
          </div>
        ))}
      </div>
      <div className="today-score-points">
        <span>
          {t("todayDesign.habits")} <Num>{fmtPts(score?.habit_points)}</Num>
        </span>
        <span>·</span>
        <span>
          {t("ux.bonus")} <Num>{fmtPts(score?.stack_points)}</Num>
        </span>
        <span>·</span>
        <span>
          {t("ux.streakBonus", {
            m: formatNumber(Number(score?.multiplier ?? 1), i18n.language, {
              maximumFractionDigits: 2,
            }),
          })}
        </span>
      </div>
    </section>
  );
}
