import { createFileRoute, Link } from "@tanstack/react-router";
import { PageTitle } from "@/components/lezgo/page-title";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { TrainIcon } from "@/components/icons";
import { AppShell } from "@/components/lezgo/app-shell";
import { Num, Segmented, StickerButton } from "@/components/lezgo/ui";
import { LiftStepper } from "@/components/lezgo/lift-stepper";
import { useBase, dayQuery } from "@/lib/data";
import { liftQuery } from "@/lib/batch5-data";
import { displayWeight, LB_PER_KG } from "@/lib/batch5-rules";
import { loc } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { pageHead } from "@/lib/page-head";
export const Route = createFileRoute("/_authenticated/lift")({
  head: () =>
    pageHead(
      "Lift log · lezgo",
      "Save your lifting session and beat your previous results with your own kit.",
    ),
  loader: ({ context }) => context.queryClient.ensureQueryData(liftQuery(context.user.id)),
  component: Lift,
});
function Lift() {
  const { t, i18n } = useTranslation();
  const { profile, season, today } = useBase();
  const uid = Route.useRouteContext().user.id;
  const qc = useQueryClient();
  const q = useSuspenseQuery(liftQuery(uid));
  const day = useQuery({ ...dayQuery(uid, season?.id ?? "", today), enabled: !!season });
  const [draft, setDraft] = useState<Record<string, { kg: number; reps: number }>>({});
  const [busy, setBusy] = useState(false);
  const unit = profile?.units ?? "kg";
  const kit = profile?.equipment ?? ["bodyweight"];
  const max = Number(profile?.max_dumbbell_kg ?? 10);
  const closed = !season || today < season.starts_on || today > season.ends_on;
  const exercises = q.data.exercises.filter(
    (e) =>
      e.equipment === "bodyweight" ||
      (e.equipment === "dumbbell" && kit.includes("dumbbells")) ||
      (e.equipment === "bar" && kit.includes("pullup")),
  );
  const days = new Set(q.data.sets.map((s) => s.day));
  const session = days.size + (days.has(today) ? 0 : 1);
  function current(id: string) {
    const s = q.data.sets.find((s) => s.exercise_id === id);
    return draft[id] ?? { kg: Number(s?.weight ?? Math.min(10, max)), reps: s?.reps ?? 12 };
  }
  function change(id: string, patch: Partial<{ kg: number; reps: number }>) {
    setDraft((old) => ({ ...old, [id]: { ...current(id), ...patch } }));
  }
  async function save() {
    setBusy(true);
    const { error } = await supabase.rpc("log_lift_session", {
      _sets: exercises.map((e) => ({
        exercise: e.id,
        weight: e.equipment === "bodyweight" ? null : current(e.id).kg,
        reps: current(e.id).reps,
        unit: "kg",
      })),
    });
    setBusy(false);
    if (error) {
      toast(t("common.error"));
      return;
    }
    setDraft({});
    await Promise.all(
      ["lift", "day", "scores", "scoreboard", "profileSummary"].map((k) =>
        qc.invalidateQueries({ queryKey: [k] }),
      ),
    );
    toast(t("batch5.saved"));
  }
  const kitText = kit
    .map((k) =>
      k === "dumbbells"
        ? t("batch5.perDumbbell", { n: displayWeight(max, unit), unit: t(`batch4.${unit}`) })
        : t(`batch4.${k}`),
    )
    .join(" · ");
  const beats = q.data.sets.filter((s) => s.day === today && s.result === "beat").length;
  return (
    <AppShell todayLayout>
      <Link to="/today" className="wrapped-back press" aria-label={t("common.back")}>
        <ArrowLeft size={22} className="rtl:-scale-x-100" aria-hidden="true" />
      </Link>
      <header className="lift-header">
        <PageTitle text={t("batch5.lift")} />
        <span className="lift-session">
          <Num>{t("batch5.session", { n: session })}</Num>
        </span>
        <TrainIcon size={38} />
      </header>
      <p className="batch5-sub">{t("batch5.liftSub")}</p>
      <div className="lift-kit-row">
        <Link to="/settings" className="lift-kit">
          <span>{t("batch5.kit", { kit: kitText || t("batch5.noKit") })}</span>
          <ArrowRight size={16} className="shrink-0 rtl:-scale-x-100" />
        </Link>
        <Segmented
          value={unit}
          options={["kg", "lb"].map((v) => ({ value: v, label: t(`batch4.${v}`) }))}
          onChange={async (v) => {
            const r = await supabase.from("profiles").update({ units: v }).eq("id", uid);
            if (r.error) toast(t("common.error"));
            else await qc.invalidateQueries({ queryKey: ["profile", uid] });
          }}
        />
      </div>
      {exercises.map((e) => {
        const c = current(e.id);
        const prev = q.data.sets.find((s) => s.exercise_id === e.id && s.day < today);
        const saved = q.data.sets.find((s) => s.exercise_id === e.id && s.day === today);
        const bw = e.equipment === "bodyweight" || e.key === "pullups";
        const status = saved?.result ?? "match";
        const name = loc(e.name, i18n.language);
        return (
          <article className="lift-card" key={e.id}>
            <div className="lift-card-head">
              <div>
                <h2>{name}</h2>
                <p className="num text-muted-foreground">
                  {prev
                    ? t("batch5.last", {
                        set: `${bw ? t("batch5.bw") : `${displayWeight(Number(prev.weight), unit)} ${t(`batch4.${unit}`)}`} × ${prev.reps}`,
                      })
                    : t("batch5.firstSet")}
                </p>
              </div>
              <span className="lift-status" data-status={status}>
                {t(`batch5.${status}`)}
              </span>
            </div>
            <div className="lift-inputs">
              {bw ? (
                <Num className="lift-bw">{t("batch5.bw")}</Num>
              ) : (
                <LiftStepper
                  value={displayWeight(c.kg, unit)}
                  label={`${name} ${t("batch4.weight")}`}
                  suffix={t(`batch4.${unit}`)}
                  min={0.5}
                  max={e.equipment === "dumbbell" ? displayWeight(max, unit) : 1000}
                  step={unit === "lb" ? 1 : 0.5}
                  disabled={busy || closed}
                  onChange={(v) => change(e.id, { kg: v / (unit === "lb" ? LB_PER_KG : 1) })}
                />
              )}
              <span className="lift-times">×</span>
              <LiftStepper
                value={c.reps}
                label={`${name} ${t("batch5.reps")}`}
                disabled={busy || closed}
                onChange={(v) => change(e.id, { reps: v })}
              />
            </div>
            {!bw && c.kg >= max && e.equipment === "dumbbell" && (
              <p className="lift-kit-note">{t("batch5.kitMax")}</p>
            )}
          </article>
        );
      })}
      <div className="lift-summary">
        <span>{t("batch5.summary", { n: beats, total: exercises.length })}</span>
        <Num>
          +{Math.min(3, day.data?.extras?.lift_prs ?? 0) * 5} {t("common.pts")}
        </Num>
      </div>
      <StickerButton
        block
        size="lg"
        disabled={busy || closed || !exercises.length}
        onClick={() => void save()}
      >
        {t("common.save")}
      </StickerButton>
    </AppShell>
  );
}
