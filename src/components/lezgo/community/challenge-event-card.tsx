import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Hand, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { ChallengeEvent } from "@/lib/feed-data";
import { Avatar, Num, StickerButton } from "@/components/lezgo/ui";

export function ChallengeEventCard({ event, challengeName }: { event: ChallengeEvent; challengeName: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const name = event.display_name ?? t("challengePulse.aPlayer");
  const text = event.type === "perfect_day"
    ? t("challengePulse.perfect", { name })
    : event.type === "streak"
      ? t("challengePulse.streak", { name, n: event.payload["days"] ?? 0 })
      : event.type === "boss"
        ? t("challengePulse.boss", { name, level: event.payload["level"] ?? "" })
        : event.type === "crew_all_in"
          ? t("challengePulse.allIn", { crew: event.payload["crew_name"] ?? t("challengePulse.aCrew") })
          : event.type === "challenge_complete"
            ? t("challengePulse.complete", { name: challengeName })
            : t("challengePulse.surrender", { name });

  async function respect() {
    if (busy) return;
    setBusy(true);
    const { error } = await supabase.rpc("toggle_challenge_respect", { _event_id: event.id });
    setBusy(false);
    if (error) toast(t("common.error"));
    else await qc.invalidateQueries({ queryKey: ["challengeEvents"] });
  }

  return (
    <article className="flex items-center gap-3 rounded-[18px] bg-card p-3 sticker-border shadow-hard-sm">
      {event.user_id ? <Avatar id={event.user_id} name={name} url={event.avatar_url} size={42} /> : <span className="grid size-[42px] place-items-center rounded-full bg-yellow sticker-border"><Sparkles size={20} /></span>}
      <p className="min-w-0 flex-1 text-[14px] font-bold">{text}</p>
      <StickerButton
        variant={event.mine ? "lime" : "secondary"}
        size="sm"
        disabled={busy}
        aria-label={t("challengePulse.respect")}
        onClick={() => void respect()}
      >
        <Hand size={18} /><Num>{event.respects}</Num><span className="sr-only">{t("challengePulse.respectChallenge", { n: event.respects })}</span>
      </StickerButton>
    </article>
  );
}
