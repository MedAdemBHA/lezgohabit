import { NotificationSettings } from "@/components/lezgo/launch/notification-settings";
import { PageTitle } from "@/components/lezgo/page-title";
import { pageHead } from "@/lib/page-head";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  ArrowLeft,
  ChevronRight,
  Download,
  LogOut,
  Trash2,
  MapPin,
  ListChecks,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/lezgo/app-shell";
import {
  Segmented,
  StickerButton,
  Switch,
  BottomSheet,
  Field,
  inputCls,
} from "@/components/lezgo/ui";
import { profileQuery, useBase, type Profile } from "@/lib/data";
import { defaultPreferences, preferencesQuery, type Preferences } from "@/lib/feed-data";
import { applyLang, LANGS, numberLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
export const Route = createFileRoute("/_authenticated/settings")({
  head: () =>
    pageHead(
      "Settings · lezgo",
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
  const [sheet, setSheet] = useState<
    "method" | "city" | "max" | "time" | "birthday" | "delete" | null
  >(null);
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
  function edit(kind: "city" | "max" | "time" | "birthday", value: string) {
    setInput(value);
    setSheet(kind);
  }
  async function saveSheet() {
    if (sheet === "birthday") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return;
      await update({ birth_date: input });
      await qc.invalidateQueries({ queryKey: ["buddies"] });
    } else if (sheet === "city") {
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
      <div className="settings-page">
        <header className="settings-head">
          <Link to="/profile">
            <StickerButton
              variant="secondary"
              className="icon-control"
              aria-label={t("common.back")}
            >
              <ArrowLeft className="rtl:-scale-x-100" />
            </StickerButton>
          </Link>
          <PageTitle text={t("settings.title")} />
        </header>
        <h2 className="section-label">{t("batch4.language")}</h2>
        <div className="settings-card settings-languages">
          {LANGS.map((lang, i) => (
            <StickerButton
              variant="secondary"
              className="shadow-none"
              key={lang}
              disabled={busy}
              aria-pressed={i18n.language === lang}
              onClick={() => {
                applyLang(lang);
                if (!profile.is_demo) void update({ language: lang });
              }}
            >
              {t(`batch4.${["english", "french", "arabic", "darja"][i]}`)}
            </StickerButton>
          ))}
        </div>
        <h2 className="section-label">{t("batch4.units")}</h2>
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
        <h2 className="section-label">{t("batch4.prayer")}</h2>
        <div className="settings-card divided">
          <Switch
            label={t("batch4.prayerHabits")}
            checked={p.prayer_enabled}
            onChange={(v) => void savePrefs({ prayer_enabled: v })}
          />
          {p.prayer_enabled && (
            <>
              <NavRow
                label={t("batch4.method")}
                value={t(`batch4.method${p.prayer_method}`)}
                onClick={() => setSheet("method")}
              />
              <NavRow
                label={t("batch4.location")}
                icon={<MapPin size={18} aria-hidden="true" />}
                value={profile.city || t("ux.setCity")}
                muted={!profile.city}
                onClick={() => edit("city", profile.city ?? "")}
              />
            </>
          )}
        </div>
        <h2 className="section-label">{t("batch4.equipment")}</h2>
        <div className="settings-card divided">
          {(["dumbbells", "pullup", "barbell"] as const).map((e) => (
            <Switch
              key={e}
              label={t(`batch4.${e}`)}
              checked={p.equipment.includes(e)}
              onChange={(on) =>
                void savePrefs({
                  // Bodyweight moves are always available, so "bodyweight" stays in the kit.
                  equipment: [
                    "bodyweight",
                    ...p.equipment.filter((v) => v !== "bodyweight" && v !== e),
                    ...(on ? [e] : []),
                  ],
                })
              }
            />
          ))}
          {p.equipment.includes("dumbbells") && (
            <NavRow
              label={t("ux.maxDumbbell")}
              value={`${new Intl.NumberFormat(numberLocale(i18n.language)).format(maxWeight)} ${t(`batch4.${profile.units}`)}`}
              onClick={() => edit("max", String(maxWeight))}
            />
          )}
          <p className="settings-note">{t("ux.bodyweightIncluded")}</p>
        </div>
        <NotificationSettings uid={uid} />
        <h2 className="section-label">{t("batch4.reminders")}</h2>
        <div className="settings-card divided">
          <Switch
            label={t("ux.dailyReminder")}
            checked={profile.notif_daily}
            onChange={(v) => void update({ notif_daily: v })}
          />
          {profile.notif_daily && (
            <NavRow
              label={t("ux.reminderTime")}
              value={p.daily_time.slice(0, 5)}
              ltrValue
              onClick={() => edit("time", p.daily_time.slice(0, 5))}
            />
          )}
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
        <h2 className="section-label">{t("batch4.privacy")}</h2>
        <div className="settings-card divided">
          <NavRow
            label={t("batch5.birthDate")}
            value={
              profile.birth_date
                ? new Intl.DateTimeFormat(numberLocale(i18n.language), {
                    dateStyle: "medium",
                    timeZone: "UTC",
                  }).format(new Date(`${profile.birth_date}T00:00:00Z`))
                : t("batch5.unset")
            }
            muted={!profile.birth_date}
            onClick={() => edit("birthday", profile.birth_date ?? "")}
          />
          <div className="py-3">
            <p className="mb-2 text-[16px] font-bold">{t("batch5.gender")}</p>
            <div className="settings-choices" role="group" aria-label={t("batch5.gender")}>
              {["woman", "man", "other", "unset"].map((g) => {
                const on = profile.gender === g || (!profile.gender && g === "unset");
                return (
                  <button
                    key={g}
                    type="button"
                    aria-pressed={on}
                    className={cn("settings-choice", on && "is-on")}
                    onClick={() => void update({ gender: g === "unset" ? null : g })}
                  >
                    {t(`batch5.${g}`)}
                  </button>
                );
              })}
            </div>
          </div>
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
        <h2 className="section-label">{t("ux.account")}</h2>
        <div className="settings-card divided">
          <NavRow
            label={t("settings.editHabits")}
            icon={<ListChecks size={18} aria-hidden="true" />}
            onClick={() => void nav({ to: "/habits" })}
          />
          {!window.matchMedia("(display-mode: standalone)").matches && (
            <NavRow
              label={t("batch9.install")}
              icon={<Download size={18} aria-hidden="true" />}
              onClick={() => toast(t("batch9.installHint"))}
            />
          )}
          <NavRow
            label={t("settings.signOut")}
            icon={<LogOut size={18} aria-hidden="true" />}
            onClick={() => void signOut()}
          />
          {!profile.is_demo && (
            <NavRow
              label={t("settings.deleteAccount")}
              icon={<Trash2 size={18} aria-hidden="true" />}
              danger
              onClick={() => setSheet("delete")}
            />
          )}
        </div>
      </div>
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
        open={sheet === "city" || sheet === "max" || sheet === "time" || sheet === "birthday"}
        onClose={() => setSheet(null)}
        title={t(
          sheet === "birthday"
            ? "batch5.birthDate"
            : sheet === "city"
              ? "batch4.location"
              : sheet === "max"
                ? "batch4.equipment"
                : "batch4.reminders",
        )}
      >
        <Field
          label={t(
            sheet === "birthday"
              ? "batch5.birthDate"
              : sheet === "city"
                ? "batch4.location"
                : sheet === "max"
                  ? "batch4.weight"
                  : "batch4.reminders",
          )}
        >
          <input
            className={inputCls}
            type={
              sheet === "birthday"
                ? "date"
                : sheet === "max"
                  ? "number"
                  : sheet === "time"
                    ? "time"
                    : "text"
            }
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

/** A tappable settings row: label on the start side, current value and a chevron on the end side. */
function NavRow({
  label,
  value,
  icon,
  onClick,
  muted = false,
  danger = false,
  ltrValue = false,
}: {
  label: string;
  value?: string;
  icon?: React.ReactNode;
  onClick: () => void;
  muted?: boolean;
  danger?: boolean;
  ltrValue?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn("settings-nav-row", danger && "is-danger")}
      onClick={onClick}
    >
      {icon}
      <span className="settings-nav-label">{label}</span>
      {value && (
        <span
          className={cn("settings-nav-value", muted && "is-muted")}
          dir={ltrValue ? "ltr" : undefined}
        >
          {value}
        </span>
      )}
      {!danger && (
        <ChevronRight size={18} className="shrink-0 rtl:-scale-x-100" aria-hidden="true" />
      )}
    </button>
  );
}
