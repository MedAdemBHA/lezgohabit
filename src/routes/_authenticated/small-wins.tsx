import { createFileRoute } from "@tanstack/react-router";
import { challengeEntryQuery, isPrivateChallenge } from "@/lib/challenge-history";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Share2, RefreshCw, Send, Check } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/lezgo/app-shell";
import { Num, StickerButton } from "@/components/lezgo/ui";
import { exportCard } from "@/components/lezgo/sharing/export-card";
import { dayQuery, habitsQuery, useBase } from "@/lib/data";
import {
  WIN_KEYS,
  pickCaption,
  prefilledWins,
  shareableWins,
  type WinKey,
} from "@/lib/batch6-rules";
import { daysBetween, pad } from "@/lib/time";
import { pageHead } from "@/lib/page-head";
import { supabase } from "@/integrations/supabase/client";
export const Route = createFileRoute("/_authenticated/small-wins")({
  head: () =>
    pageHead(
      "Small Wins · lezgo",
      "Turn your daily wins into a lezgo share card or a community post.",
    ),
  validateSearch: (search: Record<string, unknown>): { from?: "profile" } =>
    search["from"] === "profile" ? { from: "profile" } : {},
  component: SmallWins,
});
const COLORS = ["blue", "lime", "pink", "yellow", "purple", "teal", "orange", "lime", "pink"];
function SmallWins() {
  const { t, i18n } = useTranslation();
  const { from } = Route.useSearch();
  const { uid, profile, season, today } = useBase();
  const qc = useQueryClient();
  const sid = season?.id ?? "";
  const entry = useQuery({ ...challengeEntryQuery(uid, sid) });
  const hs = useQuery({ ...habitsQuery(uid, sid), enabled: !!uid && !!sid });
  const ds = useQuery({ ...dayQuery(uid, sid, today), enabled: !!uid && !!sid });
  const [selected, setSelected] = useState<WinKey[]>([]);
  const initialized = useRef("");
  const touched = useRef(false);
  const [caption, setCaption] = useState(0);
  const [square, setSquare] = useState(false);
  const [busy, setBusy] = useState(false);
  const card = useRef<HTMLDivElement>(null);
  const labels = (k: WinKey) => t(`batch6.${k === "steps" ? "stepsWin" : k}`);
  const captions = t("batch6.captions", { returnObjects: true }) as string[];
  const winCaptions = t("batch6.winCaptions", { returnObjects: true }) as Partial<
    Record<WinKey, string[]>
  >;
  const safe = shareableWins(selected, profile?.faith_public ?? false);
  const words = pickCaption(safe, winCaptions, captions, `${uid}|${today}`, caption);
  const loggedWins = hs.data && ds.data ? prefilledWins(hs.data, ds.data.checkins) : [];
  const suggestions: WinKey[] = [
    ...new Set<WinKey>([...loggedWins, "water", "read", "steps"]),
  ].slice(0, 3);
  const day = season ? Math.max(1, daysBetween(season.starts_on, today) + 1) : 1;
  useEffect(() => {
    if (!hs.data || !ds.data || initialized.current === sid) return;
    initialized.current = sid;
    if (!touched.current) setSelected(prefilledWins(hs.data, ds.data.checkins));
  }, [hs.data, ds.data, sid]);
  async function share() {
    if (!card.current) return;
    setBusy(true);
    try {
      await exportCard(card.current, `lezgo-small-wins-${today}`, square);
    } catch {
      toast(t("batch6.exportError"));
    } finally {
      setBusy(false);
    }
  }
  async function post() {
    if (!sid || !safe.length) return;
    setBusy(true);
    const r = await supabase.rpc("post_small_wins", {
      _season_id: sid,
      _wins: safe,
      _language: profile?.language ?? "en",
      _caption: words,
    });
    if (r.error) toast(t("common.error"));
    else {
      toast(t("batch6.posted"));
      await qc.invalidateQueries({ queryKey: ["feed"] });
    }
    setBusy(false);
  }
  function renderWin(key: WinKey) {
    const picked = selected.includes(key);
    return (
      <StickerButton
        key={key}
        variant="secondary"
        className={`win-choice ${picked ? "selected" : ""}`}
        data-color={COLORS[WIN_KEYS.indexOf(key)]}
        aria-pressed={picked}
        onClick={() => {
          touched.current = true;
          setCaption(0);
          setSelected((previous) =>
            previous.includes(key) ? previous.filter((win) => win !== key) : [...previous, key],
          );
        }}
      >
        {labels(key)}
        {picked && <Check size={14} aria-hidden="true" />}
      </StickerButton>
    );
  }
  return (
    <AppShell title={t("batch6.winTitle")} back={from === "profile" ? "/profile" : "/today"}>
      <section className="wins-picker" aria-labelledby="choose-wins-title">
        <h2 id="choose-wins-title" className="app-section-title">
          {t("appRefresh.chooseWins")}
        </h2>
        <div className="win-chips">{suggestions.map(renderWin)}</div>
        <details className="app-disclosure wins-more">
          <summary>
            {t("appRefresh.moreWins")}
            <ChevronDown size={18} aria-hidden="true" />
          </summary>
          <div className="win-chips">
            {WIN_KEYS.filter((key) => !suggestions.includes(key)).map(renderWin)}
          </div>
        </details>
        {safe.length < selected.length && (
          <p className="wins-privacy" role="status">
            {t("batch6.privacy")}
          </p>
        )}
      </section>
      <section className="app-surface wins-studio" aria-labelledby="win-preview-title">
        <div className="wins-studio-header">
          <h2 id="win-preview-title" className="app-section-title">
            {t("appRefresh.preview")}
          </h2>
          <button
            className="app-icon-button"
            type="button"
            onClick={() => setCaption((n) => n + 1)}
            disabled={!safe.length}
            aria-label={t("batch6.newCaption")}
          >
            <RefreshCw size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="wins-preview-stage">
          <div
            ref={card}
            className={`small-win-card ${square ? "square" : ""}`}
            dir={i18n.dir()}
            data-dense={safe.length > 4}
          >
            <div className="share-top">
              <Num>
                {t("todayDesign.day")} {pad(day)}
              </Num>
              <bdi dir="ltr">@{profile?.handle ?? ""}</bdi>
            </div>
            <h2>{t("batch6.tinyFlex")}</h2>
            <div className="win-stickers">
              {!safe.length && <span className="win-empty">{t("batch6.pickWins")}</span>}
              {safe.map((k, i) => (
                <span
                  className="win-sticker"
                  data-color={COLORS[WIN_KEYS.indexOf(k)]}
                  data-tilt={i % 2}
                  key={k}
                >
                  {labels(k)}
                </span>
              ))}
            </div>
            {safe.length > 0 && (
              <p className="win-caption" aria-live="polite">
                “{words}”
              </p>
            )}
            <span className="share-brand">
              lez<span>go</span>
              <span className="brand-chevrons">&gt;&gt;</span>
            </span>
          </div>
        </div>
        <div className="export-modes" role="group" aria-label={t("appRefresh.preview")}>
          {[false, true].map((s) => (
            <StickerButton
              key={String(s)}
              variant="ghost"
              size="sm"
              onClick={() => setSquare(s)}
              aria-pressed={s === square}
            >
              {t(s ? "batch6.square" : "batch6.portrait")}
            </StickerButton>
          ))}
        </div>
      </section>
      <div className="wins-actions">
        <StickerButton variant="lime" disabled={busy || !safe.length} onClick={() => void share()}>
          <Share2 size={18} aria-hidden="true" />
          {t("batch6.shareCard")}
        </StickerButton>
        {entry.isSuccess && !isPrivateChallenge(entry.data) && (
          <StickerButton
            variant="secondary"
            disabled={busy || !safe.length || !sid}
            onClick={() => void post()}
          >
            <Send size={18} aria-hidden="true" />
            {t("batch6.postFeed")}
          </StickerButton>
        )}
      </div>
    </AppShell>
  );
}
