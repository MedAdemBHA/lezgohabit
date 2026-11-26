import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Num, StickerButton } from "@/components/lezgo/ui";
import { numberLocale } from "@/lib/i18n";
import {
  clearSurrenderRecap,
  readSurrenderRecap,
  type SurrenderRecap,
} from "@/lib/surrender-recap";

/** Calm recap of what a player achieved in the challenge they just left. */
export function SurrenderRecapCard() {
  const { t, i18n } = useTranslation();
  const [recap, setRecap] = useState<SurrenderRecap | null>(null);
  useEffect(() => setRecap(readSurrenderRecap()), []);
  if (!recap) return null;
  const fmt = new Intl.NumberFormat(numberLocale(i18n.language), {
    maximumFractionDigits: 0,
  });
  const stats = [
    { label: t("challengeHistory.points"), value: fmt.format(Math.round(recap.points)) },
    { label: t("ux.recapGoodDays"), value: fmt.format(recap.completed_days) },
    { label: t("challengeHistory.perfectDays"), value: fmt.format(recap.perfect_days) },
    { label: t("challengeHistory.consistency"), value: `${fmt.format(recap.consistency)}%` },
  ];
  return (
    <section
      className="space-y-3 rounded-[20px] bg-card p-4 sticker-border shadow-hard"
      aria-labelledby="surrender-recap"
    >
      <h2 id="surrender-recap" className="text-[20px] font-extrabold">
        {t("ux.recapTitle", { name: recap.name })}
      </h2>
      <p className="font-semibold">{t("ux.recapBody")}</p>
      <dl className="grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-[14px] bg-background p-3 sticker-border">
            <dt className="text-[12px] font-bold">{s.label}</dt>
            <dd>
              <Num className="text-[22px] font-bold">{s.value}</Num>
            </dd>
          </div>
        ))}
      </dl>
      {recap.trophy && <p className="font-extrabold">{t("ux.recapTrophy")}</p>}
      <div className="flex gap-3">
        <Link to="/challenges" search={{ season: recap.season_id }} className="flex-1">
          <StickerButton block variant="secondary">
            {t("challengeHistory.details")}
          </StickerButton>
        </Link>
        <StickerButton
          variant="ghost"
          onClick={() => {
            clearSurrenderRecap();
            setRecap(null);
          }}
        >
          {t("common.close")}
        </StickerButton>
      </div>
    </section>
  );
}
