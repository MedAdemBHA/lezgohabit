import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowRight, Bell, Trophy } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { seasonsHubQuery } from "@/lib/batch5-data";
import { challengesQuery } from "@/lib/batch6-data";
import { loc } from "@/lib/i18n";
import { Num, StickerButton } from "./ui";

/**
 * The parts of the old Seasons page that are not on Today or the trail: earned trophies,
 * challenges you created, and a way to upcoming challenges (reminders live on /start).
 */
export function ProgressExtras({ uid }: { uid: string }) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const hub = useQuery({ ...seasonsHubQuery(uid), enabled: !!uid });
  const mine = useQuery({ ...challengesQuery(uid), enabled: !!uid });
  const trophies = hub.data?.trophies ?? [];
  const created = mine.data ?? [];
  async function open(id: string) {
    const r = await supabase.rpc("activate_challenge", { _id: id });
    if (r.error) {
      toast(t("common.error"));
      return;
    }
    await qc.invalidateQueries();
    window.location.assign("/today");
  }
  return (
    <>
      <section className="trophy-shelf">
        <Trophy size={32} aria-hidden="true" />
        <div>
          <h2>{t("batch5.trophyShelf")}</h2>
          {trophies.length ? (
            trophies.map((tr) => (
              <p className="mt-2 font-bold" key={tr.season_id}>
                {t("batch5.earned")} ·{" "}
                {loc(hub.data?.seasons.find((s) => s.id === tr.season_id)?.name, i18n.language)}
              </p>
            ))
          ) : (
            <p>{t("challengeHistory.noTrophies")}</p>
          )}
        </div>
      </section>
      {created.length > 0 && (
        <section className="space-y-2">
          <h2 className="section-label">{t("batch6.mine")}</h2>
          {created.map((c) => (
            <div className="challenge-list-row" key={c.id}>
              <div>
                <h3>{c.name}</h3>
                <p>
                  {t("batch6.days", { n: c.days })} · {t(`batch6.${c.audience}`)}
                </p>
                <Num>{c.code}</Num>
              </div>
              <StickerButton size="sm" variant="lime" onClick={() => void open(c.id)}>
                {t("batch6.open")}
              </StickerButton>
            </div>
          ))}
        </section>
      )}
      <Link to="/start" className="app-row-link">
        <Bell size={18} aria-hidden="true" />
        {t("batch5.comingUp")}
        <ArrowRight size={18} className="ms-auto rtl:-scale-x-100" aria-hidden="true" />
      </Link>
    </>
  );
}
