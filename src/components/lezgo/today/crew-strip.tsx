import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowRight, Check, Hand } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/lezgo/ui";
import { supabase } from "@/integrations/supabase/client";
import { challengePulseQuery } from "@/lib/feed-data";

export function TodayCrewStrip({ uid, seasonId }: { uid: string; seasonId: string }) {
  const { t } = useTranslation();
  const pulse = useQuery({ ...challengePulseQuery(uid, seasonId), enabled: !!uid && !!seasonId });
  if (!pulse.data?.crew_id)
    return (
      <section className="today-crew-strip">
        <span>
          <strong>{t("ux.pulseCrew")}</strong>
          <small>{t("challengePulse.noCrew")}</small>
        </span>
        <Link to="/crew" className="today-crew-cta">
          {t("challengePulse.findCrew")}
          <ArrowRight size={16} className="rtl:-scale-x-100" aria-hidden="true" />
        </Link>
      </section>
    );
  const crew = pulse.data.crew;
  // Crew sync only means something with company: alone, point to inviting people instead.
  if (crew.length < 2)
    return (
      <section className="today-crew-strip">
        <span className="today-crew-title">
          <span>
            <strong>{t("ux.aloneShort")}</strong>
            <small>{t("ux.aloneHint")}</small>
          </span>
        </span>
        <Link to="/crew" className="today-crew-cta">
          {t("crew.invite")}
          <ArrowRight size={16} className="rtl:-scale-x-100" aria-hidden="true" />
        </Link>
      </section>
    );
  return <CrewStatus uid={uid} crewId={pulse.data.crew_id} seasonId={seasonId} />;
}

export type MemberToday = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  total: number;
  done: number;
  nudged: boolean;
};
export type MemberState = "done" | "progress" | "idle";

/** Done = every habit complete today; in progress = some; not started = none (server counts). */
export function memberState(m: Pick<MemberToday, "total" | "done">): MemberState {
  if (m.total > 0 && m.done >= m.total) return "done";
  return m.done > 0 ? "progress" : "idle";
}

/** A nudge only makes sense for someone else who hasn't finished and wasn't nudged today. */
export function canNudge(m: MemberToday, uid: string) {
  return m.user_id !== uid && memberState(m) !== "done" && !m.nudged;
}

/** Who has logged today, without leaving Today (crew_today is membership-checked on the server). */
function CrewStatus({ uid, crewId, seasonId }: { uid: string; crewId: string; seasonId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [nudging, setNudging] = useState("");
  const today = useQuery({
    queryKey: ["crewToday", crewId],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("crew_today", { _crew_id: crewId });
      if (error) throw error;
      return (data as unknown as { members: MemberToday[] }).members;
    },
  });
  async function nudge(m: MemberToday) {
    if (nudging) return;
    setNudging(m.user_id);
    const { error } = await supabase.rpc("send_nudge", { _to_user: m.user_id });
    setNudging("");
    if (error) toast(t("common.error"));
    else {
      toast(t("crew.nudgeToast", { name: m.display_name }));
      await qc.invalidateQueries({ queryKey: ["crewToday", crewId] });
      await qc.invalidateQueries({ queryKey: ["challengePulse", uid, seasonId] });
    }
  }
  const members = today.data ?? [];
  const finished = members.filter((m) => memberState(m) === "done").length;
  return (
    <section className="today-crew-status" aria-labelledby="crew-status-title">
      <Link to="/crew-details" className="today-crew-title">
        <span>
          <strong id="crew-status-title">{t("ux.pulseCrew")}</strong>
          <small>{t("crewStatus.summary", { done: finished, total: members.length })}</small>
        </span>
        <ArrowRight size={16} className="rtl:-scale-x-100" aria-hidden="true" />
      </Link>
      {today.isError ? (
        <p>{t("common.error")}</p>
      ) : (
        <ul className="crew-status-list">
          {members.map((m) => {
            const state = memberState(m);
            return (
              <li key={m.user_id} data-state={state}>
                <Avatar id={m.user_id} name={m.display_name} url={m.avatar_url} size={34} />
                <span className="crew-status-name">
                  <strong>{m.user_id === uid ? t("crewStatus.you") : m.display_name}</strong>
                  <small>
                    {state === "done" ? (
                      <>
                        <Check size={12} aria-hidden="true" /> {t("crewStatus.done")}
                      </>
                    ) : state === "progress" ? (
                      t("crewStatus.progress", { done: m.done, total: m.total })
                    ) : (
                      t("crewStatus.idle")
                    )}
                  </small>
                </span>
                {canNudge(m, uid) ? (
                  <button
                    type="button"
                    className="today-crew-cta"
                    disabled={!!nudging}
                    aria-label={t("challengePulse.nudge", { name: m.display_name })}
                    onClick={() => void nudge(m)}
                  >
                    <Hand size={15} aria-hidden="true" />
                    {t("crew.nudge")}
                  </button>
                ) : m.nudged && m.user_id !== uid && state !== "done" ? (
                  <small className="crew-status-nudged">{t("crew.nudged")}</small>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
