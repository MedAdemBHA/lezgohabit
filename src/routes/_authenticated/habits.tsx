import { habitName } from "@/components/lezgo/today/habit-tile";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/lezgo/app-shell";
import { HabitIcon } from "@/components/lezgo/habit-icon";
import { Num, StickerButton } from "@/components/lezgo/ui";
import { habitsQuery, useBase } from "@/lib/data";
import { loc } from "@/lib/i18n";
import { unitLabel } from "@/lib/habits";
import { pageHead } from "@/lib/page-head";

export const Route = createFileRoute("/_authenticated/habits")({
  head: () => pageHead("Challenge habits · lezgo", "See the habits for your current challenge."),
  component: HabitsPage,
});

function HabitsPage() {
  const { t, i18n } = useTranslation();
  const { uid, season } = useBase();
  const query = useQuery({ ...habitsQuery(uid, season?.id ?? ""), enabled: !!uid && !!season });
  return (
    <AppShell hideTabs>
      <h1 className="mb-2 text-[30px] font-extrabold">{t("challengeHistory.habits")}</h1>
      <p className="mb-4 text-[14px] font-semibold text-design-muted">{t("challengeHistory.habitsLocked")}</p>
      <div className="space-y-3">
        {(query.data ?? []).map((habit) => (
          <article key={habit.id} className="flex min-h-[72px] items-center gap-3 rounded-[18px] bg-card p-4 sticker-border shadow-hard-sm">
            <HabitIcon name={habit.template?.icon ?? "sparkles"} className="size-7 shrink-0" />
            <div className="min-w-0 flex-1">
              <h2 className="truncate font-extrabold">{habitName(habit, t, i18n.language)}</h2>
              <p className="text-[13px] font-semibold text-design-muted">{loc(habit.what_counts, i18n.language) || loc(habit.template?.what_counts, i18n.language)}</p>
            </div>
            <Num className="shrink-0 rounded-full bg-yellow px-3 py-1 text-[13px] font-bold">{habit.target}{habit.unit ? ` ${unitLabel(t, habit.unit)}` : ""}</Num>
          </article>
        ))}
        {!query.isLoading && !query.data?.length && <p className="rounded-[18px] bg-card p-4 font-semibold sticker-border">{t("common.error")}</p>}
      </div>
      <Link to="/today" className="mt-5 block"><StickerButton block>{t("common.back")}</StickerButton></Link>
    </AppShell>
  );
}
