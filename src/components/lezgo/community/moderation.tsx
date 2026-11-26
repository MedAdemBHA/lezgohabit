import { useDeferredValue, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { memberReportsQuery, moderate, moderationQueue, type ModerationAction, type ModerationScope } from "@/lib/event-data";
import { BottomSheet, StickerButton, inputCls } from "../ui";

type PendingAction = { action: ModerationAction | "resolveMember"; id: string; label: string };

export function ManageCommunity({ season, crew }: ModerationScope) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const title = t(crew ? "moderation.crewManage" : "moderation.eventManage");
  return <>
    <StickerButton size="sm" variant="secondary" onClick={() => setOpen(true)}>{title}</StickerButton>
    <BottomSheet open={open} onClose={() => setOpen(false)} title={title}>
      {open && <ModerationQueue season={season} crew={crew} />}
    </BottomSheet>
  </>;
}

function ModerationQueue(scope: ModerationScope) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [announcement, setAnnouncement] = useState<string | null>(null);
  const [rotating, setRotating] = useState(false);
  const [rotateBusy, setRotateBusy] = useState(false);
  const [section, setSection] = useState<"reports" | "members" | "restrictions">("reports");
  const queue = useQuery(moderationQueue(scope, useDeferredValue(search.trim())));
  const reports = useQuery({ ...memberReportsQuery(scope), enabled: section === "reports" });
  async function publishAnnouncement() {
    if (!announcement || announcement.trim().length < 3 || rotateBusy) return;
    setRotateBusy(true);
    try {
      const { error } = await supabase.rpc("publish_event_announcement", { _season: scope.season, _body: announcement });
      if (error) throw error;
      setAnnouncement(null);
      toast.success(t("settings.saved"));
      await qc.invalidateQueries();
    } catch { toast.error(t("moderation.error")); }
    finally { setRotateBusy(false); }
  }
  async function rotateInvite() {
    if (!scope.crew || rotateBusy) return;
    setRotateBusy(true);
    try {
      const { error } = await supabase.rpc("rotate_crew_invite", { _season: scope.season, _crew: scope.crew });
      if (error) throw error;
      setRotating(false);
      toast.success(t("settings.saved"));
      await qc.invalidateQueries();
    } catch { toast.error(t("moderation.error")); }
    finally { setRotateBusy(false); }
  }
  const label = (key: PendingAction["action"]) => t(`moderation.${key}`);
  const button = (action: PendingAction["action"], id: string, name: string) =>
    <StickerButton key={action} type="button" size="sm" variant={action === "ban" || action === "remove" ? "danger" : "secondary"}
      onClick={() => setPending({ action, id, label: name })}>{label(action)}</StickerButton>;

  if (pending) return <ModerationForm scope={scope} pending={pending} onCancel={() => setPending(null)}
    onSaved={async () => { setPending(null); await qc.invalidateQueries(); }} />;

  const members = queue.data?.members.filter(member => member.id !== queue.data?.me) ?? [];
  const items = section === "members" ? members : queue.data?.[section];
  const viewingReports = section === "reports";
  const loading = queue.isPending || (viewingReports && reports.isPending);
  const failed = queue.isError || (viewingReports && reports.isError);
  return <div className="space-y-4">
    <div className="flex flex-wrap gap-2">
      {(["reports", "members", "restrictions"] as const).map(tab => <StickerButton key={tab} size="sm" type="button"
        aria-pressed={tab === section} variant={tab === section ? "lime" : "secondary"}
        onClick={() => setSection(tab)}>{t(`moderation.${tab}`)}</StickerButton>)}
    </div>
    {section === "members" && <label className="block text-sm font-bold">{t("moderation.search")}
      <input className={inputCls} type="search" value={search} onChange={e => setSearch(e.target.value)} />
    </label>}
    {loading && <p role="status">{t("common.loading")}</p>}
    {failed && <div className="space-y-2">
      <p role="alert">{t("moderation.loadError")}</p>
      <StickerButton type="button" size="sm" variant="secondary" disabled={queue.isFetching || (viewingReports && reports.isFetching)}
        onClick={() => {
          if (queue.isError) void queue.refetch();
          if (viewingReports && reports.isError) void reports.refetch();
        }}>{t("common.retry")}</StickerButton>
    </div>}
    {!loading && !failed && !items?.length && (!viewingReports || !reports.data?.length) && <p>{t("moderation.empty")}</p>}
    {section === "reports" && !scope.crew && (announcement === null
      ? <StickerButton size="sm" variant="secondary" onClick={() => setAnnouncement("")}>{t("moderation.announce")}</StickerButton>
      : <form className="space-y-2 rounded-xl border p-3" onSubmit={e => { e.preventDefault(); void publishAnnouncement(); }}>
          <label className="block font-bold">{t("moderation.announcement")}
            <textarea dir="auto" maxLength={280} className={inputCls} value={announcement}
              onChange={e => setAnnouncement(e.target.value)} />
          </label>
          <div className="flex flex-wrap gap-2">
            <StickerButton type="submit" size="sm" disabled={rotateBusy || announcement.trim().length < 3}>{t("moderation.announce")}</StickerButton>
            <StickerButton type="button" size="sm" variant="secondary" disabled={rotateBusy} onClick={() => setAnnouncement(null)}>{t("common.cancel")}</StickerButton>
          </div>
        </form>)}
    {section === "reports" && reports.data?.map(report => <article className="sticker space-y-2 rounded-xl p-3" key={report.id}>
      <h3 className="font-extrabold">{t("moderation.reportMember")} · <bdi>@{report.handle}</bdi></h3>
      <p className="break-words" dir="auto">{report.reason}</p>
      {button("resolveMember", report.id, `@${report.handle}`)}
    </article>)}
    {section === "members" && scope.crew && (rotating
      ? <div className="rounded-xl border p-3"><p>{t("moderation.rotateHint")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <StickerButton size="sm" disabled={rotateBusy} onClick={() => void rotateInvite()}>{t("moderation.rotateInvite")}</StickerButton>
            <StickerButton size="sm" variant="secondary" disabled={rotateBusy} onClick={() => setRotating(false)}>{t("common.cancel")}</StickerButton>
          </div>
        </div>
      : <StickerButton size="sm" variant="secondary" onClick={() => setRotating(true)}>{t("moderation.rotateInvite")}</StickerButton>)}
    {section === "reports" && queue.data?.reports.map(post => <article className="sticker space-y-2 rounded-xl p-3" key={post.id}>
      <p className="font-extrabold"><bdi>@{post.author}</bdi></p>
      <p className="break-words" dir="auto">{post.body || t("batch4.proofPhoto")}</p>
      {!!post.reports.length && <ul className="list-disc ps-5 text-sm">
        {post.reports.map((reason, index) => <li key={index} dir="auto">{reason}</li>)}
      </ul>}
      <div className="flex flex-wrap gap-2">
        {button(post.hidden ? "restore" : "hide", post.id, `@${post.author}`)}
        {!!post.reports.length && button("dismiss", post.id, `@${post.author}`)}
      </div>
    </article>)}
    {section === "members" && members.map(member => <article className="sticker space-y-2 rounded-xl p-3" key={member.id}>
      <p className="break-words font-extrabold" dir="auto">{member.name} · <bdi>@{member.handle}</bdi></p>
      <div className="flex flex-wrap gap-2">
        {(["mute", "ban", ...(scope.crew ? ["remove", "transfer"] : [])] as ModerationAction[])
          .map(action => button(action, member.id, `@${member.handle}`))}
      </div>
    </article>)}
    {section === "restrictions" && queue.data?.restrictions.map(row => <article className="sticker space-y-2 rounded-xl p-3" key={`${row.id}-${row.restriction}`}>
      <p className="font-extrabold"><bdi>@{row.handle}</bdi> · {label(row.restriction)}</p>
      <p className="break-words text-sm" dir="auto">{row.reason}</p>
      {button(row.restriction === "ban" ? "unban" : "unmute", row.id, `@${row.handle}`)}
    </article>)}
  </div>;
}

export function ModerationForm({ scope, pending, onCancel, onSaved }: {
  scope: ModerationScope; pending: PendingAction; onCancel: () => void; onSaved: () => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (busy || reason.trim().length < 3) return;
    setBusy(true);
    try {
      if (pending.action === "resolveMember") {
        const { error } = await supabase.rpc("resolve_community_member_report", { _report: pending.id, _reason: reason });
        if (error) throw error;
      } else {
        await moderate(scope, pending.action, pending.id, reason);
      }
      toast.success(t("settings.saved"));
      await onSaved();
    } catch {
      toast.error(t("moderation.error"));
    } finally {
      setBusy(false);
    }
  }
  return <form className="space-y-3" onSubmit={event => { event.preventDefault(); void submit(); }}>
    <h3 className="font-extrabold">{t(`moderation.${pending.action}`)} · {t(scope.crew ? "moderation.crew" : "moderation.event")} · <bdi>{pending.label}</bdi></h3>
    {(pending.action === "ban" || pending.action === "remove") && <p>{t(scope.crew ? "moderation.crewExit" : "moderation.eventExit")}</p>}
    <label className="block font-bold">{t("moderation.reason")}
      <textarea dir="auto" required maxLength={280} className={inputCls} value={reason} onChange={e => setReason(e.target.value)} />
    </label>
    <div className="flex flex-wrap gap-2">
      <StickerButton type="submit" variant={pending.action === "ban" ? "danger" : "lime"} disabled={busy || reason.trim().length < 3}>
        {t("moderation.confirm")}
      </StickerButton>
      <StickerButton type="button" variant="secondary" disabled={busy} onClick={onCancel}>{t("common.cancel")}</StickerButton>
    </div>
  </form>;
}
