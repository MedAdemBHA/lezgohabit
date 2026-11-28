import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  clearCrewRetry,
  crewRetryMessage,
  readCrewRetry,
  saveCrewRetry,
  type CrewRetry,
} from "@/lib/start-flow";
import { StickerButton } from "../ui";

/**
 * Shown on Today when joining worked but the crew step didn't: says both things plainly
 * and offers exactly one retry (find again, create again, or try another code).
 */
export function CrewRetryBanner() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [retry, setRetry] = useState<CrewRetry | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => setRetry(readCrewRetry()), []);
  if (!retry) return null;
  function dismiss() {
    clearCrewRetry();
    setRetry(null);
  }
  async function again(current: CrewRetry) {
    setBusy(true);
    const { error } =
      current.action.kind === "find"
        ? await supabase.rpc("find_challenge_crew")
        : current.action.kind === "create"
          ? await supabase.rpc("create_crew", {
              _name: current.action.name,
              _kind: "squad",
              _max_members: 6,
            })
          : { error: null };
    setBusy(false);
    if (error && !error.message.includes("already_in_crew")) {
      const next = { ...current, reason: error.message };
      saveCrewRetry(next);
      setRetry(next);
      toast(t(crewRetryMessage(error.message)));
      return;
    }
    dismiss();
    toast(t("crewRetry.done"));
    await qc.invalidateQueries();
  }
  return (
    <section role="status" className="today-banner bg-yellow space-y-2 sticker-border">
      <div className="flex items-start gap-2">
        <p className="flex-1 font-bold">
          {t("crewRetry.joined")} {t(crewRetryMessage(retry.reason))}
        </p>
        <button type="button" aria-label={t("common.close")} onClick={dismiss} className="p-1">
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      {retry.action.kind === "code" ? (
        <Link to="/crew" onClick={dismiss}>
          <StickerButton size="sm" variant="secondary">
            <RotateCcw size={16} aria-hidden="true" />
            {t("crewRetry.otherCode")}
          </StickerButton>
        </Link>
      ) : (
        <StickerButton
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => void again(retry)}
        >
          <RotateCcw size={16} aria-hidden="true" />
          {t(busy ? "common.loading" : "crewRetry.retry")}
        </StickerButton>
      )}
    </section>
  );
}
