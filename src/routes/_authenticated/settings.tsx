import { pageHead } from "@/lib/page-head";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, LogOut, Trash2, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/lezgo/app-shell";
import { FitHeading } from "@/components/lezgo/fit-heading";
import {
  Segmented,
  StickerButton,
  Switch,
  BottomSheet,
  Field,
  Num,
  inputCls,
} from "@/components/lezgo/ui";
import { profileQuery, useBase, type Profile } from "@/lib/data";
import { defaultPreferences, preferencesQuery, type Preferences } from "@/lib/feed-data";
import { applyLang, LANGS } from "@/lib/i18n";
import { cn } from "@/lib/utils";
export const Route = createFileRoute("/_authenticated/settings")({
  head: () =>
    pageHead(
      "Settings — lezgo",
      "Language, units, prayer times, equipment, reminders and privacy.",
    ),
  loader: ({ context }) => context.queryClient.ensureQueryData(preferencesQuery(context.user.id)),
  component: SettingsPage,
});
function SettingsPage() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const nav = useNavigate();
  const { uid, profile } = useBase();
  const prefs = useQuery({ ...preferencesQuery(uid), enabled: !!uid });
  const p = prefs.data ?? defaultPreferences(uid);
  const [sheet, setSheet] = useState<"method" | "city" | "max" | "time" | "delete" | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const preferenceQueue = useRef<Promise<void>>(Promise.resolve());
  const revision = useRef(0);
  if (!profile) return <AppShell hideTabs>{null}</AppShell>;
  async function update(patch: Partial<Profile>) {
    const { error } = await supabase.from("profiles").update(patch).eq("id", uid);
    if (error) {
      toast(t("common.error"));
      return;
    }
    await qc.invalidateQueries({ queryKey: profileQuery(uid).queryKey });
    await Promise.all(
      ["scoreboard", "profileSummary", "feed", "prayer-times"].map((k) =>
        qc.invalidateQueries({ queryKey: [k] }),
      ),
    );
  }
  async function savePrefs(patch: Partial<Preferences>) {
    setBusy(true);
    const key = preferencesQuery(uid).queryKey;
    const next = {
      ...(qc.getQueryData<Preferences>(key) ?? defaultPreferences(uid)),
      ...patch,
      user_id: uid,
    };
    qc.setQueryData(key, next);
    const version = ++revision.current;
    preferenceQueue.current = preferenceQueue.current
      .catch(() => {})
      .then(async () => {
        const { error } = await supabase.from("user_preferences").upsert(next);
        if (error) toast(t("common.error"));
        if (version === revision.current) {
          setBusy(false);
          await qc.invalidateQueries({ queryKey: key });
          await qc.invalidateQueries({ queryKey: ["prayer-times"] });
        }
      });
    await preferenceQueue.current;
  }
  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    void nav({ to: "/auth", replace: true });
  }
  async function del() {
    setBusy(true);
    const { error } = await supabase.rpc("delete_my_account");
    setBusy(false);
    if (error) {
      toast(t("common.error"));
      return;
    }
    await signOut();
  }
  function edit(kind: "city" | "max" | "time", value: string) {
    setInput(value);
    setSheet(kind);
  }
  async function saveSheet() {
    if (sheet === "city") {
      if (!input.trim()) return;
      await update({ city: input.trim() });
    } else if (sheet === "max") {
      const value = Number(input);
      if (!Number.isFinite(value) || value < 0 || value > 500) return;
      await savePrefs({
        max_dumbbell:
          profile?.units === "lb" ? Math.round((value / 2.2046226218) * 100) / 100 : value,
      });
    } else if (sheet === "time") {
      if (!/^\d{2}:\d{2}$/.test(input)) return;
      await savePrefs({ daily_time: input });
    }
    setSheet(null);
  }
  const maxWeight =
    profile.units === "lb" ? Math.round(p.max_dumbbell * 2.2046226218 * 10) / 10 : p.max_dumbbell;
  return (
    <AppShell todayLayout hideTabs>
      <Link to="/profile" className="self-start">
        <StickerButton variant="secondary" className="icon-control" aria-label={t("common.back")}>
          <ArrowLeft className="rtl:-scale-x-100" />
        </StickerButton>
      </Link>
      <FitHeading
        className="font-extrabold leading-none"
        text={t("settings.title").toLocaleUpperCase(i18n.language === "aeb" ? "ar" : i18n.language)}
        requestedSize={52}
      />
      <h2 className="section-label">{t("batch4.language")}</h2>
      <div className="settings-languages">
        {LANGS.map((lang, i) => (
          <StickerButton
            variant="secondary"
            className={cn(i18n.language === lang ? "bg-yellow shadow-hard" : "shadow-none")}
            key={lang}
            disabled={busy}
            aria-pressed={i18n.language === lang}
            onClick={() => {
              applyLang(lang);
              void update({ language: lang });
            }}
          >
            {t(`batch4.${["english", "french", "arabic", "darja"][i]}`)}
          </StickerButton>
        ))}
      </div>
      <h2 className="section-label mt-2">{t("batch4.units")}</h2>
      <div className="settings-card divided">
        <div className="settings-row">
          <span>{t("batch4.weight")}</span>
          <Segmented
            value={profile.units}
            onChange={(v) => void update({ units: v })}
            options={["kg", "lb"].map((v) => ({ value: v, label: t(`batch4.${v}`) }))}
          />
        </div>
        <div className="settings-row">
          <span>{t("batch4.distance")}</span>
          <Segmented
            value={p.distance_unit}
            onChange={(v) => void savePrefs({ distance_unit: v })}
            options={["km", "mi"].map((v) => ({ value: v, label: t(`batch4.${v}`) }))}
          />
        </div>
      </div>
      <h2 className="section-label mt-2">{t("batch4.prayer")}</h2>
      <div className="settings-card">
        <Switch
          label={t("batch4.prayerHabits")}
          checked={p.prayer_enabled}
          onChange={(v) => void savePrefs({ prayer_enabled: v })}
        />
        <div className="settings-row">
          <span>{t("batch4.method")}</span>
          <StickerButton
            variant="secondary"
            size="sm"
            className="method-chip"
            onClick={() => setSheet("method")}
          >
            {t(`batch4.method${p.prayer_method}`)}
          </StickerButton>
        </div>
        <div className="settings-row">
          <span>{t("batch4.location")}</span>
          <StickerButton
            variant="ghost"
            className="location-button"
            onClick={() => edit("city", profile.city ?? "")}
          >
            <MapPin size={16} />
            <Num>
              {profile.city ?? "—"} · {t("batch4.auto")}
            </Num>
          </StickerButton>
        </div>
      </div>
      <h2 className="section-label mt-2">{t("batch4.equipment")}</h2>
      <div className="flex flex-wrap gap-2">
        {(["dumbbells", "pullup", "barbell", "bodyweight"] as const).map((e) => (
          <StickerButton
            size="sm"
            variant="secondary"
            disabled={busy}
            className={cn(
              "feed-chip",
              p.equipment.includes(e) ? "bg-lime shadow-hard-sm" : "shadow-none",
            )}
            aria-pressed={p.equipment.includes(e)}
            key={e}
            onClick={() =>
              void savePrefs({
                equipment: p.equipment.includes(e)
                  ? p.equipment.filter((v) => v !== e)
                  : [...p.equipment, e],
              })
            }
          >
            {t(`batch4.${e}`)}
          </StickerButton>
        ))}
        <StickerButton
          size="sm"
          variant="ghost"
          className="feed-chip dashed-ink"
          onClick={() => edit("max", String(maxWeight))}
        >
          {t("batch4.maxDumbbell", { n: maxWeight, unit: t(`batch4.${profile.units}`) })}
        </StickerButton>
      </div>
      <h2 className="section-label mt-2">{t("batch4.reminders")}</h2>
      <div className="settings-card divided">
        <Switch
          label={t("batch4.prayerReminder")}
          checked={p.prayer_reminder}
          onChange={(v) => void savePrefs({ prayer_reminder: v })}
        />
        <div>
          <Switch
            label={t("batch4.dailyReminder", { time: p.daily_time.slice(0, 5) })}
            checked={profile.notif_daily}
            onChange={(v) => void update({ notif_daily: v })}
          />
          <StickerButton
            variant="ghost"
            className="reminder-time"
            onClick={() => edit("time", p.daily_time.slice(0, 5))}
          >
            <Num>{p.daily_time.slice(0, 5)}</Num>
          </StickerButton>
        </div>
        <Switch
          label={t("settings.notifCrew")}
          checked={profile.notif_crew}
          onChange={(v) => void update({ notif_crew: v })}
        />
        <Switch
          label={t("batch4.bossAlerts")}
          checked={p.boss_alerts}
          onChange={(v) => void savePrefs({ boss_alerts: v })}
        />
      </div>
      <h2 className="section-label mt-2">{t("batch4.privacy")}</h2>
      <div className="settings-card divided">
        <Switch
          label={t("settings.publicBoards")}
          checked={profile.show_on_public_board}
          onChange={(v) => void update({ show_on_public_board: v })}
        />
        <Switch
          label={t("settings.faithPublic")}
          checked={profile.faith_public}
          onChange={(v) => void update({ faith_public: v })}
        />
        <p className="py-3 text-[13px] font-semibold text-muted-foreground">
          {t("settings.faithHint")}
        </p>
      </div>
      <Link to="/habits">
        <StickerButton block variant="secondary">
          {t("settings.editHabits")}
          <ArrowRight size={20} className="rtl:-scale-x-100" />
        </StickerButton>
      </Link>
      <StickerButton block variant="secondary" onClick={() => void signOut()}>
        <LogOut size={20} />
        {t("settings.signOut")}
      </StickerButton>
      <StickerButton block variant="danger" onClick={() => setSheet("delete")}>
        <Trash2 size={20} />
        {t("settings.deleteAccount")}
      </StickerButton>
      <Link to="/today">
        <StickerButton block>{t("profile.next")}</StickerButton>
      </Link>
      <BottomSheet
        open={sheet === "method"}
        onClose={() => setSheet(null)}
        title={t("batch4.method")}
      >
        <div className="space-y-3">
          {[18, 3, 2, 4, 5].map((m) => (
            <StickerButton
              variant={p.prayer_method === m ? "lime" : "secondary"}
              block
              key={m}
              disabled={busy}
              onClick={async () => {
                await savePrefs({ prayer_method: m });
                setSheet(null);
              }}
            >
              {t(`batch4.method${m}`)}
            </StickerButton>
          ))}
        </div>
      </BottomSheet>
      <BottomSheet
        open={sheet === "city" || sheet === "max" || sheet === "time"}
        onClose={() => setSheet(null)}
        title={t(
          sheet === "city"
            ? "batch4.location"
            : sheet === "max"
              ? "batch4.equipment"
              : "batch4.reminders",
        )}
      >
        <Field
          label={t(
            sheet === "city"
              ? "batch4.location"
              : sheet === "max"
                ? "batch4.weight"
                : "batch4.reminders",
          )}
        >
          <input
            className={inputCls}
            type={sheet === "max" ? "number" : sheet === "time" ? "time" : "text"}
            min={0}
            max={500}
            maxLength={80}
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </Field>
        <StickerButton
          block
          className="mt-4"
          disabled={busy || !input.trim()}
          onClick={() => void saveSheet()}
        >
          {t("common.save")}
        </StickerButton>
      </BottomSheet>
      <BottomSheet
        open={sheet === "delete"}
        onClose={() => setSheet(null)}
        title={t("settings.deleteAccount")}
      >
        <p>{t("settings.deleteConfirm")}</p>
        <div className="mt-5 flex gap-3">
          <StickerButton variant="secondary" onClick={() => setSheet(null)}>
            {t("common.cancel")}
          </StickerButton>
          <StickerButton variant="danger" disabled={busy} onClick={() => void del()}>
            {t("settings.deleteAccount")}
          </StickerButton>
        </div>
      </BottomSheet>
    </AppShell>
  );
}
