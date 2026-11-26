import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { adminWrite } from "@/lib/admin-data";
import { templatesQuery } from "@/lib/data";
import { EVENT_COLORS, eventColor, officialEventsQuery, type EventHabit, type OfficialEvent } from "@/lib/event-data";
import { LANGS, LANG_LABELS, loc, type Lang } from "@/lib/i18n";
import { localDate } from "@/lib/time";
import { BottomSheet, StickerButton, inputCls } from "../ui";
import { ManageCommunity } from "../community/moderation";

type EventForm = Pick<OfficialEvent, "name" | "goal" | "starts_on" | "ends_on" | "habits" | "color">;
const defaultForm = (): EventForm => {
  const today = localDate("Africa/Tunis");
  return { name: {}, goal: {}, starts_on: today, ends_on: today, color: "blue", habits: [] };
};

export function OfficialEventsAdmin() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const events = useQuery(officialEventsQuery);
  const [editing, setEditing] = useState<OfficialEvent | null | undefined>(undefined);
  const [archive, setArchive] = useState<OfficialEvent | null>(null);
  const [busy, setBusy] = useState(false);
  async function archiveEvent() {
    if (!archive || busy) return;
    setBusy(true);
    try {
      await adminWrite("archive_season", archive.id);
      setArchive(null);
      await qc.invalidateQueries();
    } catch (error) {
      toast.error((error as Error).message?.includes("event_has_active_players")
        ? t("events.archiveBlocked") : t("common.error"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4" aria-label={t("events.title")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-extrabold">{t("events.title")}</h2>
        <StickerButton size="sm" onClick={() => setEditing(null)}>{t("events.newEvent")}</StickerButton>
      </div>
      {events.isPending && <p role="status">{t("common.loading")}</p>}
      {events.isError && <StickerButton variant="secondary" onClick={() => void events.refetch()}>{t("common.retry")}</StickerButton>}
      <div className="grid gap-3 lg:grid-cols-2">
        {events.data?.map((event) => (
          <article className="sticker space-y-3 rounded-[18px] bg-card p-4" key={event.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="min-w-0 break-words text-lg font-extrabold">{loc(event.name, i18n.language)}</h3>
              <span className="rounded-full bg-lime px-3 py-1 text-sm font-bold">{t(`events.${event.state}`)}</span>
            </div>
            <p className="font-semibold"><bdi>{event.starts_on} – {event.ends_on}</bdi> · {t("events.free")}</p>
            <p className="text-sm">{event.habits.map(habit => loc(habit.name, i18n.language)).join(" · ")}</p>
            <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              {(["joined", "checkins", "completed", "left"] as const).map((metric, i) => <div key={metric}>
                <dt>{t(`events.${metric}`)}</dt><dd className="num font-extrabold">{[event.members, event.today, event.completed, event.left][i]}</dd>
              </div>)}
            </dl>
            <div className="flex flex-wrap gap-2">
              {!event.archived && <>
                <StickerButton size="sm" variant="secondary" onClick={() => setEditing(event)}>{t("events.editEvent")}</StickerButton>
                <StickerButton size="sm" variant="ghost" onClick={() => setArchive(event)}>{t("batch7.archive")}</StickerButton>
              </>}
              {event.published && <ManageCommunity season={event.id} />}
            </div>
          </article>
        ))}
      </div>
      {editing !== undefined && <EventEditor event={editing} onClose={() => setEditing(undefined)} />}
      <BottomSheet open={!!archive} onClose={() => { if (!busy) setArchive(null); }} title={t("batch7.archive")}>
        <p className="mb-4">{t("events.archiveConfirm")}</p>
        <StickerButton block variant="danger" disabled={busy} onClick={() => void archiveEvent()}>{t("batch7.archive")}</StickerButton>
      </BottomSheet>
    </section>
  );
}

function EventEditor({ event, onClose }: { event: OfficialEvent | null; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const templates = useQuery(templatesQuery);
  const catalog = (templates.data ?? []).filter(template => template.key !== "custom");
  const [lang, setLang] = useState<Lang>("en");
  const [form, setForm] = useState<EventForm>(() => event ? {
    ...event,
  } : defaultForm());
  const [habitKey, setHabitKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const locked = !!event?.published && event.state !== "upcoming";

  function addHabit() {
    const template = catalog.find(row => row.key === habitKey);
    if (!template || form.habits.length >= 6 || form.habits.some(row => row.key === habitKey)) return;
    setForm({ ...form, habits: [...form.habits, {
      key: template.key, name: template.name as EventHabit["name"], target: Number(template.default_target),
      unit: template.unit, kind: template.kind, rule: template.default_rule,
      what_counts: template.what_counts as EventHabit["what_counts"],
    }] });
    setHabitKey("");
  }

  async function save(published: boolean) {
    if (busy) return;
    setError("");
    if (!form.name["en"]?.trim() || !form.starts_on || form.ends_on < form.starts_on
      || (!locked && ((published && !form.habits.length) || form.habits.some(habit => !(habit.target > 0))))) {
      setError(t("events.saveError"));
      return;
    }
    setBusy(true);
    try {
      const { name, goal, starts_on, ends_on, color, habits } = form;
      const { error: failure } = await supabase.rpc("admin_save_official_event", {
        _id: event?.id ?? null,
        _event: { name, goal, starts_on, ends_on, color, published },
        _habits: locked ? null : habits.map(({ key, target, rule }) => ({ key, target, rule })),
      });
      if (failure) throw failure;
      await qc.invalidateQueries();
      onClose();
    } catch (failure) {
      setError((failure as Error).message?.includes("event_rules_locked") ? t("events.locked") : t("events.saveError"));
    } finally {
      setBusy(false);
    }
  }

  return <BottomSheet open onClose={() => { if (!busy) onClose(); }} title={t(event ? "events.editEvent" : "events.newEvent")}>
    <form className="space-y-4" onSubmit={e => { e.preventDefault(); void save(event?.published ?? false); }}>
      <div className="flex flex-wrap gap-2">{LANGS.map(code => <StickerButton key={code} type="button" size="sm"
        variant={lang === code ? "lime" : "secondary"} aria-pressed={lang === code} onClick={() => setLang(code)}>{LANG_LABELS[code]}</StickerButton>)}</div>
      <label className="block font-bold">{t("events.eventName")} · {LANG_LABELS[lang]}
        <input dir="auto" className={inputCls} value={form.name[lang] ?? ""} maxLength={60}
          onChange={e => setForm({ ...form, name: { ...form.name, [lang]: e.target.value } })} />
      </label>
      <label className="block font-bold">{t("events.goal")}
        <textarea dir="auto" className={inputCls} value={form.goal[lang] ?? ""} maxLength={280}
          onChange={e => setForm({ ...form, goal: { ...form.goal, [lang]: e.target.value } })} />
      </label>
      <p className="text-sm">{t(locked ? "events.locked" : "events.tunis")}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="min-w-0 font-bold">{t("events.starts")}
          <input className={inputCls} type="date" disabled={locked} value={form.starts_on}
            onChange={e => setForm({ ...form, starts_on: e.target.value })} />
        </label>
        <label className="min-w-0 font-bold">{t("events.ends")}
          <input className={inputCls} type="date" min={form.starts_on} disabled={locked} value={form.ends_on}
            onChange={e => setForm({ ...form, ends_on: e.target.value })} />
        </label>
      </div>
      <fieldset className="flex flex-wrap gap-2">
        <legend className="mb-1 font-bold">{t("events.colors")}</legend>
        {Object.entries(EVENT_COLORS).map(([color, value], index) => <button key={color} type="button" aria-label={`${t("events.colors")} ${index + 1}`}
          aria-pressed={form.color === color} className="min-h-11 min-w-11 rounded-full sticker-border"
          style={{ backgroundColor: value }} onClick={() => setForm({ ...form, color })}>
          {form.color === color ? "✓" : ""}
        </button>)}
      </fieldset>
      <fieldset disabled={locked} className="space-y-2">
        <legend className="font-bold">{t("events.habits")} · {form.habits.length}/6</legend>
        {form.habits.map((habit, index) => <div className="rounded-xl border p-2" key={habit.key}>
          <p className="font-bold">{loc(habit.name, i18n.language)}</p>
          <p className="text-sm">{loc(habit.what_counts, i18n.language)}</p>
          <div className="mt-1 flex flex-wrap items-end gap-2">
            <label className="min-w-20 flex-1 text-sm">{t("events.target")} {habit.unit && `(${habit.unit})`}
              <input className={inputCls} type="number" disabled={habit.kind !== "count" && habit.kind !== "timer" && !!habit.kind} inputMode="decimal" min="0.001" max="1000000" step="any" value={habit.target || ""}
                onChange={e => setForm({ ...form, habits: form.habits.map((row, i) => i === index ? { ...row, target: Number(e.target.value) } : row) })} />
            </label>
            {!locked && <StickerButton type="button" size="sm" variant="ghost"
              onClick={() => setForm({ ...form, habits: form.habits.filter(row => row.key !== habit.key) })}>{t("events.removeHabit")}</StickerButton>}
          </div>
        </div>)}
        {!locked && form.habits.length < 6 && <div className="flex items-end gap-2">
          <label className="min-w-0 flex-1 text-sm">{t("events.habits")}
            <select className={inputCls} onChange={e => setHabitKey(e.target.value)} value={habitKey}>
              <option value="">—</option>
              {catalog.filter(row => !form.habits.some(habit => habit.key === row.key)).map(row =>
                <option key={row.key} value={row.key}>{loc(row.name, i18n.language)}</option>)}
            </select>
          </label>
          <StickerButton type="button" size="sm" disabled={!habitKey} onClick={addHabit}>{t("events.addHabit")}</StickerButton>
        </div>}
      </fieldset>
      <section className="sticker rounded-2xl p-4" style={{ background: eventColor(form.color), color: "#191919" }}>
        <p className="text-sm font-bold">{t("events.preview")} · {t("events.free")}</p>
        <h3 className="text-xl font-extrabold" dir="auto">{loc(form.name, lang) || t("events.eventName")}</h3>
        <p dir="auto">{loc(form.goal, lang)}</p>
        <p className="text-sm"><bdi>{form.starts_on} – {form.ends_on}</bdi></p>
        <ul className="mt-2 space-y-1">{form.habits.map(habit => <li key={habit.key}>{loc(habit.name, lang)} · {habit.target} {habit.unit}</li>)}</ul>
      </section>
      {error && <p role="alert" className="font-bold text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <StickerButton type="submit" variant="secondary" disabled={busy}>{t(event?.published ? "events.save" : "events.saveDraft")}</StickerButton>
        {!event?.published && <StickerButton type="button" disabled={busy} onClick={() => void save(true)}>{t("events.publish")}</StickerButton>}
      </div>
    </form>
  </BottomSheet>;
}
