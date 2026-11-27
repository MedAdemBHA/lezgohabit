import { useEffect, useId, useRef } from "react";
import { Check, ChevronRight, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { UserHabit, HabitPoints } from "@/lib/data";
import { habitColor } from "@/lib/today-rules";
import { loc } from "@/lib/i18n";
import { fmtPts, fmtVal, isSleepHabit, unitLabel } from "@/lib/habits";
import { HabitIcon } from "../habit-icon";
import { Num } from "../ui";
export function habitName(h: UserHabit, t: (key: string) => string, lang: string) {
  const key = h.template?.key;
  if (h.custom_name) return h.custom_name;
  if (key === "train") return t("todayDesign.train");
  if (key === "learn" || key === "learn15") return t("todayDesign.learn");
  if (key === "sleep" || key === "sleep7") return t("todayDesign.sleep");
  if (key === "no_sugar") return t("todayDesign.noSugar");
  const title = loc(h.template?.name, lang);
  const base = Number(h.template?.default_target);
  return (h.kind === "count" || h.kind === "timer") && base > 0 && base !== Number(h.target)
    ? title.replace(/\d+(?:[.,]\d+)?/g, (part) =>
        Number(part.replace(",", ".")) === base
          ? fmtVal(Number(h.target)).replace(".", lang === "fr" ? "," : ".")
          : part,
      )
    : title;
}
export function HabitTile({
  habit,
  value,
  completion,
  points,
  pop,
  onTap,
  onStepper,
  disabled,
}: {
  habit: UserHabit;
  value: number;
  completion: number;
  points: HabitPoints | undefined;
  pop: boolean;
  onTap: () => void;
  onStepper: () => void;
  disabled: boolean;
}) {
  const { t, i18n } = useTranslation();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  const detailsId = useId();
  const done = completion >= 1;
  const color =
    habit.template?.color ?? habitColor(habit.template?.key ?? "", habit.template?.category ?? "");
  const key = habit.template?.key;
  const opensDetail =
    habit.kind === "count" || habit.kind === "quit" || habit.kind === "timer" || key === "detox";
  const ruleData = habit.rule as { window_start?: string; window_end?: string } | null;
  const rule =
    key === "train" ? (
      loc(habit.what_counts, i18n.language) ||
      loc(habit.template?.what_counts, i18n.language) ||
      t("todayDesign.trainRule")
    ) : key === "learn15" ? (
      t("todayDesign.learnRule")
    ) : isSleepHabit(key) ? (
      t("ux.sleepRule", { n: fmtVal(Number(habit.target)) })
    ) : key === "no_sugar" ? (
      t("todayDesign.sugarRule")
    ) : habit.kind === "time_window" ? (
      t("habitRules.outsideWindow", {
        start: ruleData?.window_start ?? "—",
        end: ruleData?.window_end ?? "—",
      })
    ) : habit.kind === "quit" ? (
      t("habitRules.quitRule")
    ) : habit.kind === "timer" ? (
      t("habitRules.timerVisible")
    ) : key === "screen_limit" ? (
      t("habitRules.screenLimitCount", {
        value: fmtVal(value),
        target: fmtVal(Number(habit.target)),
      })
    ) : habit.kind === "count" ? (
      // Numbers stay left-to-right inside RTL text; the unit is translated.
      <>
        <Num>
          {fmtVal(value)} / {fmtVal(Number(habit.target))}
        </Num>{" "}
        {unitLabel(t, habit.unit)}
      </>
    ) : (
      loc(habit.what_counts, i18n.language) ||
      loc(habit.template?.what_counts, i18n.language) ||
      loc(habit.template?.description, i18n.language)
    );
  // Long-press opens the habit sheet: the stepper for counts, the optional Lift log for Train.
  const hasSheet = habit.kind === "count" || key === "train";
  function release() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }
  useEffect(() => release, []);
  return (
    <button
      type="button"
      data-habit-id={habit.id}
      className={`today-habit press ${done ? "is-done" : ""} ${pop ? "animate-pop" : ""}`}
      data-color={color}
      aria-pressed={opensDetail ? undefined : done}
      aria-haspopup={opensDetail && key !== "detox" ? "dialog" : undefined}
      aria-label={habitName(habit, t, i18n.language)}
      aria-describedby={detailsId}
      disabled={disabled}
      onPointerDown={(e) => {
        if (e.button !== 0 || !hasSheet) return;
        held.current = false;
        timer.current = setTimeout(() => {
          held.current = true;
          onStepper();
        }, 500);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={release}
      onContextMenu={(e) => {
        if (hasSheet) {
          e.preventDefault();
          release();
          held.current = true;
          onStepper();
        }
      }}
      onClick={() => {
        if (held.current) {
          held.current = false;
          return;
        }
        onTap();
      }}
    >
      <span className="habit-icon-box">
        <HabitIcon name={habit.template?.icon ?? null} className="size-7" />
      </span>
      <span className="today-habit-bottom">
        <span className="habit-name">{habitName(habit, t, i18n.language)}</span>
        <span className="habit-rule" id={detailsId}>
          {rule}
        </span>
      </span>
      <span className="habit-top-end">
        {fmtPts(points?.earned) !== "0" && (
          <Num className="habit-points">+{fmtPts(points?.earned)}</Num>
        )}
        <span className={`habit-check ${done ? "is-checked" : ""}`} aria-hidden="true">
          {done ? (
            <Check size={17} strokeWidth={3} />
          ) : opensDetail ? (
            <ChevronRight size={18} className="rtl:-scale-x-100" />
          ) : (
            <Plus size={19} />
          )}
        </span>
      </span>
    </button>
  );
}
