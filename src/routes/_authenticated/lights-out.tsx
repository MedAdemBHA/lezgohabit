import { GuestChromeAuto } from "@/components/lezgo/guest";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { X, Moon } from "lucide-react";
import { toast } from "sonner";
import { Num, StickerButton } from "@/components/lezgo/ui";
import { FitHeading } from "@/components/lezgo/fit-heading";
import { useBase, dayQuery, habitsQuery } from "@/lib/data";
import { signatureQuery } from "@/lib/signature-data";
import { MOODS, TOMORROW_MAX } from "@/lib/signature-rules";
import { completion } from "@/lib/habits";
import { habitName } from "@/components/lezgo/today/habit-tile";
import { useNow, pad } from "@/lib/time";
import { pageHead } from "@/lib/page-head";
import { supabase } from "@/integrations/supabase/client";
import { ConfirmSheet } from "@/components/lezgo/confirm-sheet";
export const Route = createFileRoute("/_authenticated/lights-out")({
  head: () =>
    pageHead(
      "Lights out · lezgo",
      "A private mood and intention to close your day without points.",
    ),
  component: LightsOut,
});
function LightsOut() {
  const { t, i18n } = useTranslation();
  const { uid, season, today, tz } = useBase();
  const sid = season?.id ?? "";
  const qc = useQueryClient();
  const navigate = useNavigate();
  const sig = useQuery({ ...signatureQuery(uid, sid), enabled: !!uid && !!sid });
  const day = useQuery({ ...dayQuery(uid, sid, today), enabled: !!uid && !!sid });
  const habits = useQuery({ ...habitsQuery(uid, sid), enabled: !!uid && !!sid });
  const [mood, setMood] = useState<(typeof MOODS)[number] | null>(null);
  const [tomorrow, setTomorrow] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const now = useNow();
  const byHabit = new Map(day.data?.checkins.map((c) => [c.user_habit_id, c]));
  const list = habits.data ?? [];
  const missing = list.filter((h) => completion(h, byHabit.get(h.id)) < 1);
  const done = list.length - missing.length;
  async function save() {
    if (!mood) return;
    setBusy(true);
    const r = await supabase.rpc("close_my_day", { _mood: mood, _tomorrow: tomorrow });
    setBusy(false);
    setConfirmOpen(false);
    if (r.error) {
      toast.error(t(r.error.message.includes("day_final") ? "integrity.dayFinal" : "common.error"));
      return;
    }
    await qc.invalidateQueries({ queryKey: ["signature"] });
    toast.success(t("batch8.closed"));
    void navigate({ to: "/today" });
  }
  return (
    <main className="lights-page">
      <GuestChromeAuto />
      <div className="lights-inner">
        <header>
          <Num>
            {now
              ? new Intl.DateTimeFormat("en-GB", {
                  timeZone: tz,
                  hour: "2-digit",
                  minute: "2-digit",
                  hourCycle: "h23",
                }).format(now)
              : "—"}{" "}
            · {t("batch8.day", { n: pad(sig.data?.day ?? 1) })}
          </Num>
          <Link to="/today">
            <StickerButton variant="ghost" className="lights-close" aria-label={t("common.close")}>
              <X />
            </StickerButton>
          </Link>
        </header>
        <FitHeading className="signature-heading" requestedSize={64} text={t("batch8.lights")} />
        <p className="lights-sub">{t("batch8.lightsSub")}</p>
        <div className="lights-summary">
          <svg viewBox="0 0 70 70" width="64" height="64" aria-hidden>
            <circle cx="35" cy="35" r="29" className="ring-track" />
            <circle
              cx="35"
              cy="35"
              r="29"
              className="ring-progress"
              strokeDasharray={`${Math.min(1, Number(day.data?.score?.completion ?? 0)) * 182} 182`}
              transform="rotate(-90 35 35)"
            />
            <Moon x="23" y="23" width="24" height="24" />
          </svg>
          <div>
            <h2>
              {t("batch8.summary", {
                done,
                total: list.length,
                points: day.data?.score?.total ?? 0,
              })}
            </h2>
            <p>
              {missing[0]
                ? t("batch8.stillOpen", { name: habitName(missing[0], t, i18n.language) })
                : t("batch8.allDone")}
            </p>
          </div>
        </div>
        <fieldset>
          <legend>{t("batch8.feel")}</legend>
          <div className="mood-chips">
            {MOODS.map((m) => (
              <StickerButton
                key={m}
                size="sm"
                variant="ghost"
                className="mood-chip"
                aria-pressed={mood === m}
                onClick={() => setMood(m)}
              >
                {t(`batch8.${m}`)}
              </StickerButton>
            ))}
          </div>
        </fieldset>
        <label className="lights-label">
          {t("batch8.tomorrow")}
          <input
            maxLength={TOMORROW_MAX}
            value={tomorrow}
            onChange={(e) => setTomorrow(e.target.value)}
            placeholder={t("batch8.tomorrowPlaceholder")}
          />
        </label>
        <footer>
          <StickerButton
            block
            className="lights-submit"
            disabled={!mood || busy || !day.data}
            onClick={() => setConfirmOpen(true)}
          >
            {t("batch8.closeDay")}
          </StickerButton>
          <p>{t("batch8.privateMood")}</p>
        </footer>
        <ConfirmSheet open={confirmOpen} title={t("integrity.closeTitle")} body={t("integrity.closeBody")} confirmLabel={t("integrity.closeConfirm")} busy={busy} onConfirm={() => void save()} onClose={() => setConfirmOpen(false)} />
      </div>
    </main>
  );
}
