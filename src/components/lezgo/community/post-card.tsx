import { ModerationForm } from "./moderation";
import type { ModerationScope } from "@/lib/event-data";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, Hand, Zap, Smile, Star, Flag, EyeOff, Trash2, Pin, PinOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { REACTIONS, type Post } from "@/lib/feed-data";
import { loc } from "@/lib/i18n";
import { habitColor } from "@/lib/today-rules";
import { daysBetween, useNow } from "@/lib/time";
import { cn } from "@/lib/utils";
import { Avatar, BottomSheet, StickerButton, Num, inputCls } from "../ui";
const reactionIcons = { respect: Hand, beast: Zap, lol: Smile, legend: Star };
export function PostCard({ post, uid, start, season, canPin = false, reportCrew, moderation }: { post: Post; uid: string; start: string; season: string; canPin?: boolean; reportCrew?: string | undefined; moderation?: ModerationScope | undefined }) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const now = useNow(60_000);
  const [picker, setPicker] = useState(false);
  const [menu, setMenu] = useState(false);
  const [report, setReport] = useState<"post" | "member" | null>(null);
  const [moderateOpen, setModerateOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClick = useRef(false);
  const clearHold = () => {
    if (hold.current) clearTimeout(hold.current);
    hold.current = null;
  };
  useEffect(() => () => clearHold(), []);
  const minutes = now
    ? Math.max(0, Math.floor((now.getTime() - new Date(post.created_at).getTime()) / 60000))
    : 0;
  const ago = new Intl.RelativeTimeFormat(i18n.language === "aeb" ? "ar-TN" : i18n.language, {
    numeric: "auto",
  }).format(
    minutes >= 1440
      ? -Math.floor(minutes / 1440)
      : minutes >= 60
        ? -Math.floor(minutes / 60)
        : -minutes,
    minutes >= 1440 ? "day" : minutes >= 60 ? "hour" : "minute",
  );
  async function react(kind: (typeof REACTIONS)[number]) {
    setBusy(true);
    const { error } = await supabase.rpc("react_post", { _post_id: post.id, _kind: kind });
    setBusy(false);
    if (error) {
      toast(t("common.error"));
      return;
    }
    setPicker(false);
    await qc.invalidateQueries({ queryKey: ["feed"] });
  }
  async function action(a: string) {
    if (a === "delete" && !window.confirm(t("batch4.deleteConfirm"))) return;
    setBusy(true);
    const request = a === "report" && report === "member"
      ? supabase.rpc("report_community_member", { _season: season, _target: post.user_id, _reason: reason,
          ...(reportCrew ? { _crew: reportCrew } : {}) })
      : a === "report" && reportCrew
      ? supabase.rpc("report_community_post", { _post: post.id, _reason: reason, _crew: reportCrew })
      : supabase.rpc("post_action", {
      _post_id: post.id,
      _action: a,
      _reason: reason,
    });
    const { error } = await request;
    setBusy(false);
    if (error) {
      toast(t("common.error"));
      return;
    }
    setMenu(false);
    setReport(null);
    await qc.invalidateQueries({ queryKey: ["feed"] });
    toast(t(a === "report" ? "batch4.reported" : "settings.saved"));
  }
  async function pin() {
    setBusy(true);
    const { error } = await supabase.rpc("set_challenge_pin", { _post_id: post.id, _pin: !post.is_pinned });
    setBusy(false);
    if (error) {
      toast(t("common.error"));
      return;
    }
    setMenu(false);
    await qc.invalidateQueries({ queryKey: ["feed"] });
  }
  const stat = post.stats;
  const unit = typeof stat["unit"] === "string" ? stat["unit"] : null;
  return (
    <article className="post-card">
      <div className="post-head">
        <Avatar id={post.user_id} name={post.display_name} url={post.avatar_url} size={44} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-extrabold">{post.display_name}</h2>
          <p className="font-semibold text-muted-foreground">
            {ago} · {t("batch4.day", { n: daysBetween(start, post.day) + 1 })}
          </p>
        </div>
        <span
          className={cn(
            "post-tag",
            post.habit_key ? `bg-${habitColor(post.habit_key, post.category ?? "")}` : "bg-teal",
          )}
        >
          {post.habit_key ? loc(post.habit_name, i18n.language) : t(`batch4.${post.type}`)}
        </span>
        <StickerButton
          variant="ghost"
          className="post-menu"
          aria-label={t("batch4.postOptions")}
          onClick={() => setMenu(true)}
        >
          <MoreHorizontal size={22} />
        </StickerButton>
      </div>
      {post.hidden && <p className="text-[12px] font-bold text-warning">{t("batch4.pending")}</p>}
      {post.is_pinned && <span className="inline-flex items-center gap-1 rounded-full bg-yellow px-3 py-1 text-[12px] font-extrabold sticker-border"><Pin size={14} />{t("challengePulse.pinned")}</span>}
      {post.body && <p className="post-body">{post.body}</p>}
      {post.image_path &&
        (post.image ? (
          <img
            className="post-photo"
            src={post.image}
            alt={t("batch4.proofPhoto")}
            loading="lazy"
          />
        ) : (
          <div className="post-photo photo-unavailable">{t("batch4.photoUnavailable")}</div>
        ))}
      <div className="post-footer">
        <div className="flex min-w-0 flex-1 flex-wrap gap-2">
          {stat["salat"] != null ? (
            <span className="stat-chip">
              <Num>{stat["salat"]}/5</Num> {t("today.salatTitle")}
            </span>
          ) : (
            stat["value"] != null && (
              <span className="stat-chip">
                <Num>{stat["value"]}</Num> {unit ?? t("common.done")}
              </span>
            )
          )}
          {post.visibility === "crew" && <span className="stat-chip">{t("batch4.crew")}</span>}
        </div>
        <span className="sr-only">
          {t(post.visibility === "crew" ? "challengePulse.respectCrew" : "challengePulse.respectChallenge", { n: post.reactions })}
        </span>
        <StickerButton
          variant="secondary"
          className={cn("reaction-pill", post.my_reaction && "bg-yellow")}
          disabled={busy || post.hidden}
          aria-label={t("challengePulse.respect")}
          onClick={() => {
            if (suppressClick.current) { suppressClick.current = false; return; }
            void react("respect");
          }}
          onPointerDown={() => {
            clearHold();
            suppressClick.current = false;
            hold.current = setTimeout(() => {
              suppressClick.current = true;
              setPicker(true);
              window.setTimeout(() => { suppressClick.current = false; }, 1500);
            }, 450);
          }}
          onPointerUp={clearHold}
          onPointerCancel={() => { clearHold(); suppressClick.current = false; }}
          onPointerLeave={clearHold}
          onContextMenu={(e) => {
            e.preventDefault();
            setPicker(true);
          }}
        >
          <Hand size={20} />
          <span aria-hidden="true">{post.reactions}</span>
        </StickerButton>
      </div>
      <p className="mt-1 text-[12px] font-semibold text-muted-foreground">
        {t(post.visibility === "crew" ? "challengePulse.respectCrew" : "challengePulse.respectChallenge", { n: post.reactions })}
      </p>
      <BottomSheet open={picker} onClose={() => setPicker(false)} title={t("batch4.react")}>
        <div className="grid grid-cols-2 gap-3">
          {REACTIONS.map((kind) => {
            const Icon = reactionIcons[kind];
            return (
              <StickerButton
                key={kind}
                variant={post.my_reaction === kind ? "lime" : "secondary"}
                disabled={busy}
                onClick={() => void react(kind)}
              >
                <Icon size={22} />
                {t(`batch4.${kind}`)}
              </StickerButton>
            );
          })}
        </div>
      </BottomSheet>
      <BottomSheet open={menu} onClose={() => setMenu(false)} title={t("batch4.postOptions")}>
        <div className="space-y-3">
          {canPin && <StickerButton variant="secondary" block disabled={busy} onClick={() => void pin()}>
            {post.is_pinned ? <PinOff size={20} /> : <Pin size={20} />}
            {t(post.is_pinned ? "challengePulse.unpin" : "challengePulse.pin")}
          </StickerButton>}
          {moderation && <StickerButton variant="secondary" block onClick={() => { setMenu(false); setModerateOpen(true); }}>
            <EyeOff size={20} />{t("moderation.hide")} · {t(moderation.crew ? "moderation.crew" : "moderation.event")}
          </StickerButton>}
          {post.user_id === uid ? (
            <StickerButton
              variant="danger"
              block
              disabled={busy}
              onClick={() => void action("delete")}
            >
              <Trash2 size={20} />
              {t("batch4.delete")}
            </StickerButton>
          ) : (
            <>
              <StickerButton
                variant="secondary"
                block
                onClick={() => {
                  setMenu(false);
                  setReason("");
                  setReport("post");
                }}
              >
                <Flag size={20} />
                {t("batch4.report")}
              </StickerButton>
              <StickerButton block variant="secondary" onClick={() => { setMenu(false); setReason(""); setReport("member"); }}>
                <Flag size={20} />{t("moderation.reportMember")}
              </StickerButton>
              <StickerButton
                variant="secondary"
                block
                disabled={busy}
                onClick={() => void action("hide")}
              >
                <EyeOff size={20} />
                {t("batch4.hide")}
              </StickerButton>
            </>
          )}
        </div>
      </BottomSheet>
      {moderation && <BottomSheet open={moderateOpen} onClose={() => setModerateOpen(false)} title={t("moderation.hide")}>
        {moderateOpen && <ModerationForm scope={moderation} pending={{ action: "hide", id: post.id, label: `@${post.handle}` }}
          onCancel={() => setModerateOpen(false)} onSaved={async () => { setModerateOpen(false); await qc.invalidateQueries(); }} />}
      </BottomSheet>}
      <BottomSheet open={!!report} onClose={() => setReport(null)} title={t(report === "member" ? "moderation.reportMember" : "batch4.report")}>
        <label className="block font-bold">
          {t("batch4.reason")}
          <textarea
            className={cn(inputCls, "mt-2 min-h-28 py-3")}
            maxLength={280}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        <StickerButton
          className="mt-4"
          block
          disabled={reason.trim().length < (report === "member" ? 3 : 1) || busy}
          onClick={() => void action("report")}
        >
          {t("batch4.report")}
        </StickerButton>
      </BottomSheet>
    </article>
  );
}
