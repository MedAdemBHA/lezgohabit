import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Num } from "@/components/lezgo/ui";
import { loc } from "@/lib/i18n";
import type { Season } from "@/lib/data";

export function ChallengeTitle({ season, day, length }: { season: Season; day: number; length: number }) {
  const { t, i18n } = useTranslation();
  return (
    <div className="today-challenge-heading">
      <Link to="/challenges" search={{ season: season.id }} className="today-challenge-name">{loc(season.name, i18n.language)}</Link>
      <Link to="/trail" search={{ season: season.id }} className="day-sticker" aria-label={t("batch8.viewTrail")}>
        <span>{t("todayDesign.day")}</span><Num>{Math.min(Math.max(day, 1), length)}/{length}</Num>
      </Link>
    </div>
  );
}
