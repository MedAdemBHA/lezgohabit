import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { AlertTriangle, ArrowRight, Check, Minus, Plus, Share2, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/lezgo/app-shell";
import { CountUp } from "@/components/lezgo/count-up";
import { FlameIcon } from "@/components/lezgo/icons";
import { HabitIcon } from "@/components/lezgo/habit-icon";
import { BottomSheet, Chip, Num, StickerButton, StickerCard } from "@/components/lezgo/ui";
import { dayQuery, errKey, habitsQuery, useBase, type Checkin, type DailyScore, type UserHabit } from "@/lib/data";
import { chaosFor, completion, fmtVal, PRAYERS, stepFor, type PrayerState } from "@/lib/habits";
import { loc } from "@/lib/i18n";
import { daysBetween, localHour, useNow } from "@/lib/time";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/today")({
  head: () => ({ meta: [{ title: "Today — lezgo" }, { name: "description", content: "Log today's gos and keep your go streak alive." }] }),
  component: Today,
});

type DayData = { checkins: Checkin[]; score: DailyScore | null; extras: { chaos_done: boolean; proof_posted: boolean; lift_prs: number } | null };

function Today() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const qc = useQueryClient();
  const { uid, season, today, tz, profile } = useBase();
  const sid = season?.id ?? "";
  const habits = useQuery({ ...habitsQuery(uid, sid), enabled: !!uid && !!sid });
  const dq = dayQuery(uid, sid, today);
  const day = useQuery({ ...dq, enabled: !!uid && !!sid });
  const [salatFor, setSalatFor] = useState<UserHabit | null>(null);
  const [popId, setPopId] = useState<string | null>(null);
  const [perfectOpen, setPerfectOpen] = useState(false);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const now = useNow(60_000);

  const data = day.data as DayData | undefined;
  const score = data?.score;
  const list = habits.data ?? [];
  const byHabit = new Map((data?.checkins ?? []).map((c) => [c.user_habit_id, c]));
  const comps = list.map((h) => completion(h, byHabit.get(h.id)));
  const avg = list.length ? comps.reduce((a, b) => a + b, 0) / list.length : 0;

  const dayIndex = season ? daysBetween(season.starts_on, today) + 1 : 1;
  const total = season ? daysBetween(season.starts_on, season.ends_on) + 1 : 40;
  const chaosKey = chaosFor(dayIndex);

  useEffect(() => {
    if (!score?.perfect) return;
    const k = `lezgo_perfect_${today}`;
    if (localStorage.getItem(k)) return;
    localStorage.setItem(k, "1");
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      void confetti({ particleCount: 140, spread: 80, origin: { y: 0.3 }, colors: ["#C8F560", "#FF7A2F", "#FFD43B", "#FF8FC7", "#7FB2FF"] });
    }
    setPerfectOpen(true);
  }, [score?.perfect, today]);

  function patch(fn: (d: DayData) => DayData) {
    qc.setQueryData(dq.queryKey, ((old: DayData | undefined) => fn(old ?? { checkins: [], score: null, extras: null })) as never);
  }

  async function send(h: UserHabit, value: number, detail: unknown) {
    try {
      const { data: s, error } = await supabase.rpc("checkin_upsert", { _user_habit_id: h.id, _value: value, _detail: (detail ?? null) as never });
      if (error) throw error;
      patch((d) => ({ ...d, score: s as unknown as DailyScore }));
      void qc.invalidateQueries({ queryKey: ["scores"] });
    } catch (e) {
      toast(errKey(e) === "day_closed" ? t("today.closed") : t("common.error"));
      void qc.invalidateQueries({ queryKey: dq.queryKey });
    }
  }

  function log(h: UserHabit, value: number, detail: unknown = null, debounce = false) {
    patch((d) => {
      const rest = d.checkins.filter((c) => c.user_habit_id !== h.id);
      const prev = d.checkins.find((c) => c.user_habit_id === h.id);
      const row = { ...(prev ?? { id: `tmp-${h.id}`, user_id: uid, user_habit_id: h.id, day: today, created_at: new Date().toISOString() }), value, detail } as Checkin;
      return { ...d, checkins: [...rest, row] };
    });
    if (completion(h, { value, detail: detail as never }) >= 1) { setPopId(h.id); setTimeout(() => setPopId(null), 350); }
    clearTimeout(timers.current[h.id]);
    if (debounce) timers.current[h.id] = setTimeout(() => void send(h, value, detail), 450);
    else void send(h, value, detail);
  }

  function tap(h: UserHabit) {
    const c = byHabit.get(h.id);
    if (h.kind === "salat") { setSalatFor(h); return; }
    const done = completion(h, c) >= 1;
    log(h, done ? 0 : Number(h.kind === "count" ? h.target : 1));
  }

  async function toggleChaos() {
    const next = !data?.extras?.chaos_done;
    patch((d) => ({ ...d, extras: { chaos_done: next, proof_posted: d.extras?.proof_posted ?? false, lift_prs: d.extras?.lift_prs ?? 0 } }));
    const { data: s, error } = await supabase.rpc("set_chaos_done", { _season_id: sid, _done: next });
    if (error) { toast(t("common.error")); void qc.invalidateQueries({ queryKey: dq.queryKey }); return; }
    patch((d) => ({ ...d, score: s as unknown as DailyScore }));
  }

  const missing = list.filter((_, i) => (comps[i] ?? 0) < 1);
  const atRisk = now && list.length > 0 && localHour(tz, now) >= 20 && avg < 0.6;
  const stacks = [
    { k: "perfect", pts: 20, on: !!score?.perfect },
    { k: "proof", pts: 10, on: !!data?.extras?.proof_posted, soon: true },
    { k: "chaos", pts: 10, on: !!data?.extras?.chaos_done },
    { k: "crewSync", pts: 10, on: !!score?.crew_sync },
    { k: "liftPr", pts: 5, on: (data?.extras?.lift_prs ?? 0) > 0, soon: true },
  ];

  if (!season || !profile) return <AppShell><p className="py-10 text-center">{t("common.loading")}</p></AppShell>;

  return (
    <AppShell>
      <section className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[15px] font-bold text-muted-foreground">{loc(season.name, lang)}</p>
          <h1 className="text-[30px] font-extrabold leading-tight">{t("today.day", { n: Math.min(Math.max(dayIndex, 1), total), total })}</h1>
        </div>
      </section>

      <StickerCard className="mt-4 flex items-center justify-between gap-3 bg-ink text-cream shadow-hard-orange">
        <div>
          <p className="text-[13px] font-bold uppercase opacity-70">{t("today.score")}</p>
          <p className="flex items-baseline gap-1.5"><CountUp value={score?.total ?? 0} className="text-[44px] font-bold leading-none text-lime" />
            <span className="text-[14px] opacity-70">{t("common.pts")}</span></p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-cream px-3 py-1 text-ink">
            <FlameIcon size={22} dim={!score?.streak} /><Num className="text-[18px] font-bold">{score?.streak ?? 0}</Num>
            <span className="text-[13px] font-bold">{t("today.streak")}</span>
          </span>
          <span className="rounded-full bg-lime px-3 py-1 text-[15px] font-bold text-ink"><Num>×{Number(score?.multiplier ?? 1).toFixed(2)}</Num></span>
        </div>
      </StickerCard>

      {atRisk && (
        <div className="mt-4 rounded-[18px] bg-yellow p-4 sticker-border shadow-hard">
          <p className="flex items-center gap-2 text-[16px] font-extrabold"><AlertTriangle strokeWidth={2.5} className="size-5" />{t("today.riskTitle")}</p>
          <p className="mt-1 text-[14px] font-semibold">{t("today.riskBody")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {missing.map((h) => <Chip key={h.id} onClick={() => tap(h)}>{h.custom_name ?? loc(h.template?.name, lang)}</Chip>)}
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <StickerCard className="mt-5 text-center">
          <p className="text-[17px] font-bold">{t("today.noHabits")}</p>
          <Link to="/habits" className="mt-3 inline-block"><StickerButton>{t("today.pickHabits")}</StickerButton></Link>
        </StickerCard>
      ) : (
        <>
          <p className="mt-5 mb-2 text-[14px] font-semibold text-muted-foreground">{t("today.tapHint")}</p>
          <div className="grid grid-cols-2 gap-3">
            {list.map((h, i) => {
              const c = byHabit.get(h.id);
              const comp = comps[i] ?? 0;
              const done = comp >= 1;
              const name = h.custom_name ?? loc(h.template?.name, lang);
              const val = Number(c?.value ?? 0);
              const step = stepFor(h.unit, Number(h.target));
              return (
                <div key={h.id} className={cn("relative h-[92px] min-w-0 overflow-hidden rounded-[18px] sticker-border shadow-hard", done ? "bg-lime" : "bg-card", popId === h.id && "animate-pop")}>
                  {comp > 0 && !done && <div className="absolute inset-y-0 start-0 bg-lime/60" style={{ width: `${comp * 100}%` }} />}
                  <button type="button" onClick={() => tap(h)} aria-pressed={done} className="relative flex size-full flex-col justify-between p-3 text-start">
                    <span className="flex items-center justify-between gap-2">
                      <HabitIcon name={h.template?.icon ?? "sparkles"} className="size-6 shrink-0" />
                      {done && h.kind !== "count" && <span className="grid size-6 place-items-center rounded-full bg-ink text-lime"><Check strokeWidth={3} className="size-4" /></span>}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-extrabold leading-tight">{name}</span>
                      {h.kind === "count" && <Num className="text-[12px] font-bold text-muted-foreground">{fmtVal(val)}/{fmtVal(Number(h.target))}{h.unit ? ` ${h.unit}` : ""}</Num>}
                      {h.kind === "salat" && <Num className="text-[12px] font-bold text-muted-foreground">{fmtVal(comp * 5)}/5</Num>}
                    </span>
                  </button>
                  {h.kind === "count" && (
                    <div className="absolute top-2 end-2 flex gap-1.5" dir="ltr">
                      <button type="button" aria-label="−" onClick={() => log(h, Math.max(0, +(val - step).toFixed(2)), null, true)}
                        className="press grid size-9 place-items-center rounded-[10px] bg-card sticker-border shadow-hard-sm"><Minus strokeWidth={3} className="size-4" /></button>
                      <button type="button" aria-label="+" onClick={() => log(h, +(val + step).toFixed(2), null, true)}
                        className="press grid size-9 place-items-center rounded-[10px] bg-ink text-lime sticker-border shadow-hard-sm"><Plus strokeWidth={3} className="size-4" /></button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      <h2 className="mt-6 mb-2 text-[18px] font-extrabold">{t("today.stacks")}</h2>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2">
        {stacks.map((s) => (
          <span key={s.k} className={cn("flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full px-3 text-[14px] font-bold sticker-border",
            s.on ? "bg-lime shadow-hard-sm" : "dashed-ink bg-transparent text-muted-foreground")}>
            {s.on && <Check strokeWidth={3} className="size-4" />}{t(`today.${s.k}`)} <Num>+{s.pts}</Num>
            {s.soon && !s.on && <span className="text-[12px]">· {t("today.soon")}</span>}
          </span>
        ))}
      </div>

      <StickerCard className={cn("mt-4", data?.extras?.chaos_done ? "bg-lime" : "bg-pink")}>
        <p className="flex items-center gap-1.5 text-[13px] font-extrabold uppercase"><Zap strokeWidth={2.5} className="size-4" />{t("today.chaosTitle")} · <Num>+10</Num></p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-[18px] font-extrabold leading-snug">{t(`chaos.${chaosKey}`)}</p>
          <StickerButton size="sm" variant={data?.extras?.chaos_done ? "secondary" : "primary"} onClick={toggleChaos}>
            {data?.extras?.chaos_done ? t("today.chaosUndo") : t("today.chaosBtn")}
          </StickerButton>
        </div>
      </StickerCard>

      <div className="mt-6">
        {missing.length === 0 && list.length > 0 ? (
          <Link to="/ranks" className="block"><StickerButton block>{t("today.nextDone")}<ArrowRight strokeWidth={3} className="size-5 rtl:-scale-x-100" /></StickerButton></Link>
        ) : list.length > 0 ? (
          <StickerButton block variant="secondary" onClick={() => { if (missing[0]) tap(missing[0]); }}>
            {t("today.next")}<ArrowRight strokeWidth={3} className="size-5 rtl:-scale-x-100" />
          </StickerButton>
        ) : null}
      </div>

      <BottomSheet open={!!salatFor} onClose={() => setSalatFor(null)} title={t("today.salatTitle")}>
        {salatFor && <SalatSheet habit={salatFor} checkin={byHabit.get(salatFor.id)} onSave={(detail, value) => log(salatFor, value, detail)} />}
      </BottomSheet>

      <BottomSheet open={perfectOpen} onClose={() => setPerfectOpen(false)} title={t("today.perfectTitle")}>
        <p className="text-[17px] font-semibold">{t("today.perfectBody")}</p>
        <StickerButton block className="mt-5" onClick={async () => {
          const text = t("today.shareText", { score: score?.total ?? 0, streak: score?.streak ?? 0 });
          try { if (navigator.share) await navigator.share({ text, url: "https://joinlezgo.com" }); else { await navigator.clipboard.writeText(text); toast(t("crew.copied")); } } catch { /* cancelled */ }
          setPerfectOpen(false);
        }}><Share2 strokeWidth={2.5} className="size-5" />{t("today.share")}</StickerButton>
      </BottomSheet>
    </AppShell>
  );
}

function SalatSheet({ habit: _h, checkin, onSave }: { habit: UserHabit; checkin?: Checkin | undefined; onSave: (detail: unknown, value: number) => void }) {
  const { t } = useTranslation();
  const init = ((checkin?.detail as { prayers?: Record<string, PrayerState> } | null)?.prayers) ?? {};
  const [pr, setPr] = useState<Record<string, PrayerState>>(init);
  function set(p: string, s: PrayerState) {
    const next = { ...pr, [p]: s };
    setPr(next);
    const value = Object.values(next).reduce((a, v) => a + (v === "on_time" ? 1 : v === "late" ? 0.5 : 0), 0);
    onSave({ prayers: next }, value);
  }
  const opts: { s: PrayerState; cls: string }[] = [{ s: "on_time", cls: "bg-lime" }, { s: "late", cls: "bg-yellow" }, { s: "missed", cls: "bg-muted" }];
  return (
    <div className="space-y-3">
      {PRAYERS.map((p) => (
        <div key={p} className="rounded-[16px] bg-card p-3 sticker-border">
          <p className="mb-2 text-[17px] font-extrabold">{t(`today.${p}`)}</p>
          <div className="grid grid-cols-3 gap-2">
            {opts.map((o) => (
              <button key={o.s} type="button" onClick={() => set(p, o.s)}
                className={cn("press min-h-[44px] rounded-[12px] text-[14px] font-bold sticker-border", pr[p] === o.s ? `${o.cls} shadow-hard-sm` : "bg-card")}>
                {t(o.s === "on_time" ? "today.onTime" : o.s === "late" ? "today.late" : "today.missed")}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
