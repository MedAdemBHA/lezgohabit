import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Bell, RotateCcw, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { recordPresence } from "@/lib/admin.functions";
import type { Profile } from "@/lib/data";
import { loc } from "@/lib/i18n";
import { StickerButton, BottomSheet, Num } from "./ui";
export function AppStatus({ profile, compact=false, hideBell=false }: { profile: Profile | undefined; compact?:boolean; hideBell?:boolean }) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const presence = useServerFn(recordPresence);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const uid = profile?.id ?? "";
  useEffect(() => {
    if (!uid || compact) return;
    let device = localStorage.getItem("lezgo_device");
    if (!device) {
      device = crypto.randomUUID();
      localStorage.setItem("lezgo_device", device);
    }
    void presence({ data: { device } }).catch(() => {});
  }, [uid, presence, compact]);
  const inbox = useQuery({
    queryKey: ["inbox", uid],
    enabled: !!uid,
    refetchInterval: 60_000,
    queryFn: async () => {
      const [announcements, receipts, events] = await Promise.all([
        supabase
          .from("announcements")
          .select("*")
          .order("scheduled_at", { ascending: false })
          .limit(30),
        supabase.from("announcement_receipts").select("announcement_id").eq("user_id", uid),
        supabase.from("notifications").select("*").eq("user_id",uid).order("created_at",{ascending:false}).limit(50),
      ]);
      if (announcements.error) throw announcements.error;
      if (events.error) throw events.error;
      const read = new Set(receipts.data?.map((r) => r.announcement_id));
      return {announcements:(announcements.data ?? []).map((r) => ({ ...r, read: read.has(r.id) })),events:events.data??[]};
    },
  });
  async function reset() {
    setBusy(true);
    const { error } = await supabase.rpc("demo_reset_day");
    if (error) toast.error(t("batch7.actionFailed"));
    else await qc.invalidateQueries();
    setBusy(false);
  }
  if (!profile) return null;
  const unread = (inbox.data?.announcements ?? []).filter((r) => !r.read).length + (inbox.data?.events??[]).filter(r=>!r.read_at).length;
  return (
    <>
      <div className={compact ? "app-status-compact" : "app-status-strip"}>
        {false && !compact && (
          <>
            <span className="app-demo-sticker">{t("batch7.demoSticker")}</span>
            <StickerButton
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => void reset()}
              className="app-demo-reset"
            >
              <RotateCcw className="size-4" />
              {t("batch7.resetDemo")}
            </StickerButton>
          </>
        )}
        {!hideBell && <StickerButton
          variant="ghost"
          className="app-inbox-button"
          onClick={() => setOpen(true)}
          aria-label={`${t("batch7.inbox")}${unread ? ` · ${unread}` : ""}`}
        >
          <Bell className="size-5" />
          {unread > 0 && <Num className="app-inbox-count">{unread}</Num>}
        </StickerButton>}
      </div>
      <BottomSheet open={open} onClose={() => setOpen(false)} title={t("batch7.inbox")}>
        <div className="space-y-4">
          {(inbox.data?.events??[]).filter(row=>row.type!=="broadcast").map(row=><article className="border-b-2 border-ink py-4" key={row.id}><a href={row.url} className="block min-h-11 text-[18px] font-extrabold">{t(`batch9.${row.type}`)}</a>{!row.read_at&&<StickerButton size="sm" variant="lime" onClick={async()=>{const {error}=await supabase.from("notifications").update({read_at:new Date().toISOString()}).eq("id",row.id).eq("user_id",uid);if(error)toast.error(t("common.error"));else await qc.invalidateQueries({queryKey:["inbox"]});}}><Check className="size-4"/>{t("batch7.read")}</StickerButton>}</article>)}
          {(inbox.data?.announcements ?? []).map((row) => (
            <article className="border-b-2 border-ink py-4" key={row.id}>
              <h3 className="text-[18px] font-extrabold">{loc(row.title, i18n.language)}</h3>
              <p className="mt-2 whitespace-pre-wrap">{loc(row.body, i18n.language)}</p>
              {!row.read && (
                <StickerButton
                  size="sm"
                  variant="lime"
                  className="mt-3"
                  onClick={async () => {
                    const { error } = await supabase
                      .from("announcement_receipts")
                      .insert({ announcement_id: row.id, user_id: uid, is_demo: profile.is_demo });
                    if (error) toast.error(t("batch7.actionFailed"));
                    else await qc.invalidateQueries({ queryKey: ["inbox"] });
                  }}
                >
                  <Check className="size-4" />
                  {t("batch7.read")}
                </StickerButton>
              )}
            </article>
          ))}
          {inbox.data?.announcements.length === 0 && inbox.data.events.length===0 && <p>{t("batch7.noNotifications")}</p>}
        </div>
      </BottomSheet>
    </>
  );
}
