import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { loc } from "@/lib/i18n";
import type { Template, UserHabit } from "@/lib/data";
import { HabitIcon } from "./habit-icon";
import { BottomSheet, Field, Num, StickerButton, Tile, inputCls } from "./ui";

export type Pick = { id: string; template: Template; customName?: string | undefined; target: number };

export function fromExisting(habits: UserHabit[], templates: Template[]): Pick[] {
  const custom = templates.find((t) => t.key === "custom");
  return habits.map((h) => ({
    id: h.custom_name ? `custom:${h.id}` : (h.template?.key ?? h.id),
    template: h.template ?? custom!,
    customName: h.custom_name ?? undefined,
    target: Number(h.target),
  }));
}

export function HabitPicker({ templates, picks, onChange }: { templates: Template[]; picks: Pick[]; onChange: (p: Pick[]) => void }) {
  const { t, i18n } = useTranslation();
  const [customOpen, setCustomOpen] = useState(false);
  const [cName, setCName] = useState("");
  const [cTarget, setCTarget] = useState(1);
  const lang = i18n.language;

  function toggle(tpl: Template) {
    if (tpl.key === "custom") { if (picks.length >= 6) { toast(t("onb.max")); return; } setCustomOpen(true); return; }
    if (picks.some((p) => p.id === tpl.key)) { onChange(picks.filter((p) => p.id !== tpl.key)); return; }
    if (picks.length >= 6) { toast(t("onb.max")); return; }
    onChange([...picks, { id: tpl.key, template: tpl, target: Number(tpl.default_target) }]);
  }
  const regular = templates.filter((x) => !x.is_faith);
  const faith = templates.filter((x) => x.is_faith);
  const customs = picks.filter((p) => p.id.startsWith("custom:"));

  const renderTile = (tpl: Template) => {
    const on = picks.some((p) => p.id === tpl.key);
    return (
      <Tile key={tpl.id} selected={on} onClick={() => toggle(tpl)} aria-pressed={on}>
        <span className="flex items-center justify-between">
          <HabitIcon habitKey={tpl.key} name={tpl.icon} className="size-6" />
          {on && <span className="grid size-6 place-items-center rounded-full bg-ink text-lime"><Check strokeWidth={3} className="size-4" /></span>}
        </span>
        <span className="truncate text-[16px] font-extrabold">{loc(tpl.name, lang)}</span>
      </Tile>
    );
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[15px] font-semibold text-muted-foreground">{t("onb.habitsSub")}</p>
        <span className="rounded-full bg-ink px-3 py-1 text-[14px] font-extrabold text-lime">
          {t("onb.counter", { n: picks.length })}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {regular.map(renderTile)}
        {customs.map((c) => (
          <Tile key={c.id} selected onClick={() => onChange(picks.filter((p) => p.id !== c.id))}>
            <span className="flex items-center justify-between"><HabitIcon name="sparkles" className="size-6" />
              <span className="grid size-6 place-items-center rounded-full bg-ink text-lime"><Check strokeWidth={3} className="size-4" /></span></span>
            <span className="truncate text-[16px] font-extrabold">{c.customName}</span>
          </Tile>
        ))}
      </div>
      <div className="mt-6 mb-3 flex items-center gap-2">
        <h3 className="text-[18px] font-extrabold">{t("onb.faith")}</h3>
        <span className="inline-flex items-center gap-1 rounded-full bg-purple px-2.5 py-0.5 text-[13px] font-bold sticker-border [border-width:1.5px]">
          <Lock strokeWidth={2.5} className="size-3.5" />{t("onb.faithNote")}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">{faith.map(renderTile)}</div>

      <BottomSheet open={customOpen} onClose={() => setCustomOpen(false)} title={t("onb.customTitle")}>
        <div className="space-y-4">
          <Field label={t("onb.customName")}><input value={cName} maxLength={40} onChange={(e) => setCName(e.target.value)} className={inputCls} /></Field>
          <Field label={t("onb.customTarget")} hint={t("onb.customTargetHint")}>
            <input dir="ltr" type="number" min={1} max={100000} value={cTarget} onChange={(e) => setCTarget(Math.max(1, Number(e.target.value) || 1))} className={`${inputCls} num`} />
          </Field>
          <StickerButton block disabled={!cName.trim()} onClick={() => {
            const custom = templates.find((x) => x.key === "custom")!;
            onChange([...picks, { id: `custom:${Date.now()}`, template: custom, customName: cName.trim(), target: cTarget }]);
            setCName(""); setCTarget(1); setCustomOpen(false);
          }}>{t("onb.add")}</StickerButton>
        </div>
      </BottomSheet>
    </div>
  );
}

/** Replace the user's active habits for the season with `picks`. */
export async function saveHabits(uid: string, seasonId: string, picks: Pick[], existing: UserHabit[]) {
  const keepIds = new Set<string>();
  for (const p of picks) {
    const match = existing.find((h) => !h.custom_name && h.template?.key === p.id)
      ?? existing.find((h) => `custom:${h.id}` === p.id);
    if (match) keepIds.add(match.id);
  }
  const drop = existing.filter((h) => !keepIds.has(h.id)).map((h) => h.id);
  if (drop.length) {
    const { error } = await supabase.from("user_habits").update({ active: false }).in("id", drop);
    if (error) throw error;
  }
  const toInsert = picks.filter((p) => !existing.some((h) => keepIds.has(h.id) && ((!h.custom_name && h.template?.key === p.id) || `custom:${h.id}` === p.id)));
  if (toInsert.length) {
    const rows = toInsert.map((p, i) => {
      const isCustom = p.template.key === "custom";
      const kind = isCustom ? (p.target > 1 ? "count" : "check") : p.template.kind;
      return { user_id: uid, season_id: seasonId, template_id: p.template.id, custom_name: isCustom ? p.customName ?? null : null,
        kind, target: p.target, unit: isCustom ? null : p.template.unit, position: existing.length + i };
    });
    const { error } = await supabase.from("user_habits").insert(rows);
    if (error) throw error;
  }
}

export { Num };
