import { AppStatus } from "@/components/lezgo/app-status";
import { StickerLoading } from "@/components/lezgo/launch/loading";
import { GhostBar } from "@/components/lezgo/sharing/ghost-bar";
import { summaryQuery } from "@/lib/community-data";
import { queueGo } from "@/lib/launch/offline";
import { pageHead } from "@/lib/page-head";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { AlertTriangle, ArrowRight, Minus, Plus, Share2, RotateCcw, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/lezgo/app-shell";
import { CountUp } from "@/components/lezgo/count-up";
import { ChaosIcon } from "@/components/icons";
import { GlobeIcon, TodayFlame } from "@/components/icons/tab-icons";
import { BottomSheet, Avatar, Field, Num, StickerButton, inputCls } from "@/components/lezgo/ui";
import { LangGrid } from "@/components/lezgo/lang-switcher";
import { HabitTile, habitName } from "@/components/lezgo/today/habit-tile";
import { SalatCard } from "@/components/lezgo/today/salat-card";
import { CountCard } from "@/components/lezgo/today/count-card";
import { Compose } from "@/components/lezgo/community/compose";
import {
  dayQuery,
  errKey,
  habitsQuery,
  myCrewQuery,
  profileQuery,
  useBase,
  type Checkin,
  type DayExtras,
  type DailyScore,
  type HabitPoints,
  type UserHabit,
} from "@/lib/data";
import { completion, fmtVal, stepFor, type PrayerState } from "@/lib/habits";
import {
  canSpin,
  habitColor,
  incrementCount,
  DAILY_DARE_COUNT,
  streakAtRisk,
} from "@/lib/today-rules";
import { daysBetween, localHour, pad, useNow } from "@/lib/time";
import { FitHeading } from "@/components/lezgo/fit-heading";
import { TodayMoments } from "@/components/lezgo/signature/moments";
export const Route = createFileRoute("/_authenticated/today")({
  head: () => pageHead("Today — lezgo", "Log today's gos and keep your go streak alive."),
  component: Today,
});
type DayData = {
  checkins: Checkin[];
  score: DailyScore | null;
  extras: DayExtras | null;
  points: HabitPoints[];
};

function Today() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { uid, season, today, tz, profile } = useBase();
  const sid = season?.id ?? "";
  const summary=useQuery({...summaryQuery(uid,sid),enabled:!!uid&&!!sid});
  const [tinyWin,setTinyWin]=useState(false);
  const habits = useQuery({ ...habitsQuery(uid, sid), enabled: !!uid && !!sid });
  const mine = useQuery({ ...myCrewQuery(uid, sid), enabled: !!uid && !!sid });
  const dq = dayQuery(uid, sid, today);
  const day = useQuery({ ...dq, enabled: !!uid && !!sid });
  const [popId, setPopId] = useState<string | null>(null);
  const [perfectOpen, setPerfectOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const [city, setCity] = useState("");
  const [stepper, setStepper] = useState<UserHabit | null>(null);
  const [proofOpen, setProofOpen] = useState(false);
  const [winOpen, setWinOpen] = useState(false);
  const [bonusBusy, setBonusBusy] = useState(false);
  const [pending, setPending] = useState(0);
  const revision = useRef(0);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const now = useNow(30_000);
  const data = day.data;
  const score = data?.score;
  const list = habits.data ?? [];
  const byHabit = new Map((data?.checkins ?? []).map((c) => [c.user_habit_id, c]));
  const comps = list.map((h) => completion(h, byHabit.get(h.id)));
  const missing = list.filter((_, i) => (comps[i] ?? 0) < 1);
  const avg = list.length ? comps.reduce((a, b) => a + b, 0) / list.length : 0;
  const dayIndex = season ? daysBetween(season.starts_on, today) + 1 : 1;
  const seasonLength = season ? daysBetween(season.starts_on, season.ends_on) + 1 : 40;
  const closed = !!season && (today < season.starts_on || today > season.ends_on);
  const atRisk = !!now && streakAtRisk(localHour(tz, now), avg, list.length > 0, closed);
  const salat = list.find((h) => h.kind === "salat");
  const points = new Map((data?.points ?? []).map((p) => [p.id, p]));
  const chaosIndex =
    data?.extras?.chaos_index ??
    (((dayIndex - 1) % DAILY_DARE_COUNT) + DAILY_DARE_COUNT) % DAILY_DARE_COUNT;
  const dares = t("todayDesign.dares", { returnObjects: true }) as string[];
  const chaosDone = !!data?.extras?.chaos_done;
  const spins = data?.extras?.chaos_spins ?? 0;
  const disabled = closed || day.isLoading;

  useEffect(() => {
    if (!score?.perfect || !uid) return;
    const key = `lezgo_perfect_${uid}_${sid}_${today}`;
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, "1");
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const css = getComputedStyle(document.documentElement);
      void confetti({
        particleCount: 140,
        spread: 80,
        origin: { y: 0.3 },
        colors: ["--lime", "--orange", "--yellow", "--pink", "--blue"].map((token) =>
          css.getPropertyValue(token).trim(),
        ),
      });
    }
    setPerfectOpen(true);
  }, [score?.perfect, uid, sid, today]);
  function patch(fn: (d: DayData) => DayData) {
    qc.setQueryData(dq.queryKey, (old: DayData | undefined) =>
      fn(old ?? { checkins: [], score: null, extras: null, points: [] }),
    );
  }
  async function reconcile() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: dq.queryKey }),
      qc.invalidateQueries({ queryKey: ["scores"] }),
      qc.invalidateQueries({ queryKey: ["leaderboard"] }),
      qc.invalidateQueries({ queryKey: ["crewToday"] }),
    ]);
  }
  function log(h: UserHabit, value: number, detail: Checkin["detail"] = null) {
    if (disabled) return;
    patch((d) => {
      const prev = d.checkins.find((c) => c.user_habit_id === h.id);
      const row: Checkin = {
        ...(prev ?? {
          id: `tmp-${h.id}`,
          user_id: uid,
          user_habit_id: h.id,
          is_demo: profile?.is_demo ?? false,
          day: today,
          created_at: new Date().toISOString(),
        }),
        value,
        detail,
      };
      return { ...d, checkins: [...d.checkins.filter((c) => c.user_habit_id !== h.id), row] };
    });
    if (completion(h, { value, detail }) >= 1) {
      setPopId(h.id);
      setTimeout(() => setPopId(null), 350);
    }
    const writeRevision = ++revision.current;
    setPending((n) => n + 1);
    queue.current = queue.current
      .catch(() => {})
      .then(async () => {
        try {
          if (!navigator.onLine) { queueGo({uid,habit:h.id,day:today,value,detail}); toast(t("batch9.queued")); return; }
          const { data: serverScore, error } = await supabase.rpc("checkin_upsert", {
            _user_habit_id: h.id,
            _value: value,
            _detail: detail,
            _day: today,
          });
          if (error) throw error;
          // The server owns point allocation and the total; reconcile after each serialized write.
          const allocation = await supabase.rpc("today_habit_points", {
            _season_id: sid,
            _day: today,
          });
          if (allocation.error) throw allocation.error;
          patch((d) => ({
            ...d,
            score: serverScore as unknown as DailyScore,
            points: allocation.data as unknown as HabitPoints[],
          }));
          if (writeRevision === revision.current) await reconcile();
          if(value>0)setTinyWin(true);
          void qc.invalidateQueries({queryKey:["boss"]});
          void qc.invalidateQueries({queryKey:["ghost"]});
          void qc.invalidateQueries({queryKey:["signature"]});
          void qc.invalidateQueries({queryKey:["profileSummary"]});
        } catch (e) {
          if (!navigator.onLine) { queueGo({uid,habit:h.id,day:today,value,detail}); toast(t("batch9.queued")); return; }
          toast(errKey(e) === "day_final" ? t("integrity.dayFinal") : errKey(e) === "day_closed" ? t("today.closed") : t("common.error"));
          await qc.invalidateQueries({ queryKey: dq.queryKey });
        } finally {
          setPending((n) => n - 1);
        }
      });
    void queue.current.then(() => {
      void qc.invalidateQueries({ queryKey: ["scores"] });
      void qc.invalidateQueries({ queryKey: ["leaderboard"] });
    });
  }
  function tap(h: UserHabit) {
    if (h.template?.key === 'detox') {
      void navigate({ to: '/detox' });
      return;
    }
    if (h.kind === "salat") {
      document
        .getElementById("salat-today")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const value = Number(byHabit.get(h.id)?.value ?? 0);
    log(
      h,
      h.kind === "count" ? incrementCount(value) : completion(h, byHabit.get(h.id)) >= 1 ? 0 : 1,
    );
  }
  async function toggleChaos() {
    if (bonusBusy || disabled) return;
    setBonusBusy(true);
    await queue.current;
    try {
      const { error } = await supabase.rpc("set_chaos_done", {
        _season_id: sid,
        _done: !chaosDone,
        _day: today,
      });
      if (error) throw error;
      await reconcile();
    } catch {
      toast(t("common.error"));
    } finally {
      setBonusBusy(false);
    }
  }
  async function spin() {
    if (!canSpin(spins) || bonusBusy || disabled) return;
    setBonusBusy(true);
    await queue.current;
    try {
      const { error } = await supabase.rpc("spin_daily_chaos", { _season_id: sid });
      if (error) throw error;
      await reconcile();
    } catch (e) {
      toast(
        (e as { message?: string }).message?.includes("spin_limit")
          ? t("todayDesign.spinLimit")
          : t("common.error"),
      );
    } finally {
      setBonusBusy(false);
    }
  }
  async function saveCity() {
    if (!city.trim()) return;
    const { error } = await supabase.from("profiles").update({ city: city.trim() }).eq("id", uid);
    if (error) {
      toast(t("common.error"));
      return;
    }
    await qc.invalidateQueries({ queryKey: profileQuery(uid).queryKey });
    setCityOpen(false);
  }
  const stacks = [
    { key: "perfect", points: 20, on: !!score?.perfect, color: "lime", action: null },
    {
      key: "proof",
      points: 10,
      on: !!data?.extras?.proof_posted,
      color: "card",
      action: () => setProofOpen(true),
    },
    { key: "chaos", points: 10, on: chaosDone, color: "purple", action: () => void toggleChaos() },
    ...(mine.data
      ? [{ key: "crew", points: 10, on: !!score?.crew_sync, color: "blue", action: null }]
      : []),
    ...(list.some((h) => h.kind === "lift") || (data?.extras?.lift_prs ?? 0) > 0
      ? [
          {
            key: "lift",
            points: 5,
            on: (data?.extras?.lift_prs ?? 0) > 0,
            color: "orange",
            action: null,
          },
        ]
      : []),
  ];
  if (!season || !profile)
    return (
      <AppShell todayLayout>
        <StickerLoading />
      </AppShell>
    );
  return (
    <AppShell todayLayout>
      <header className="today-top">
        <Link to="/trail" className="day-sticker" aria-label={t('batch8.viewTrail')}>
          <span>{t("todayDesign.day")}</span>{" "}
          <Num>
            {pad(Math.min(Math.max(dayIndex, 1), seasonLength))}/{seasonLength}
          </Num>
        </Link>
        <div className="today-top-end">
          <AppStatus profile={profile} compact />
          <StickerButton
            variant="secondary"
            className="today-settings"
            aria-label={t("todayDesign.settings")}
            onClick={() => setSettingsOpen(true)}
          >
            <GlobeIcon />
          </StickerButton>
          <span className="streak-pill">
            <TodayFlame />
            <span>
              <Num>{score?.streak ?? 0}</Num> {t("todayDesign.days")} ·{" "}
              <Num>×{Number(score?.multiplier ?? 1).toFixed(2)}</Num>
            </span>
          </span>
        </div>
      </header>
      {!!now && localHour(tz, now) < 3 && <p className="locks-note num" role="status"><Lock size={14} aria-hidden />{t("integrity.locksAt")}</p>}
      {summary.data?.mode==="solo"&&<GhostBar uid={uid} sid={sid}/>}
      {tinyWin&&<Link to="/small-wins"><StickerButton block variant="lime" size="sm"><Share2 size={18}/>{t("batch6.winTitle")}</StickerButton></Link>}
      <section className="today-score" aria-busy={pending > 0}>
        <div className="today-score-row">
          <div className="score-heading">
            <FitHeading text={t("todayDesign.today")} className="today-title" requestedSize={40} />
            <p className="score-breakdown">
              <span>
                {t("todayDesign.habits")} <Num>{fmtVal(Number(score?.habit_points ?? 0))}</Num> +{" "}
                {t("todayDesign.stacks")} <Num>{fmtVal(Number(score?.stack_points ?? 0))}</Num> ×{" "}
                <Num>{Number(score?.multiplier ?? 1).toFixed(2)}</Num>
              </span>
            </p>
          </div>
          <div className="score-total">
            <CountUp value={score?.total ?? 0} className="today-score-number" />
            <span>{t("common.pts")}</span>
          </div>
        </div>
        <div className="habit-progress">
          {list.map((h, i) => (
            <div
              key={h.id}
              className="progress-segment"
              role="progressbar"
              aria-label={habitName(h, t, i18n.language)}
              aria-valuenow={Math.round((comps[i] ?? 0) * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <span
                data-color={
                  h.template?.color ?? habitColor(h.template?.key ?? "", h.template?.category ?? "")
                }
                className="progress-fill"
                style={{ width: `${(comps[i] ?? 0) * 100}%` }}
              />
            </div>
          ))}
        </div>
        <Link to="/scoring" className="today-scoring-link">
          {t("socialDesign.scoring")}
          <ArrowRight size={14} className="rtl:-scale-x-100" />
        </Link>
        <div className="today-stacks">
          <span className="stacks-label">{t("todayDesign.stacksLabel")}</span>
          {stacks.map((s) =>
            s.action ? (
              <StickerButton
                variant="ghost"
                key={s.key}
                className={`stack-chip ${s.on ? "is-on" : ""}`}
                data-color={s.color}
                aria-pressed={s.on}
                onClick={s.action}
                disabled={disabled || bonusBusy}
              >
                {t(`todayDesign.${s.key}`)} <Num>+{s.points}</Num>
              </StickerButton>
            ) : (
              <span
                key={s.key}
                data-color={s.color}
                className={`stack-chip ${s.on ? "is-on" : ""}`}
              >
                {t(`todayDesign.${s.key}`)} <Num>+{s.points}</Num>
              </span>
            ),
          )}
        </div>
      </section>
      {closed && <p className="today-banner bg-card">{t("todayDesign.dayClosed")}</p>}
      <TodayMoments missing={missing} pending={pending} onDone={h=>h.kind==='salat'||h.template?.key==='detox'?tap(h):log(h,Number(h.target))} />
      {score?.comeback && (
        <section className="today-banner bg-blue">
          <h2 className="font-extrabold">{t("todayDesign.comeBack")}</h2>
          <p>{t("todayDesign.comebackBody")}</p>
        </section>
      )}
      {atRisk && (
        <section className="today-banner bg-yellow">
          <h2 className="flex items-center gap-2 font-extrabold">
            <AlertTriangle size={20} />
            {t("today.riskTitle")}
          </h2>
          <p>{t("today.riskBody")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {missing.map((h) => (
              <StickerButton variant="secondary" size="sm" key={h.id} onClick={() => tap(h)}>
                {habitName(h, t, i18n.language)}
              </StickerButton>
            ))}
          </div>
        </section>
      )}
      {day.error && (
        <StickerButton variant="secondary" onClick={() => void day.refetch()}>
          {t("common.error")} · {t("todayDesign.retry")}
        </StickerButton>
      )}
      {list.length ? (
        <div className="today-habit-grid">
          {list.map((h) => (
            <HabitTile
              key={h.id}
              habit={h}
              value={Number(byHabit.get(h.id)?.value ?? 0)}
              completion={completion(h, byHabit.get(h.id))}
              points={points.get(h.id)}
              pop={popId === h.id}
              onTap={() => tap(h)}
              onStepper={() => setStepper(h)}
              disabled={disabled}
            />
          ))}
        </div>
      ) : (
        <div className="today-banner bg-card">
          <p>{t("today.noHabits")}</p>
          <Link to="/habits" className="font-extrabold underline">
            {t("today.pickHabits")}
          </Link>
        </div>
      )}
      {salat && (
        <div id="salat-today">
          <SalatCard
            uid={uid}
            day={today}
            city={profile.city}
            country={profile.country_code}
            points={points.get(salat.id)}
            prayers={
              (byHabit.get(salat.id)?.detail as { prayers?: Record<string, PrayerState> } | null)
                ?.prayers ?? {}
            }
            onCity={() => {
              setCity(profile.city ?? "");
              setCityOpen(true);
            }}
            disabled={disabled}
            onChange={(prayers) =>
              log(
                salat,
                Object.values(prayers).reduce(
                  (n, v) => n + (v === "on_time" ? 1 : v === "late" ? 0.5 : 0),
                  0,
                ),
                { prayers },
              )
            }
          />
        </div>
      )}
      {list
        .filter((h) => h.kind === "count")
        .map((h) => (
          <CountCard
            key={h.id}
            habit={h}
            value={Number(byHabit.get(h.id)?.value ?? 0)}
            onIncrement={() => tap(h)}
            onEdit={() => setStepper(h)}
            disabled={disabled}
          />
        ))}
      <section className="daily-chaos">
        <ChaosIcon size={30} className="shrink-0" />
        <div className="chaos-copy">
          <h2>
            {t("todayDesign.chaosTitle")} · <Num>+10</Num>
          </h2>
          <p>{dares[chaosIndex]}</p>
        </div>
        <div className="chaos-actions">
          <StickerButton
            variant="secondary"
            className="chaos-spin"
            disabled={disabled || bonusBusy || !canSpin(spins)}
            title={canSpin(spins) ? t("todayDesign.spin") : t("todayDesign.spinLimit")}
            onClick={() => void spin()}
          >
            {t("todayDesign.spin")}
          </StickerButton>
          <StickerButton
            variant="ghost"
            className={`chaos-do ${chaosDone ? "is-done" : ""}`}
            aria-pressed={chaosDone}
            disabled={disabled || bonusBusy}
            onClick={() => void toggleChaos()}
          >
            {t(chaosDone ? "todayDesign.done" : "todayDesign.doIt")}
          </StickerButton>
        </div>
      </section>
      {missing.length === 0 && list.length > 0 && (
        <Link to="/ranks" className="today-next">
          {t("today.nextDone")}
          <ArrowRight size={18} className="rtl:-scale-x-100" />
        </Link>
      )}
      <BottomSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title={t("todayDesign.settings")}
      >
        <Link
          to="/profile"
          onClick={() => setSettingsOpen(false)}
          className="mb-5 flex items-center gap-3"
        >
          <Avatar id={profile.id} name={profile.display_name} url={profile.avatar_url} size={44} />
          <span className="font-extrabold">{profile.display_name}</span>
        </Link>
        <LangGrid
          onPick={async (language) => {
            if (!profile?.is_demo) await supabase.from("profiles").update({ language }).eq("id", uid);
            await qc.invalidateQueries({ queryKey: profileQuery(uid).queryKey });
            setSettingsOpen(false);
          }}
        />
        <Link to="/settings" className="mt-5 block font-extrabold underline">
          {t("common.settings")}
        </Link>
      </BottomSheet>
      <BottomSheet open={cityOpen} onClose={() => setCityOpen(false)} title={t("todayDesign.city")}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void saveCity();
          }}
          className="space-y-4"
        >
          <Field label={t("todayDesign.city")}>
            <input
              className={inputCls}
              maxLength={100}
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </Field>
          <StickerButton block type="submit" disabled={!city.trim()}>
            {t("common.save")}
          </StickerButton>
        </form>
      </BottomSheet>
      <BottomSheet
        open={stepper !== null}
        onClose={() => setStepper(null)}
        title={stepper ? habitName(stepper, t, i18n.language) : ""}
      >
        {stepper && (
          <div className="space-y-4">
            <p className="text-center font-semibold">{t("todayDesign.countTitle")}</p>
            <div className="flex items-center justify-center gap-5">
              <StickerButton
                variant="secondary"
                aria-label={t("todayDesign.decrease")}
                onClick={() =>
                  log(
                    stepper,
                    Math.max(
                      0,
                      Number(byHabit.get(stepper.id)?.value ?? 0) -
                        stepFor(stepper.unit, Number(stepper.target)),
                    ),
                  )
                }
              >
                <Minus />
              </StickerButton>
              <Num className="text-[32px] font-bold">
                {fmtVal(Number(byHabit.get(stepper.id)?.value ?? 0))}
              </Num>
              <StickerButton
                aria-label={t("todayDesign.increase")}
                onClick={() =>
                  log(
                    stepper,
                    Number(byHabit.get(stepper.id)?.value ?? 0) +
                      stepFor(stepper.unit, Number(stepper.target)),
                  )
                }
              >
                <Plus />
              </StickerButton>
            </div>
            <div className="flex gap-3">
              <StickerButton variant="secondary" onClick={() => log(stepper, 0)}>
                <RotateCcw size={18} />
                {t("todayDesign.undo")}
              </StickerButton>
              <StickerButton
                block
                onClick={() => {
                  log(stepper, Number(stepper.target));
                  setStepper(null);
                }}
              >
                {t("todayDesign.complete")}
              </StickerButton>
            </div>
          </div>
        )}
      </BottomSheet>
      <Compose open={proofOpen} onClose={() => setProofOpen(false)} />
      <Compose
        open={winOpen}
        onClose={() => setWinOpen(false)}
        initialType="win"
        initialBody={t("today.shareText", { score: score?.total ?? 0, streak: score?.streak ?? 0 })}
      />
      <BottomSheet
        open={perfectOpen}
        onClose={() => setPerfectOpen(false)}
        title={t("today.perfectTitle")}
      >
        <p className="font-semibold">{t("today.perfectBody")}</p>
        <StickerButton
          block
          variant="lime"
          className="mt-4"
          onClick={() => {
            setPerfectOpen(false);
            void navigate({to:"/small-wins"});
          }}
        >
          {t("batch4.shareWin")}
        </StickerButton>
        <StickerButton
          block
          className="mt-5"
          onClick={async () => {
            const text = t("today.shareText", {
              score: score?.total ?? 0,
              streak: score?.streak ?? 0,
            });
            try {
              if (navigator.share) await navigator.share({ text, url: window.location.origin });
              else {
                await navigator.clipboard.writeText(text);
                toast(t("crew.copied"));
              }
            } catch {
              /* share cancelled */
            }
            setPerfectOpen(false);
          }}
        >
          <Share2 size={20} />
          {t("today.share")}
        </StickerButton>
      </BottomSheet>
    </AppShell>
  );
}
