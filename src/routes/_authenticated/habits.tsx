import { pageHead } from "@/lib/page-head";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/lezgo/app-shell";
import { HabitPicker, fromExisting, saveHabits, type Pick } from "@/components/lezgo/habit-picker";
import { StickerButton } from "@/components/lezgo/ui";
import { habitsQuery, templatesQuery, useBase } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/habits")({
  head: () => pageHead("Edit habits — lezgo", "Change your daily habits."),
  component: HabitsPage,
});

function HabitsPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { uid, season } = useBase();
  const templates = useQuery(templatesQuery);
  const existing = useQuery({ ...habitsQuery(uid, season?.id ?? ""), enabled: !!uid && !!season });
  const [picks, setPicks] = useState<Pick[] | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (picks === null && existing.data && templates.data) setPicks(fromExisting(existing.data, templates.data)); }, [existing.data, templates.data, picks]);

  async function save() {
    if (!season || !picks) return;
    setBusy(true);
    try {
      await saveHabits(uid, season.id, picks, existing.data ?? []);
      const { data: entry } = await supabase.from("season_entries").select("user_id").eq("user_id", uid).eq("season_id", season.id).maybeSingle();
      if (!entry) await supabase.rpc("join_season", { _season_id: season.id, _mode: "solo" });
      await qc.invalidateQueries();
      void nav({ to: "/today" });
    } catch { toast(t("common.error")); } finally { setBusy(false); }
  }
  return (
    <AppShell hideTabs>
      <h1 className="mb-3 text-[30px] font-extrabold">{t("onb.editTitle")}</h1>
      {templates.data && picks && <HabitPicker templates={templates.data} picks={picks} onChange={setPicks} />}
      <StickerButton block size="lg" className="mt-8" disabled={busy || !picks?.length} onClick={save}>{t("common.save")}</StickerButton>
    </AppShell>
  );
}
