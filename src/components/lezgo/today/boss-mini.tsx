import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowRight, Trophy } from "lucide-react";
import type { BossLevel, BossOverview } from "@/lib/batch6-data";
import { loc } from "@/lib/i18n";
import { Num } from "@/components/lezgo/ui";

export function BossMini({ overview }: { overview: BossOverview }) {
  const { t, i18n } = useTranslation();
  const boss = overview.boss;
  if (!boss) return null;
  const levels = (boss.levels ?? []) as unknown as BossLevel[];
  const level = levels.find((item) => item.key === (overview.entry?.level ?? "pro")) ?? levels[0];
  const progress = Number(overview.entry?.progress ?? 0);
  const target = Number(level?.target ?? 0);
  return (
    <Link to="/boss" className="today-boss-mini">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-yellow sticker-border"><Trophy size={20} /></span>
      <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-extrabold">{loc(boss.name,i18n.language)}</span><span className="block text-[12px] font-semibold">{t("batch6.hp")} · <Num>{progress}</Num>{target ? <> / <Num>{target}</Num></> : null}</span><progress className="mt-1 block h-2 w-full accent-ink" value={Math.min(progress,target || progress)} max={Math.max(1,target || progress)} /></span>
      <ArrowRight size={18} className="rtl:-scale-x-100" />
    </Link>
  );
}
