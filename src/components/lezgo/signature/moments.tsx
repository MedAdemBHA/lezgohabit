import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Flame, RotateCcw, Trophy, Share2, Star, Moon } from "lucide-react";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { useBase, type UserHabit } from "@/lib/data";
import { signatureQuery } from "@/lib/signature-data";
import { supabase } from "@/integrations/supabase/client";
import { loc } from "@/lib/i18n";
import { msToMidnight, useNow, pad, splitMs } from "@/lib/time";
import { FitHeading } from "../fit-heading";
import { StickerButton, Num, BottomSheet } from "../ui";
import { habitName } from "../today/habit-tile";
import { summaryQuery } from "@/lib/community-data";
import { HabitIcon } from "../habit-icon";
export function BadgeSignals() {
  const { uid, season } = useBase();
  const { t } = useTranslation();
  const sid = season?.id ?? "";
  const q = useQuery({ ...summaryQuery(uid, sid), enabled: !!uid && !!sid });
  const busy = useRef(false);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const qc = useQueryClient();
  useEffect(() => {
    if (!q.data || busy.current) return;
    busy.current = true;
    void (async () => {
      for (const badge of q.data.badges) {
        const r = await supabase.rpc("claim_moment", { _season_id: sid, _key: `badge:${badge}` });
        if (r.data && mounted.current)
          toast.custom(() => (
            <div className="badge-unlock sticker">
              <Star fill="currentColor" />
              <div>
                <strong>{t("batch8.badge")}</strong>
                <p>{t(badge === 'halfway' ? 'batch8.halfway' : `socialDesign.${badge}`)}</p>
              </div>
            </div>
          ));
      }
      busy.current = false;
      void qc.invalidateQueries({ queryKey: ["signature"] });
    })();
  }, [q.data, sid, t, qc]);
  return null;
}
export function TodayMoments({
  missing,
  onDone,
  pending,
}: {
  missing: UserHabit[];
  onDone: (h: UserHabit) => void;
  pending: number;
}) {
  const { t, i18n } = useTranslation();
  const { uid, season, today, tz } = useBase();
  const sid = season?.id ?? "";
  const qc = useQueryClient();
  const q = useQuery({ ...signatureQuery(uid, sid), enabled: !!uid && !!sid });
  const [moment, setMoment] = useState<string | null>(null);
  const [lights, setLights] = useState(false);
  const trying = useRef(false);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const now = useNow();
  const data = q.data;
  useEffect(() => {
    if (!data || moment || trying.current || pending) return;
    trying.current = true;
    void (async () => {
      const candidates = ["trophy", "finish", "comeback", "first", `risk:${today}`];
      for (const key of candidates) {
        if (data.seen.includes(key)) continue;
        const r = await supabase.rpc("claim_moment", { _season_id: sid, _key: key });
        if (r.data) {
          if (mounted.current) setMoment(key);
          break;
        }
      }
      if (!data.seen.includes(`lights:${today}`)) {
        const r = await supabase.rpc("claim_moment", { _season_id: sid, _key: `lights:${today}` });
        if (r.data && mounted.current) setLights(true);
      }
      trying.current = false;
    })();
  }, [data, moment, pending, sid, today]);
  useEffect(() => {
    if (!moment || moment.startsWith("risk")) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (moment === "first" || moment === "trophy") {
      const css = getComputedStyle(document.documentElement);
      void confetti({
        particleCount: 85,
        spread: 70,
        zIndex: 101,
        colors: ["--lime", "--orange", "--yellow", "--blue"].map((x) =>
          css.getPropertyValue(x).trim(),
        ),
      });
    }
  }, [moment]);
  async function dismiss() {
    setMoment(null);
    await qc.invalidateQueries({ queryKey: ["signature"] });
  }
  async function remind() {
    const r = await supabase.rpc("remind_moment", { _season_id: sid });
    if (r.error) toast.error(t("common.error"));
    else {
      toast.success(t("batch8.reminded"));
      await dismiss();
    }
  }
  if (!data || !season) return null;
  const time = splitMs(now ? msToMidnight(tz, now) : 0);
  const isRisk = moment?.startsWith("risk");
  return (
    <>
      {data.tomorrow && (
        <p className="today-banner bg-card">{t("batch8.nextMorning", { line: data.tomorrow })}</p>
      )}
      {data.day === 1 && !data.capsule.sealed && (
        <Link className="signature-banner bg-yellow" to="/capsule">
          <Star />
          <span>{t("batch8.capsuleOffer")}</span>
        </Link>
      )}
      {lights && !data.closed && (
        <Link className="signature-banner bg-ink text-lime" to="/lights-out">
          <Moon />
          <span>{t("batch8.lights")}</span>
        </Link>
      )}
      {data.reminder_due && (
        <div className="today-banner bg-yellow">
          <strong>{t("batch8.reminderTitle")}</strong>
          <StickerButton
            size="sm"
            variant="secondary"
            onClick={async () => {
              await supabase.rpc("remind_moment", { _season_id: sid, _read: true });
              await qc.invalidateQueries({ queryKey: ["signature"] });
            }}
          >
            {t("common.close")}
          </StickerButton>
        </div>
      )}
      <BottomSheet
        open={!!isRisk}
        onClose={() => void dismiss()}
        title={t("batch8.riskTitle", { n: missing.length })}
      >
        <div className="risk-countdown num">
          {pad(time.h)}:{pad(time.m)}:{pad(time.s)}
        </div>
        <p className="font-semibold my-3">{t("batch8.riskBody", { n: data.previous_streak })}</p>
        <p className="moment-darja" dir="rtl" lang="aeb">
          {t("batch8.riskDarja")}
        </p>
        <div className="risk-list">
          {missing.map((h) => (
            <div key={h.id} className="risk-habit">
              <HabitIcon name={h.template?.icon ?? null} className="size-8 shrink-0" />
              <div className="min-w-0 flex-1">
                <h3>{habitName(h, t, i18n.language)}</h3>
                <p>{loc(h.template?.description, i18n.language)}</p>
              </div>
              <StickerButton
                variant="lime"
                size="sm"
                disabled={pending > 0}
                onClick={() => {
                  onDone(h);
                  if (h.kind === "salat" || h.template?.key === "detox") void dismiss();
                }}
              >
                {t(
                  h.kind === "salat" || h.template?.key === "detox"
                    ? "common.today"
                    : "batch8.done",
                )}
              </StickerButton>
            </div>
          ))}
        </div>
        <StickerButton
          block
          variant="ghost"
          className="underline mt-4"
          onClick={() => void remind()}
        >
          {t("batch8.remind")}
        </StickerButton>
      </BottomSheet>
      {moment && !isRisk && (
        <div
          className={`moment-screen moment-${moment}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="moment-title"
        >
          <div className="moment-inner">
            <Num className="moment-label">
              {t(
                `batch8.${moment === "first" ? "firstLabel" : moment === "comeback" ? "comebackLabel" : "trophyLabel"}`,
              )}
            </Num>
            <div className="moment-symbol">
              {moment === "first" ? <Flame /> : moment === "comeback" ? <RotateCcw /> : <Trophy />}
            </div>
            <FitHeading
              requestedSize={moment === "comeback" ? 56 : 64}
              text={
                moment === "first"
                  ? t("batch8.dayOne")
                  : moment === "comeback"
                    ? t("batch8.welcome")
                    : moment === "trophy"
                      ? t("batch8.of", { n: data.days_done, total: data.length })
                      : t("batch8.finish", { n: Math.max(0, data.length - data.day) })
              }
              className="moment-heading"
            />
            <h2 id="moment-title">
              {moment === "first"
                ? t("batch8.fire")
                : moment === "trophy"
                  ? t("batch8.trophyBody", { name: loc(season.name, i18n.language) })
                  : ""}
            </h2>
            <p className="moment-darja" dir="rtl" lang="aeb">
              {moment === "first"
                ? t("batch8.firstDarja")
                : moment === "comeback"
                  ? t("batch8.comebackDarja")
                  : moment === "trophy"
                    ? t("batch8.trophyDarja", { n: data.days_done, total: data.length })
                    : ""}
            </p>
            <p className="moment-body">
              {moment === "first"
                ? t("batch8.firstBody")
                : moment === "comeback"
                  ? t("batch8.comebackBody", { n: data.missed })
                  : moment === "finish"
                    ? t("batch8.finishBody")
                    : ""}
            </p>
            {moment === "comeback" && (
              <div className="moment-tags">
                <span>{t("batch8.double")}</span>
                <span>{t("batch8.once")}</span>
              </div>
            )}
            <footer>
              {moment === "first" ? (
                <>
                  <Link to="/small-wins" onClick={()=>void dismiss()}><StickerButton block variant="secondary"><Share2 />{t("batch8.share")}</StickerButton></Link>
                  <StickerButton block onClick={() => void dismiss()}>
                    {t("batch8.keepGoing")}
                  </StickerButton>
                </>
              ) : moment === "comeback" ? (
                <>
                  <StickerButton block onClick={() => void dismiss()}>
                    {t("batch8.letsGo")}
                  </StickerButton>
                  <p>{t("batch8.trailStays")}</p>
                </>
              ) : (
                <>
                  <Link
                    to={moment === "trophy" ? "/wrapped" : "/today"}
                    search={moment === "trophy" ? { season: sid } : {}}
                    onClick={() => void dismiss()}
                  >
                    <StickerButton block variant="lime">
                      {t(moment === "trophy" ? "batch8.wrapped" : "batch8.keepGoing")}
                    </StickerButton>
                  </Link>
                  {moment === "trophy" && (
                    <Link to="/capsule" onClick={() => void dismiss()}>
                      <StickerButton block variant="secondary">
                        {t("batch8.openNote")}
                      </StickerButton>
                    </Link>
                  )}
                </>
              )}
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
