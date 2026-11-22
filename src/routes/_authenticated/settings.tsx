import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ArrowRight, LogOut, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/lezgo/app-shell";
import { LangGrid } from "@/components/lezgo/lang-switcher";
import { Segmented, StickerButton, StickerCard, Switch } from "@/components/lezgo/ui";
import { profileQuery, useBase, type Profile } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — lezgo" }, { name: "description", content: "Language, privacy and account settings." }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const nav = useNavigate();
  const { uid, profile } = useBase();
  if (!profile) return <AppShell hideTabs>{null}</AppShell>;

  async function update(p: Partial<Profile>) {
    qc.setQueryData(profileQuery(uid).queryKey, (old: Profile | undefined) => (old ? { ...old, ...p } : old));
    const { error } = await supabase.from("profiles").update(p).eq("id", uid);
    if (error) { toast(t("common.error")); void qc.invalidateQueries({ queryKey: ["profile"] }); }
    else void qc.invalidateQueries({ queryKey: ["leaderboard"] });
  }
  async function signOut() {
    await qc.cancelQueries(); qc.clear();
    await supabase.auth.signOut();
    void nav({ to: "/auth", replace: true });
  }
  async function del() {
    if (!window.confirm(t("settings.deleteConfirm"))) return;
    const { error } = await supabase.rpc("delete_my_account");
    if (error) { toast(t("common.error")); return; }
    await signOut();
  }

  return (
    <AppShell hideTabs>
      <h1 className="mb-4 text-[30px] font-extrabold">{t("settings.title")}</h1>
      <div className="space-y-4">
        <StickerCard><p className="mb-3 text-[16px] font-extrabold">{t("common.language")}</p><LangGrid onPick={(l) => update({ language: l })} /></StickerCard>
        <StickerCard>
          <p className="mb-3 text-[16px] font-extrabold">{t("settings.units")}</p>
          <Segmented value={profile.units as "kg" | "lb"} onChange={(v) => update({ units: v })} options={[{ value: "kg", label: "kg" }, { value: "lb", label: "lb" }]} />
        </StickerCard>
        <StickerCard className="divide-y-2 divide-ink/10 py-1">
          <Switch label={t("settings.publicBoards")} checked={profile.show_on_public_board} onChange={(v) => update({ show_on_public_board: v })} />
          <div>
            <Switch label={t("settings.faithPublic")} checked={profile.faith_public} onChange={(v) => update({ faith_public: v })} />
            <p className="-mt-2 pb-3 text-[13px] font-semibold text-muted-foreground">{t("settings.faithHint")}</p>
          </div>
        </StickerCard>
        <StickerCard className="divide-y-2 divide-ink/10 py-1">
          <p className="pt-2 text-[16px] font-extrabold">{t("settings.notifications")}</p>
          <Switch label={t("settings.notifDaily")} checked={profile.notif_daily} onChange={(v) => update({ notif_daily: v })} />
          <Switch label={t("settings.notifCrew")} checked={profile.notif_crew} onChange={(v) => update({ notif_crew: v })} />
        </StickerCard>
        <Link to="/habits" className="block"><StickerButton block variant="secondary">{t("settings.editHabits")}<ArrowRight strokeWidth={3} className="size-5 rtl:-scale-x-100" /></StickerButton></Link>
        <StickerButton block variant="secondary" onClick={signOut}><LogOut strokeWidth={2.5} className="size-5 rtl:-scale-x-100" />{t("settings.signOut")}</StickerButton>
        <StickerButton block variant="danger" onClick={del}><Trash2 strokeWidth={2.5} className="size-5" />{t("settings.deleteAccount")}</StickerButton>
        <Link to="/today" className="block"><StickerButton block>{t("profile.next")}</StickerButton></Link>
      </div>
    </AppShell>
  );
}
