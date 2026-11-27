import { useEffect, useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { StickerButton } from "../ui";
import { readQueue, syncGoes, registerOffline } from "@/lib/launch/offline";
export function OfflineStatus({ uid }: { uid: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [offline, setOffline] = useState(false);
  const [pending, setPending] = useState(0);
  const syncing = useRef(false);
  useEffect(() => {
    void registerOffline();
    async function update() {
      setOffline(!navigator.onLine);
      setPending(readQueue().filter((r) => r.uid === uid).length);
      if (navigator.onLine && !syncing.current && readQueue().some((r) => r.uid === uid)) {
        syncing.current = true;
        try {
          const result = await syncGoes(uid);
          if (result.sent) {
            toast(t("batch9.synced"));
            await qc.invalidateQueries();
          }
          if (result.expired) toast(t("batch9.expired"));
        } finally {
          syncing.current = false;
          setPending(readQueue().filter((r) => r.uid === uid).length);
        }
      }
    }
    void update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    window.addEventListener("lezgo-queue", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      window.removeEventListener("lezgo-queue", update);
    };
  }, [uid, qc, t]);
  return (
    <>
      {(offline || pending > 0) && (
        <div role="status" className="sticker bg-yellow mx-4 my-2 p-3 text-sm font-bold">
          {offline ? t("batch9.offline") : t("batch9.pending", { n: pending })}
          {!offline && (
            <StickerButton
              variant="ghost"
              aria-label={t("batch9.sync")}
              onClick={() => window.dispatchEvent(new Event("lezgo-queue"))}
            >
              <RefreshCw className="size-5" />
            </StickerButton>
          )}
        </div>
      )}
    </>
  );
}
