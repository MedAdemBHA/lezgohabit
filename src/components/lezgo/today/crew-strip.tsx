import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowRight, Check, Hand } from "lucide-react";
import { toast } from "sonner";
import { Avatar, StickerButton } from "@/components/lezgo/ui";
import { supabase } from "@/integrations/supabase/client";
import { challengePulseQuery } from "@/lib/feed-data";

export function TodayCrewStrip({ uid, seasonId }: { uid: string; seasonId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [nudging, setNudging] = useState("");
  const pulse = useQuery({ ...challengePulseQuery(uid, seasonId), enabled: !!uid && !!seasonId });
  async function nudge(userId: string) {
    if (nudging) return;
    setNudging(userId);
    const { error } = await supabase.rpc("send_nudge", { _to_user: userId });
    setNudging("");
    if (error) toast(t("common.error"));
    else {
      toast(t("crew.nudged"));
      await qc.invalidateQueries({ queryKey: ["challengePulse", uid, seasonId] });
    }
  }
  if (!pulse.data?.crew_id) return <section className="today-crew-strip"><span><strong>{t("todayDesign.crew")}</strong><small>{t("challengePulse.noCrew")}</small></span><Link to="/crew"><StickerButton size="sm" variant="secondary">{t("challengePulse.findCrew")}<ArrowRight size={16} className="rtl:-scale-x-100" /></StickerButton></Link></section>;
  const crew = pulse.data.crew;
  // Crew sync only means something with company: alone, point to inviting people instead.
  if (crew.length < 2) return <section className="today-crew-strip"><span><strong>{t("ux.aloneShort")}</strong><small>{t("ux.aloneHint")}</small></span><Link to="/crew"><StickerButton size="sm" variant="secondary">{t("crew.invite")}<ArrowRight size={16} className="rtl:-scale-x-100" /></StickerButton></Link></section>;
  const checked = crew.filter((member) => member.checked_in).length;
  return (
    <section className="today-crew-strip">
      <Link to="/crew-details" className="today-crew-title"><span><strong>{t("todayDesign.crew")}</strong><small>{t("challengePulse.checkedIn",{done:checked,total:crew.length})}</small></span><ArrowRight size={16} className="rtl:-scale-x-100" /></Link>
      <div className="today-crew-members">
        {crew.map((member) => member.id === uid || member.checked_in ? (
          <span key={member.id} className="today-crew-member" title={member.name}><Avatar id={member.id} name={member.name} url={member.avatar_url} size={34} />{member.checked_in&&<Check size={13} className="today-crew-check" />}</span>
        ) : (
          <button key={member.id} type="button" className="today-crew-member" title={member.name} aria-label={t("challengePulse.nudge",{name:member.name})} disabled={!!nudging} onClick={() => void nudge(member.id)}><Avatar id={member.id} name={member.name} url={member.avatar_url} size={34} /><Hand size={13} className="today-crew-check" /></button>
        ))}
      </div>
      <Link to="/community"><StickerButton size="sm" variant="ghost" aria-label={t("design.community")}><ArrowRight size={18} className="rtl:-scale-x-100" /></StickerButton></Link>
    </section>
  );
}
