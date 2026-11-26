import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight, Check, Copy, Share2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/lezgo/app-shell";
import { FitHeading } from "@/components/lezgo/fit-heading";
import { BottomSheet, Field, Num, StickerButton, inputCls } from "@/components/lezgo/ui";
import { HabitIcon } from "@/components/lezgo/habit-icon";
import { useBase, templatesQuery, type Template } from "@/lib/data";
import { rolesQuery, challengeLink } from "@/lib/batch6-data";
import { loc } from "@/lib/i18n";
import { pageHead } from "@/lib/page-head";
import { supabase } from "@/integrations/supabase/client";
import { stepFor } from "@/lib/habits";
import type { Json } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/create-challenge")({
  head: () => pageHead("Create a challenge — lezgo", "Create a challenge for your community."),
  component: CreateChallenge,
});

const DURATIONS = [7, 14, 21, 30, 40, 66, 90];
const COLORS = ["blue", "pink", "purple", "orange", "lime", "teal", "yellow"] as const;
type Picked = { key: string; target: number; rule: Record<string, string | boolean> };
type Created = {
  id: string;
  season_id: string;
  code: string;
  days: number;
  starts_on: string;
  ends_on: string;
};

function CreateChallenge() {
  const { t, i18n } = useTranslation();
  const { uid, today, profile } = useBase();
  const qc = useQueryClient();
  const templates = useQuery(templatesQuery);
  const roles = useQuery({ ...rolesQuery(uid), enabled: !!uid });
  const request = useQuery({
    queryKey: ["creator-request", uid],
    enabled: !!uid && !roles.data?.includes("creator"),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("creator_requests")
        .select("status")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data?.status ?? null;
    },
  });
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [startsOn, setStartsOn] = useState(today);
  const [days, setDays] = useState(21);
  const [picks, setPicks] = useState<Picked[]>([]);
  const [color, setColor] = useState<(typeof COLORS)[number]>("blue");
  const [busy, setBusy] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);
  // Admins can create directly (the server checks the same rule in create_creator_challenge).
  const isCreator = !!roles.data?.includes("creator") || !!profile?.is_admin;
  const selected = new Map(picks.map((p) => [p.key, p.target]));
  const list = templates.data ?? [];

  function toggle(template: Template) {
    if (selected.has(template.key)) {
      setPicks((old) => old.filter((p) => p.key !== template.key));
      return;
    }
    if (picks.length >= 6) return;
    const defaults = template.default_rule as Record<string, string | boolean>;
    setPicks((old) => [
      ...old,
      { key: template.key, target: Number(template.default_target) || 1, rule: { ...defaults } },
    ]);
  }
  function adjust(key: string, delta: number) {
    const template = list.find((h) => h.key === key);
    if (!template) return;
    const step =
      template.kind === "timer"
        ? 1
        : stepFor(template.unit, Number(selected.get(key) ?? template.default_target));
    setPicks((old) =>
      old.map((p) =>
        p.key === key ? { ...p, target: Math.max(step, p.target + delta * step) } : p,
      ),
    );
  }
  function setRule(key: string, field: string, value: string) {
    setPicks((old) =>
      old.map((p) => (p.key === key ? { ...p, rule: { ...p.rule, [field]: value } } : p)),
    );
  }
  async function apply() {
    setBusy(true);
    const { error } = await supabase.rpc("request_creator");
    setBusy(false);
    if (error) {
      toast(t("common.error"));
      return;
    }
    setRequestSent(true);
    await qc.invalidateQueries({ queryKey: ["creator-request", uid] });
  }
  async function create() {
    if (!name.trim() || !picks.length || startsOn < today) return;
    setBusy(true);
    const habits = picks.map((p) => ({ key: p.key, target: p.target, rule: p.rule }));
    const { data, error } = await supabase.rpc("create_creator_challenge", {
      _name: name.trim(),
      _days: days,
      _starts_on: startsOn,
      _habits: habits as unknown as Json,
      _cover_color: color,
    });
    setBusy(false);
    if (error) {
      toast(t("batch6.challengeError"));
      return;
    }
    setCreated(data as unknown as Created);
    await qc.invalidateQueries();
  }
  async function share() {
    if (!created) return;
    const url = challengeLink(created.code);
    try {
      if (navigator.share) await navigator.share({ title: name, url });
      else {
        await navigator.clipboard.writeText(url);
        toast(t("crew.copied"));
      }
    } catch {
      /* The share sheet was dismissed. */
    }
  }

  return (
    <AppShell todayLayout>
      <div className="flex items-center justify-between gap-3">
        <StickerButton
          variant="secondary"
          className="icon-control"
          aria-label={t("common.back")}
          onClick={() => (step ? setStep(step - 1) : history.back())}
        >
          <ArrowLeft className="rtl:-scale-x-100" />
        </StickerButton>
        {isCreator && (
          <Num className="rounded-full bg-ink px-3 py-1 text-lime">{`${step + 1} / 3`}</Num>
        )}
      </div>
      <FitHeading requestedSize={44} className="batch6-heading" text={t("batch6.create")} />
      {!isCreator ? (
        <section className="sticker rounded-[20px] bg-card p-4">
          <h2 className="text-[20px] font-extrabold">{t("batch6.applyCreator")}</h2>
          <p className="mt-2 text-[14px] font-semibold text-muted-foreground">
            {t("batch6.applyCreatorSub")}
          </p>
          <ul className="mt-3 list-disc space-y-1 ps-5 text-[14px] font-semibold">
            <li>{t("ux.reviewWho")}</li>
            <li>{t("ux.reviewWhen")}</li>
            <li>{t("ux.reviewAfter")}</li>
          </ul>
          <StickerButton
            block
            className="mt-4"
            disabled={busy || requestSent || request.data === "pending"}
            onClick={() => void apply()}
          >
            {requestSent || request.data === "pending"
              ? t("batch6.creatorPending")
              : t("batch6.applyCreator")}
          </StickerButton>
          <Link to="/start" className="mt-3 block">
            <StickerButton block variant="secondary">
              {t("ux.privateForMe")}
            </StickerButton>
          </Link>
        </section>
      ) : step === 0 ? (
        <div className="space-y-5">
          <Field label={t("batch6.name")}>
            <input
              className={inputCls}
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label={t("batch6.start")}>
            <input
              className={inputCls}
              dir="ltr"
              type="date"
              min={today}
              value={startsOn}
              onChange={(e) => setStartsOn(e.target.value)}
            />
          </Field>
          <div>
            <h2 className="mb-2 text-[14px] font-extrabold">{t("batch6.length")}</h2>
            <div className="grid grid-cols-4 gap-2">
              {DURATIONS.map((n) => (
                <StickerButton
                  key={n}
                  size="sm"
                  variant={days === n ? "lime" : "secondary"}
                  aria-pressed={days === n}
                  onClick={() => setDays(n)}
                >
                  <Num>{n}</Num>
                </StickerButton>
              ))}
            </div>
          </div>
          <StickerButton
            block
            size="lg"
            disabled={!name.trim() || startsOn < today}
            onClick={() => setStep(1)}
          >
            {t("common.next")}
            <ArrowRight className="rtl:-scale-x-100" />
          </StickerButton>
        </div>
      ) : step === 1 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="section-label">{t("batch6.habits", { n: picks.length })}</h2>
            <Num>{picks.length}/6</Num>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {list.map((h) => {
              const target = selected.get(h.key);
              return (
                <div key={h.id} className="min-w-0">
                  <StickerButton
                    block
                    variant={target !== undefined ? "lime" : "secondary"}
                    aria-pressed={target !== undefined}
                    className="min-h-[86px] justify-start"
                    onClick={() => toggle(h)}
                  >
                    <HabitIcon name={h.icon} className="size-6 shrink-0" />
                    <span className="min-w-0 text-start">
                      <span className="block truncate">{loc(h.name, i18n.language)}</span>
                      {target !== undefined && h.kind === "count" && (
                        <Num className="text-[12px]">
                          {target} {h.unit ?? ""}
                        </Num>
                      )}
                    </span>
                    {target !== undefined && <Check className="ms-auto size-4 shrink-0" />}
                  </StickerButton>
                  {target !== undefined && (h.kind === "count" || h.kind === "timer") && (
                    <div className="mt-1 flex items-center justify-center gap-2">
                      <Num>
                        {target} {h.unit ?? ""}
                      </Num>
                      <StickerButton
                        size="sm"
                        variant="ghost"
                        aria-label={t("batch6.lowerTarget")}
                        onClick={() => adjust(h.key, -1)}
                      >
                        −
                      </StickerButton>
                      <StickerButton
                        size="sm"
                        variant="ghost"
                        aria-label={t("batch6.raiseTarget")}
                        onClick={() => adjust(h.key, 1)}
                      >
                        +
                      </StickerButton>
                    </div>
                  )}
                  {target !== undefined && (h.kind === "time_window" || h.kind === "quit") && (
                    <div className="mt-1 grid grid-cols-2 gap-1">
                      <input
                        aria-label={t("batch6.windowStart")}
                        className={`${inputCls} min-h-11 px-1 text-center num`}
                        type="time"
                        value={String(
                          picks.find((p) => p.key === h.key)?.rule["window_start"] ?? "18:00",
                        )}
                        onChange={(e) => setRule(h.key, "window_start", e.target.value)}
                      />
                      <input
                        aria-label={t("batch6.windowEnd")}
                        className={`${inputCls} min-h-11 px-1 text-center num`}
                        type="time"
                        value={String(
                          picks.find((p) => p.key === h.key)?.rule["window_end"] ?? "03:00",
                        )}
                        onChange={(e) => setRule(h.key, "window_end", e.target.value)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <StickerButton block size="lg" disabled={!picks.length} onClick={() => setStep(2)}>
            {t("common.next")}
            <ArrowRight className="rtl:-scale-x-100" />
          </StickerButton>
        </div>
      ) : (
        <div className="space-y-5">
          <h2 className="section-label">{t("batch6.cover")}</h2>
          <div className="grid grid-cols-4 gap-3">
            {COLORS.map((c) => (
              <StickerButton
                key={c}
                variant="secondary"
                aria-label={t(`batch6.color_${c}`)}
                aria-pressed={color === c}
                className={`min-h-12 ${color === c ? "ring-4 ring-ink" : ""}`}
                data-color={c}
                onClick={() => setColor(c)}
              >
                <span className="sr-only">{t(`batch6.color_${c}`)}</span>
                {color === c && <Check />}
              </StickerButton>
            ))}
          </div>
          <section className="sticker rounded-[18px] bg-card p-4">
            <h3 className="text-[18px] font-extrabold">{name}</h3>
            <p className="mt-1 text-[14px] font-semibold">
              {t("batch6.days", { n: days })} · {startsOn}
            </p>
            <p className="mt-2 text-[13px] font-semibold text-muted-foreground">
              {picks
                .map((p) => loc(list.find((h) => h.key === p.key)?.name, i18n.language))
                .join(" · ")}
            </p>
          </section>
          <StickerButton block size="lg" disabled={busy} onClick={() => void create()}>
            {t("batch6.createButton")}
            <ArrowRight className="rtl:-scale-x-100" />
          </StickerButton>
        </div>
      )}
      <BottomSheet open={!!created} onClose={() => setCreated(null)} title={t("batch6.invite")}>
        {created && (
          <div className="space-y-4">
            <p className="font-bold">{t("batch6.creatorReady")}</p>
            <Num className="block text-center text-[28px]">{created.code}</Num>
            <bdi className="block break-all text-center" dir="ltr">
              {challengeLink(created.code)}
            </bdi>
            <div className="grid grid-cols-2 gap-3">
              <StickerButton
                block
                variant="secondary"
                onClick={() =>
                  void navigator.clipboard
                    .writeText(challengeLink(created.code))
                    .then(() => toast(t("crew.copied")))
                }
              >
                <Copy size={18} />
                {t("batch6.copy")}
              </StickerButton>
              <StickerButton block variant="lime" onClick={() => void share()}>
                <Share2 size={18} />
                {t("batch6.share")}
              </StickerButton>
            </div>
            <Link to="/profile" className="block">
              <StickerButton block>{t("common.openProfile")}</StickerButton>
            </Link>
          </div>
        )}
      </BottomSheet>
    </AppShell>
  );
}
