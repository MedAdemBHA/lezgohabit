import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Minus, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/lezgo/app-shell";
import { StickerButton, Num } from "@/components/lezgo/ui";
import { FitHeading } from "@/components/lezgo/fit-heading";
import { pageHead } from "@/lib/page-head";
import { cn } from "@/lib/utils";
export const Route = createFileRoute("/_authenticated/scoring")({
  head: () =>
    pageHead(
      "How scoring works · lezgo",
      "Habits, bonus stacks and streaks explained with a fair-play scoring calculator.",
    ),
  component: Scoring,
});
type Preview = { habits: number; stacks: number; multiplier: number; total: number; max: number };
function Scoring() {
  const { t } = useTranslation();
  const [picked, setPicked] = useState(5);
  const [done, setDone] = useState(4);
  const [streak, setStreak] = useState(8);
  const [proof, setProof] = useState(true);
  const [chaos, setChaos] = useState(true);
  const [crew, setCrew] = useState(true);
  const [lift, setLift] = useState(0);
  const q = useQuery({
    queryKey: ["scoring-preview", picked, done, streak, proof, chaos, crew, lift],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("scoring_preview", {
        _picked: picked,
        _done: done,
        _streak: streak,
        _proof: proof,
        _chaos: chaos,
        _crew: crew,
        _lift: lift,
      });
      if (error) throw error;
      return data as unknown as Preview;
    },
    staleTime: Infinity,
  });
  return (
    <AppShell todayLayout hideTabs>
      <Link to="/ranks" className="self-start">
        <StickerButton variant="secondary" className="icon-control" aria-label={t("common.back")}>
          <ArrowLeft className="rtl:-scale-x-100" />
        </StickerButton>
      </Link>
      <FitHeading
        requestedSize={52}
        text={t("batch4.scoringTitle")}
        className="whitespace-pre-line leading-none"
      />
      <div className="score-formula">
        <div className="num text-[22px] font-bold">
          <span>{t("batch4.score")} = (</span>
          <span className="text-lime">{t("batch4.habitsWord")}</span>
          <span> + </span>
          <span className="text-pink">{t("batch4.stacksWord")}</span>
          <span>) × </span>
          <span className="text-yellow">{t("batch4.streakWord")}</span>
        </div>
        <p className="mt-3 text-[15px] font-semibold">{t("batch4.formulaSub")}</p>
      </div>
      <section className="score-calculator">
        <div className="flex flex-wrap justify-between gap-2">
          <h2 className="section-label">{t("batch4.tryIt")}</h2>
          <Num className="text-[13px] font-bold">{t("batch4.dailyMax", { n: 247 })}</Num>
        </div>
        <ScoreStepper
          name={t("batch4.picked")}
          value={picked}
          min={1}
          max={8}
          onChange={(v) => {
            setPicked(v);
            setDone(Math.min(done, v));
          }}
        />
        <ScoreStepper
          name={t("batch4.done")}
          value={done}
          min={0}
          max={picked}
          display={`${done}/${picked}`}
          onChange={setDone}
        />
        <ScoreStepper
          name={t("batch4.streakDays")}
          value={streak}
          min={0}
          max={40}
          onChange={setStreak}
        />
        <div className="flex flex-wrap gap-2">
          <StickerButton
            size="sm"
            variant="secondary"
            className={cn("calc-chip", done === picked ? "bg-lime" : "dashed-ink shadow-none")}
            disabled
            aria-pressed={done === picked}
          >
            {t("batch4.perfect")}
          </StickerButton>
          {[
            { label: "proofBonus", on: proof, change: setProof, color: "bg-yellow" },
            { label: "chaosBonus", on: chaos, change: setChaos, color: "bg-pink" },
            { label: "crewBonus", on: crew, change: setCrew, color: "bg-blue" },
          ].map((b) => (
            <StickerButton
              variant="secondary"
              size="sm"
              className={cn("calc-chip", b.on ? b.color : "shadow-none")}
              aria-pressed={b.on}
              key={b.label}
              onClick={() => b.change(!b.on)}
            >
              {t(`batch4.${b.label}`)}
            </StickerButton>
          ))}
          <StickerButton
            variant="secondary"
            size="sm"
            className={cn("calc-chip", lift > 0 && "bg-lime")}
            onClick={() => setLift((lift + 1) % 4)}
          >
            {t("batch4.liftBonus", { n: lift, points: lift * 5 })}
          </StickerButton>
        </div>
        <div className="calc-result">
          {q.isError ? (
            <StickerButton variant="ghost" onClick={() => void q.refetch()}>
              {t("common.error")}
            </StickerButton>
          ) : (
            <>
              <Num className="text-[16px]">
                {q.data
                  ? `(${q.data.habits} + ${q.data.stacks}) × ${q.data.multiplier.toFixed(2)}`
                  : "…"}
              </Num>
              <p aria-live="polite">
                <Num className="text-[64px] font-extrabold">{q.data?.total ?? "—"}</Num>{" "}
                <span className="font-bold">{t("common.pts")}</span>
              </p>
            </>
          )}
        </div>
      </section>
      <div className="grid grid-cols-2 gap-3">
        {[
          { key: "habits", color: "bg-lime" },
          { key: "stacks", color: "bg-pink" },
          { key: "streak", color: "bg-yellow" },
          { key: "fair", color: "bg-card" },
        ].map((tile) => (
          <section key={tile.key} className={cn("scoring-tile", tile.color)}>
            <h2>{t(`batch4.${tile.key}Title`)}</h2>
            <p>{t(`batch4.${tile.key}Text`)}</p>
          </section>
        ))}
      </div>
      <p className="scoring-cap">{t("integrity.stackCap")}</p>
      <h2 className="section-label mt-2">{t("batch4.boards")}</h2>
      <div className="flex flex-wrap gap-2">
        {(["challenge", "crew"] as const).map((scope) => (
          <Link
            to="/ranks"
            search={{ scope }}
            key={scope}
          >
            <StickerButton variant="secondary" size="sm" className="feed-chip">
              {t(scope === "crew" ? "challengePulse.crewTab" : "challengePulse.challengeTab")}
            </StickerButton>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
function ScoreStepper({
  name,
  value,
  min,
  max,
  onChange,
  display,
}: {
  name: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  display?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="calc-step-row">
      <span>{name}</span>
      <div className="calc-stepper">
        <StickerButton
          variant="ghost"
          disabled={value <= min}
          aria-label={t("batch4.decrease", { name })}
          onClick={() => onChange(value - 1)}
        >
          <Minus size={20} />
        </StickerButton>
        <Num>{display ?? value}</Num>
        <StickerButton
          variant="ghost"
          disabled={value >= max}
          aria-label={t("batch4.increase", { name })}
          onClick={() => onChange(value + 1)}
        >
          <Plus size={20} />
        </StickerButton>
      </div>
    </div>
  );
}
