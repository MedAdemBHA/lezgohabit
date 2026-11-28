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
import {
  AlertTriangle,
  ArrowRight,
  Compass,
  Minus,
  Plus,
  Share2,
  RotateCcw,
  Lock,
  MoreHorizontal,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/lezgo/app-shell";
import { TodayFlame } from "@/components/icons/tab-icons";
import { BottomSheet, Avatar, Field, Num, StickerButton, inputCls } from "@/components/lezgo/ui";
import { LangGrid } from "@/components/lezgo/lang-switcher";
import { HabitTile, habitName } from "@/components/lezgo/today/habit-tile";
import { SalatCard } from "@/components/lezgo/today/salat-card";
import { ChallengeTitle } from "@/components/lezgo/today/challenge-title";
import { TodayScoreCard } from "@/components/lezgo/today/score-card";
import { BonusSection, NewFeature } from "@/components/lezgo/today/bonus-section";
import { DailyDare } from "@/components/lezgo/today/daily-dare";
import { BossMini } from "@/components/lezgo/today/boss-mini";
import { TodayCrewStrip } from "@/components/lezgo/today/crew-strip";
import { ScoringSheet } from "@/components/lezgo/scoring-sheet";
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
import {
  COUNT_SETTLE_MS,
  completion,
  fmtVal,
  isHeld,
  isSleepHabit,
  stepFor,
  unitLabel,
  type PrayerState,
} from "@/lib/habits";
import { canSpin, habitColor, DAILY_DARE_COUNT, streakAtRisk } from "@/lib/today-rules";
import { daysBetween, localHour, useNow } from "@/lib/time";
import { TodayMoments } from "@/components/lezgo/signature/moments";
import { ChallengeSurrenderSheet } from "@/components/lezgo/challenge-surrender-sheet";
import { SurrenderRecapCard } from "@/components/lezgo/surrender-recap-card";
import { formatNumber, loc } from "@/lib/i18n";
import { bossQuery } from "@/lib/batch6-data";
import { challengeHistoryQuery } from "@/lib/challenge-history";
import { planFor } from "@/lib/challenge-plan";
import { useFeature } from "@/lib/features";
import { WelcomeCard } from "@/components/lezgo/today/welcome-card";
export const Route = createFileRoute("/_authenticated/today")({
  head: () => pageHead("Today · lezgo", "Log today's gos and keep your go streak alive."),
  component: Today,
});
type DayData = {
  checkins: Checkin[];
  score: DailyScore | null;
  extras: DayExtras | null;
  points: HabitPoints[];
};
type TimerSession = {
  id: string;
  tracked_seconds: number;
  target_minutes: number;
  started_at: string;
  habit: UserHabit;
};

function Today() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { uid, season, today, tz, profile, loading } = useBase();
  const sid = season?.id ?? "";
  const summary = useQuery({ ...summaryQuery(uid, sid), enabled: !!uid && !!sid });
  const [tinyWin, setTinyWin] = useState(false);
  const habits = useQuery({ ...habitsQuery(uid, sid), enabled: !!uid && !!sid });
  const mine = useQuery({ ...myCrewQuery(uid, sid), enabled: !!uid && !!sid });
  const dq = dayQuery(uid, sid, today);
  const day = useQuery({ ...dq, enabled: !!uid && !!sid });
  const [popId, setPopId] = useState<string | null>(null);
  const [perfectOpen, setPerfectOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [challengeMenuOpen, setChallengeMenuOpen] = useState(false);
  const [surrenderOpen, setSurrenderOpen] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const [city, setCity] = useState("");
  const [stepper, setStepper] = useState<UserHabit | null>(null);
  const [quitHabit, setQuitHabit] = useState<UserHabit | null>(null);
  const [timerSession, setTimerSession] = useState<TimerSession | null>(null);
  const [proofOpen, setProofOpen] = useState(false);
  const [scoringOpen, setScoringOpen] = useState(false);
  const [winOpen, setWinOpen] = useState(false);
  const [bonusBusy, setBonusBusy] = useState(false);
  const [newDismissed, setNewDismissed] = useState<Record<string, boolean>>({});
  const [newReady, setNewReady] = useState(false);
  const [pending, setPending] = useState(0);
  const revision = useRef(0);
  const bossOn = useFeature("bosses");
  const liftOn = useFeature("lift");
  const dareOn = useFeature("daily_dare");
  const latestWrite = useRef(new Map<string, number>());
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
  const seasonLength = season ? daysBetween(season.starts_on, season.ends_on) + 1 : 1;
  // Features unlock by days *played* in this challenge, so a late joiner still gets a calm day 1.
  const history = useQuery({ ...challengeHistoryQuery(uid), enabled: !!uid && !!sid });
  const entry = history.data?.find((e) => e.season_id === sid);
  const joinedOn = entry
    ? new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(entry.joined_at))
    : null;
  const playDay = joinedOn
    ? Math.max(
        1,
        daysBetween(
          joinedOn < (season?.starts_on ?? joinedOn) ? season!.starts_on : joinedOn,
          today,
        ) + 1,
      )
    : dayIndex;
  const hadPerfectDay = (entry?.perfect_days ?? 0) > 0 || !!score?.perfect;
  const newKey = `lezgo_today_new_${uid}_${sid}`;
  useEffect(() => {
    if (!uid || !sid) return;
    try {
      setNewDismissed(JSON.parse(localStorage.getItem(newKey) ?? "{}") as Record<string, boolean>);
    } catch {
      setNewDismissed({});
    }
    setNewReady(true);
  }, [uid, sid, newKey]);
  const showNew = (key: string, minDay: number) =>
    newReady && playDay >= minDay && !newDismissed[key];
  function dismissNew(key: string) {
    const next = { ...newDismissed, [key]: true };
    setNewDismissed(next);
    try {
      localStorage.setItem(newKey, JSON.stringify(next));
    } catch {
      /* storage can be unavailable */
    }
  }
  const bossOverview = useQuery({
    ...bossQuery(uid, sid),
    enabled: !!uid && !!sid && bossOn && showNew("boss", 5),
  });
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
  useEffect(() => {
    const sessionId = timerSession?.id;
    if (!sessionId) return;
    let sending = false;
    const heartbeat = async () => {
      if (sending) return;
      sending = true;
      try {
        const { data, error } = await supabase.rpc("habit_timer_heartbeat", {
          _session_id: sessionId,
          _visible: document.visibilityState === "visible",
        });
        if (!error)
          setTimerSession((current) =>
            current?.id === sessionId
              ? {
                  ...current,
                  ...(data as unknown as Pick<TimerSession, "tracked_seconds" | "target_minutes">),
                }
              : current,
          );
      } finally {
        sending = false;
      }
    };
    const interval = window.setInterval(() => void heartbeat(), 15_000);
    return () => window.clearInterval(interval);
  }, [timerSession?.id]);
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
          done_at: null,
        }),
        value,
        // The server keeps a pending review's hold on re-saves; mirror it so the tile stays honest.
        detail: isHeld(prev) ? { ...((detail as object | null) ?? {}), held: true } : detail,
      };
      return { ...d, checkins: [...d.checkins.filter((c) => c.user_habit_id !== h.id), row] };
    });
    if (completion(h, { value, detail }) >= 1) {
      setPopId(h.id);
      setTimeout(() => setPopId(null), 350);
    }
    const writeRevision = ++revision.current;
    latestWrite.current.set(h.id, writeRevision);
    const superseded = () => latestWrite.current.get(h.id) !== writeRevision;
    setPending((n) => n + 1);
    queue.current = queue.current
      .catch(() => {})
      .then(async () => {
        try {
          // Only the last value of a burst of taps on the same habit is sent.
          if (superseded()) return;
          if (h.kind === "count") {
            await new Promise((resolve) => setTimeout(resolve, COUNT_SETTLE_MS));
            if (superseded()) return;
          }
          if (!navigator.onLine) {
            queueGo({ uid, habit: h.id, day: today, value, detail });
            toast(t("batch9.queued"));
            return;
          }
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
          if ((serverScore as { held?: boolean } | null)?.held) toast(t("todayDesign.heldToast"));
          else if (value > 0) setTinyWin(true);
          void qc.invalidateQueries({ queryKey: ["boss"] });
          void qc.invalidateQueries({ queryKey: ["ghost"] });
          void qc.invalidateQueries({ queryKey: ["signature"] });
          void qc.invalidateQueries({ queryKey: ["profileSummary"] });
        } catch (e) {
          if (!navigator.onLine) {
            queueGo({ uid, habit: h.id, day: today, value, detail });
            toast(t("batch9.queued"));
            return;
          }
          toast(
            errKey(e) === "outside_time_window"
              ? t("habitRules.outsideWindowError")
              : errKey(e) === "habit_locked"
                ? t("todayDesign.habitLocked")
                : errKey(e) === "day_final"
                  ? t("integrity.dayFinal")
                  : errKey(e) === "day_closed"
                    ? t("today.closed")
                    : t("common.error"),
          );
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
  // Salat goes through mark_prayer: the server checks the city's prayer times and decides on time vs late.
  function markPrayer(h: UserHabit, prayer: string) {
    if (disabled) return;
    if (!navigator.onLine) {
      toast(t("common.error"));
      return;
    }
    setPending((n) => n + 1);
    queue.current = queue.current
      .catch(() => {})
      .then(async () => {
        try {
          const { data: res, error } = await supabase.rpc("mark_prayer", {
            _user_habit_id: h.id,
            _prayer: prayer,
            _day: today,
          });
          if (error) throw error;
          const r = res as unknown as {
            prayers: Record<string, PrayerState>;
            marked_at: Record<string, string>;
            value: number;
          };
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
                done_at: null,
              }),
              value: r.value,
              detail: { prayers: r.prayers, marked_at: r.marked_at },
            };
            return {
              ...d,
              score: res as unknown as DailyScore,
              checkins: [...d.checkins.filter((c) => c.user_habit_id !== h.id), row],
            };
          });
          if (completion(h, { value: r.value, detail: { prayers: r.prayers } }) >= 1) {
            setPopId(h.id);
            setTimeout(() => setPopId(null), 350);
          }
          const allocation = await supabase.rpc("today_habit_points", {
            _season_id: sid,
            _day: today,
          });
          if (!allocation.error)
            patch((d) => ({ ...d, points: allocation.data as unknown as HabitPoints[] }));
          await reconcile();
          if (r.prayers[prayer]) setTinyWin(true);
          void qc.invalidateQueries({ queryKey: ["profileSummary"] });
        } catch (e) {
          const k = errKey(e);
          toast(
            k === "prayer_not_yet"
              ? t("todayDesign.prayerNotYet")
              : k === "habit_locked"
                ? t("todayDesign.habitLocked")
                : k === "day_final"
                  ? t("integrity.dayFinal")
                  : k === "day_closed"
                    ? t("today.closed")
                    : t("common.error"),
          );
          await qc.invalidateQueries({ queryKey: dq.queryKey });
        } finally {
          setPending((n) => n - 1);
        }
      });
  }
  function tap(h: UserHabit) {
    if (h.kind === "timer") {
      void startTimer(h);
      return;
    }
    if (h.kind === "quit") {
      setQuitHabit(h);
      return;
    }
    if (h.template?.key === "detox") {
      void navigate({ to: "/detox" });
      return;
    }
    if (h.kind === "salat") {
      document
        .getElementById("salat-today")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    // Counts open the sheet: one big "Done" saves the target, the stepper handles partial amounts.
    if (h.kind === "count") {
      setStepper(h);
      return;
    }
    log(h, completion(h, byHabit.get(h.id)) >= 1 ? 0 : 1);
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
  async function startTimer(h: UserHabit) {
    if (disabled) return;
    const { data, error } = await supabase.rpc("start_habit_timer", { _user_habit_id: h.id });
    if (error) {
      toast(t("common.error"));
      return;
    }
    setTimerSession({ ...(data as unknown as Omit<TimerSession, "habit">), habit: h });
  }
  async function finishTimer() {
    if (!timerSession || timerSession.tracked_seconds < timerSession.target_minutes * 60) return;
    await queue.current;
    const { error } = await supabase.rpc("complete_habit_timer", { _session_id: timerSession.id });
    if (error) {
      toast(
        errKey(error) === "timer_too_short"
          ? t("habitRules.timerTooShort")
          : errKey(error) === "habit_locked"
            ? t("todayDesign.habitLocked")
            : t("common.error"),
      );
      return;
    }
    setTimerSession(null);
    await reconcile();
    void qc.invalidateQueries({ queryKey: ["profileSummary"] });
  }
  async function cancelTimer() {
    if (!timerSession) return;
    const { error } = await supabase.rpc("cancel_habit_timer", { _session_id: timerSession.id });
    if (error) toast(t("common.error"));
    setTimerSession(null);
  }
  function logSlip() {
    if (!quitHabit) return;
    log(quitHabit, 0, { slip: true });
    setQuitHabit(null);
    toast(t("habitRules.slipSaved"));
  }
  function logCleanDay() {
    if (!quitHabit) return;
    log(quitHabit, 1);
    setQuitHabit(null);
  }
  const progressHabits = list.map((habit, index) => ({
    id: habit.id,
    name: habitName(habit, t, i18n.language),
    color:
      habit.template?.color ??
      habitColor(habit.template?.key ?? "", habit.template?.category ?? ""),
    completion: comps[index] ?? 0,
  }));
  if (!profile || loading)
    return (
      <AppShell todayLayout>
        <StickerLoading />
      </AppShell>
    );
  if (!season)
    return (
      <AppShell title={t("nav.today")}>
        <section className="app-surface today-start-card">
          <Compass size={29} aria-hidden="true" />
          <h2 className="app-section-title">{t("challengeHistory.noActive")}</h2>
          <p>{t("challengeHistory.noActiveBody")}</p>
          <Link to="/start" className="app-row-link today-start-link">
            {t("challengeHistory.pickNext")}
            <ArrowRight size={18} className="rtl:-scale-x-100" aria-hidden="true" />
          </Link>
        </section>
        <SurrenderRecapCard />
        <Link to="/challenges" search={{ season: "" }} className="app-row-link">
          {t("challengeHistory.openHistory")}
          <ArrowRight size={18} className="rtl:-scale-x-100" aria-hidden="true" />
        </Link>
      </AppShell>
    );
  return (
    <AppShell todayLayout>
      <header className="today-top">
        <ChallengeTitle season={season} day={dayIndex} length={seasonLength} />
        <div className="today-top-end">
          <AppStatus profile={profile} compact />
          <StickerButton
            variant="secondary"
            className="today-settings"
            aria-label={t("challengeHistory.menu")}
            onClick={() => setChallengeMenuOpen(true)}
          >
            <MoreHorizontal />
          </StickerButton>
        </div>
      </header>
      {!!now && localHour(tz, now) < 3 && (
        <p className="locks-note num" role="status">
          <Lock size={14} aria-hidden />
          {t("integrity.locksAt")}
        </p>
      )}
      <TodayScoreCard
        score={score}
        habits={progressHabits}
        busy={pending > 0}
        onOpen={() => setScoringOpen(true)}
      />
      {closed && <p className="today-banner bg-card">{t("todayDesign.dayClosed")}</p>}
      {day.error && (
        <StickerButton variant="secondary" onClick={() => void day.refetch()}>
          {t("common.error")} · {t("todayDesign.retry")}
        </StickerButton>
      )}
      {list.length ? (
        <section className="today-checklist" aria-labelledby="today-habits-heading">
          <h2 id="today-habits-heading" className="app-section-title">
            {t("appRefresh.yourHabits")}
          </h2>
          {list.some((habit) => habit.kind !== "salat") && (
            <div className="today-habit-grid">
              {list
                .filter((habit) => habit.kind !== "salat")
                .map((h) => (
                  <HabitTile
                    key={h.id}
                    habit={h}
                    value={Number(byHabit.get(h.id)?.value ?? 0)}
                    completion={completion(h, byHabit.get(h.id))}
                    review={isHeld(byHabit.get(h.id))}
                    points={points.get(h.id)}
                    pop={popId === h.id}
                    onTap={() => tap(h)}
                    onStepper={() => setStepper(h)}
                    disabled={disabled}
                  />
                ))}
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
                  (
                    byHabit.get(salat.id)?.detail as {
                      prayers?: Record<string, PrayerState>;
                    } | null
                  )?.prayers ?? {}
                }
                onCity={() => {
                  setCity(profile.city ?? "");
                  setCityOpen(true);
                }}
                disabled={disabled}
                markedAt={
                  (byHabit.get(salat.id)?.detail as { marked_at?: Record<string, string> } | null)
                    ?.marked_at ?? {}
                }
                onMark={(prayer) => markPrayer(salat, prayer)}
              />
            </div>
          )}
        </section>
      ) : (
        <div className="today-banner bg-card">
          <p>{t("today.noHabits")}</p>
        </div>
      )}
      {showNew("welcome", 1) && playDay === 1 && (
        <WelcomeCard
          name={loc(season.name, i18n.language)}
          plan={planFor(season.starts_on, season.ends_on, today, list.length)}
          habits={list.length}
          onDismiss={() => dismissNew("welcome")}
        />
      )}
      {(playDay >= 3 ||
        showNew("streak", 2) ||
        (showNew("ghost", 2) && summary.data?.mode === "solo") ||
        (showNew("capsule", 1) && hadPerfectDay)) && (
        <BonusSection uid={uid} seasonId={sid} points={Number(score?.stack_points ?? 0)}>
          {playDay >= 3 && (
            <>
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
                    {missing.map((habit) => (
                      <StickerButton
                        variant="secondary"
                        size="sm"
                        key={habit.id}
                        onClick={() => tap(habit)}
                      >
                        {habitName(habit, t, i18n.language)}
                      </StickerButton>
                    ))}
                  </div>
                </section>
              )}
              <TodayMoments
                missing={missing}
                pending={pending}
                onDone={(habit) =>
                  habit.kind === "salat" ||
                  habit.kind === "timer" ||
                  habit.kind === "quit" ||
                  habit.template?.key === "detox"
                    ? tap(habit)
                    : log(habit, Number(habit.target))
                }
              />
              {dareOn && (
                <DailyDare
                  text={dares[chaosIndex] ?? ""}
                  done={chaosDone}
                  canSpin={canSpin(spins)}
                  busy={disabled || bonusBusy}
                  onSpin={() => void spin()}
                  onToggle={() => void toggleChaos()}
                />
              )}
              <div className="flex flex-wrap gap-2">
                <StickerButton variant="secondary" onClick={() => setProofOpen(true)}>
                  {t("todayDesign.proof")}
                </StickerButton>
                {tinyWin ? (
                  <Link to="/small-wins">
                    <StickerButton variant="lime">{t("batch6.winTitle")}</StickerButton>
                  </Link>
                ) : (
                  <Link to="/small-wins">
                    <StickerButton variant="secondary">{t("batch6.winTitle")}</StickerButton>
                  </Link>
                )}
              </div>
            </>
          )}
          {showNew("ghost", 2) && summary.data?.mode === "solo" && (
            <NewFeature title={t("todayDesign.ghostNew")} onDismiss={() => dismissNew("ghost")}>
              <GhostBar uid={uid} sid={sid} />
            </NewFeature>
          )}
          {showNew("streak", 2) && (
            <NewFeature title={t("todayDesign.streakNew")} onDismiss={() => dismissNew("streak")}>
              <div className="streak-pill">
                <TodayFlame />
                <span>
                  <Num>{score?.streak ?? 0}</Num> {t("todayDesign.days")} ·{" "}
                  {t("ux.streakBonus", {
                    m: formatNumber(Number(score?.multiplier ?? 1), i18n.language, {
                      maximumFractionDigits: 2,
                    }),
                  })}
                </span>
              </div>
            </NewFeature>
          )}
          {bossOn && showNew("boss", 5) && bossOverview.data?.boss && (
            <NewFeature title={t("batch6.boss")} onDismiss={() => dismissNew("boss")}>
              <BossMini overview={bossOverview.data} />
            </NewFeature>
          )}
          {showNew("capsule", 1) && hadPerfectDay && (
            <NewFeature title={t("todayDesign.capsuleNew")} onDismiss={() => dismissNew("capsule")}>
              <Link to="/capsule">
                <StickerButton block variant="secondary">
                  {t("batch8.capsule")}
                  <ArrowRight size={18} className="rtl:-scale-x-100" />
                </StickerButton>
              </Link>
            </NewFeature>
          )}
        </BonusSection>
      )}
      <TodayCrewStrip uid={uid} seasonId={sid} />
      {playDay >= 2 && missing.length === 0 && list.length > 0 && (
        <Link to="/ranks" className="today-next">
          {t("today.nextDone")}
          <ArrowRight size={18} className="rtl:-scale-x-100" />
        </Link>
      )}
      <BottomSheet
        open={challengeMenuOpen}
        onClose={() => setChallengeMenuOpen(false)}
        title={loc(season.name, i18n.language)}
      >
        <div className="space-y-3">
          <Link
            to="/challenges"
            search={{ season: season.id }}
            onClick={() => setChallengeMenuOpen(false)}
            className="block"
          >
            <StickerButton block variant="secondary">
              {t("challengeHistory.details")}
            </StickerButton>
          </Link>
          <Link
            to="/challenges"
            search={{ season: "" }}
            onClick={() => setChallengeMenuOpen(false)}
            className="block"
          >
            <StickerButton block variant="secondary">
              {t("challengeHistory.title")}
            </StickerButton>
          </Link>
          <StickerButton
            block
            variant="secondary"
            onClick={() => {
              setChallengeMenuOpen(false);
              setSettingsOpen(true);
            }}
          >
            {t("todayDesign.settings")}
          </StickerButton>
          <StickerButton
            block
            variant="secondary"
            className="text-destructive"
            onClick={() => {
              setChallengeMenuOpen(false);
              setSurrenderOpen(true);
            }}
          >
            {t("challengeHistory.surrender")}
          </StickerButton>
        </div>
      </BottomSheet>
      <ChallengeSurrenderSheet
        seasonId={season.id}
        name={loc(season.name, i18n.language)}
        open={surrenderOpen}
        onClose={() => setSurrenderOpen(false)}
      />
      <ScoringSheet open={scoringOpen} onClose={() => setScoringOpen(false)} />
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
            if (!profile?.is_demo)
              await supabase.from("profiles").update({ language }).eq("id", uid);
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
        open={quitHabit !== null}
        onClose={() => setQuitHabit(null)}
        title={t("habitRules.cleanDay")}
      >
        {quitHabit && (
          <div className="space-y-3">
            <p>{t("habitRules.quitRule")}</p>
            <StickerButton block variant="lime" onClick={logCleanDay}>
              {t("habitRules.cleanDay")}
            </StickerButton>
            <StickerButton block variant="secondary" onClick={logSlip}>
              {t("habitRules.logSlip")}
            </StickerButton>
          </div>
        )}
      </BottomSheet>
      <BottomSheet
        open={timerSession !== null}
        onClose={() => void cancelTimer()}
        title={
          timerSession
            ? habitName(timerSession.habit, t, i18n.language)
            : t("habitRules.timerTitle")
        }
      >
        {timerSession && (
          <div className="space-y-4">
            <p className="text-center text-[14px] font-semibold">{t("habitRules.timerVisible")}</p>
            <Num className="block text-center text-[32px]">
              {t("habitRules.timerProgress", {
                done: Math.floor(timerSession.tracked_seconds / 60),
                total: timerSession.target_minutes,
              })}
            </Num>
            <progress
              className="block h-4 w-full accent-ink"
              value={Math.min(timerSession.tracked_seconds, timerSession.target_minutes * 60)}
              max={timerSession.target_minutes * 60}
            />
            <div className="flex gap-3">
              <StickerButton variant="secondary" onClick={() => void cancelTimer()}>
                {t("habitRules.timerCancel")}
              </StickerButton>
              <StickerButton
                block
                variant="lime"
                disabled={timerSession.tracked_seconds < timerSession.target_minutes * 60}
                onClick={() => void finishTimer()}
              >
                {t("habitRules.timerComplete")}
              </StickerButton>
            </div>
          </div>
        )}
      </BottomSheet>
      <BottomSheet
        open={stepper !== null}
        onClose={() => setStepper(null)}
        title={stepper ? habitName(stepper, t, i18n.language) : ""}
      >
        {stepper && stepper.kind !== "count" && (
          <div className="space-y-3">
            {/* Train (and other one-tap checks): done/undone here too, with Lift as an optional extra. */}
            <StickerButton
              block
              variant={completion(stepper, byHabit.get(stepper.id)) >= 1 ? "secondary" : "lime"}
              onClick={() => {
                tap(stepper);
                setStepper(null);
              }}
            >
              {t(
                completion(stepper, byHabit.get(stepper.id)) >= 1 ? "ux.markUndone" : "ux.markDone",
              )}
            </StickerButton>
            {liftOn && stepper.template?.key === "train" && (
              <Link to="/lift" className="block" onClick={() => setStepper(null)}>
                <StickerButton block variant="secondary">
                  {t("ux.logSets")}
                  <ArrowRight size={18} className="rtl:-scale-x-100" />
                </StickerButton>
              </Link>
            )}
          </div>
        )}
        {stepper && stepper.kind === "count" && (
          <div className="space-y-4">
            {stepper.template?.key !== "screen_limit" && (
              <StickerButton
                block
                size="lg"
                variant="lime"
                onClick={() => {
                  log(stepper, Number(stepper.target));
                  setStepper(null);
                }}
              >
                {isSleepHabit(stepper.template?.key)
                  ? t("ux.sleptEnough", { n: fmtVal(Number(stepper.target)) })
                  : t("ux.doneTarget", {
                      target: fmtVal(Number(stepper.target)),
                      unit: unitLabel(t, stepper.unit),
                    })}
              </StickerButton>
            )}
            <p className="text-center font-semibold">
              {isSleepHabit(stepper.template?.key) ? t("ux.lastNight") : t("ux.orPartial")}
            </p>
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
              <StickerButton block variant="secondary" onClick={() => setStepper(null)}>
                {t("common.done")}
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
            void navigate({ to: "/small-wins" });
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
