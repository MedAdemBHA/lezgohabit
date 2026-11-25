import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { moderationNotices, type ModerationAction } from "@/lib/event-data";
import { StickerButton, inputCls } from "../ui";
import { ManageCommunity } from "./moderation";

export function ReasonForm({ label, submitLabel, onSubmit, onCancel }: {
  label: string; submitLabel: string; onSubmit: (reason: string) => Promise<void>; onCancel?: () => void;
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  async function send() {
    if (busy || reason.trim().length < 3) return;
    setBusy(true);
    try { await onSubmit(reason.trim()); }
    catch { toast.error(t("moderation.error")); }
    finally { setBusy(false); }
  }
  return <form className="space-y-2" onSubmit={e => { e.preventDefault(); void send(); }}>
    <label className="block font-semibold">{label}
      <textarea dir="auto" required maxLength={280} className={inputCls} value={reason} onChange={e => setReason(e.target.value)} />
    </label>
    <div className="flex flex-wrap gap-2">
      <StickerButton type="submit" size="sm" disabled={busy || reason.trim().length < 3}>{submitLabel}</StickerButton>
      {onCancel && <StickerButton type="button" size="sm" variant="secondary" disabled={busy} onClick={onCancel}>{t("common.cancel")}</StickerButton>}
    </div>
  </form>;
}

export function ModerationNotices({ uid }: { uid: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const q = useQuery(moderationNotices(uid));
  const [appealId, setAppealId] = useState("");
  if (!q.data?.length) return null;
  const refresh = () => qc.invalidateQueries({ queryKey: ["moderation-notices", uid] });
  return <section className="space-y-2">
    <h3 className="font-extrabold">{t("moderation.notices")}</h3>
    {q.data.map(notice => <article className="space-y-2 rounded-xl border p-3" key={notice.id}>
      <p className="font-bold">{t(`moderation.${notice.action}`)} · <bdi>{notice.name}</bdi></p>
      <p dir="auto" className="break-words">{notice.reason}</p>
      {(notice.action === "ban" || notice.action === "remove") &&
        <p className="text-sm">{t(notice.scope === "crew" ? "moderation.crewExit" : "moderation.eventExit")}</p>}
      {notice.response ? <p className="break-words text-sm"><strong>{t("moderation.response")}</strong> <bdi>{notice.response}</bdi></p>
        : notice.appeal && <p role="status" className="text-sm">{t("moderation.appealSent")}</p>}
      <div className="flex flex-wrap gap-2">
        {!notice.seen && <StickerButton size="sm" variant="secondary" onClick={async () => {
          const { error } = await supabase.rpc("mark_moderation_notice_read", { _notice: notice.id });
          if (error) toast.error(t("moderation.error")); else await refresh();
        }}>{t("batch7.read")}</StickerButton>}
        {!notice.appeal && ["hide", "mute", "ban", "remove"].includes(notice.action) && appealId !== notice.id &&
          <StickerButton size="sm" variant="secondary" onClick={() => setAppealId(notice.id)}>{t("moderation.askReview")}</StickerButton>}
      </div>
      {appealId === notice.id && <ReasonForm label={t("moderation.reason")} submitLabel={t("moderation.askReview")}
        onCancel={() => setAppealId("")} onSubmit={async body => {
          const { error } = await supabase.rpc("submit_moderation_appeal", { _notice: notice.id, _body: body });
          if (error) throw error;
          setAppealId(""); await refresh();
        }} />}
    </article>)}
  </section>;
}

type Appeal = { id: string; season: string; crew: string | null; name: string; handle: string; action: ModerationAction; reason: string; body: string };
export function AdminModerationAppeals() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [reply, setReply] = useState("");
  const q = useQuery({
    queryKey: ["moderation-appeals"], retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_moderation_appeals");
      if (error) throw error;
      return data as unknown as Appeal[];
    },
  });
  return <section className="space-y-3">
    <h2 className="text-xl font-extrabold">{t("moderation.appeals")}</h2>
    {q.isPending && <p role="status">{t("common.loading")}</p>}
    {q.isError && <p role="alert">{t("moderation.error")}</p>}
    {q.isSuccess && !q.data.length && <p>{t("moderation.empty")}</p>}
    {q.data?.map(appeal => <article className="sticker space-y-2 rounded-xl p-3" key={appeal.id}>
      <h3 className="font-extrabold"><bdi>@{appeal.handle}</bdi> · {appeal.name} · {t(`moderation.${appeal.action}`)}</h3>
      <p dir="auto" className="break-words text-sm">{appeal.reason}</p>
      <p className="break-words font-semibold" dir="auto">{appeal.body}</p>
      <div className="flex flex-wrap gap-2">
        <ManageCommunity season={appeal.season} crew={appeal.crew ?? undefined} />
        {reply !== appeal.id && <StickerButton size="sm" onClick={() => setReply(appeal.id)}>{t("moderation.response")}</StickerButton>}
      </div>
      {reply === appeal.id && <ReasonForm label={t("moderation.response")} submitLabel={t("moderation.confirm")}
        onCancel={() => setReply("")} onSubmit={async response => {
          const { error } = await supabase.rpc("admin_resolve_moderation_appeal", { _notice: appeal.id, _response: response });
          if (error) throw error;
          setReply(""); await qc.invalidateQueries({ queryKey: ["moderation-appeals"] });
        }} />}
    </article>)}
  </section>;
}
