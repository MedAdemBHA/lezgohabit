import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BottomSheet, StickerButton } from "@/components/lezgo/ui";
import { saveSurrenderRecap } from "@/lib/surrender-recap";

export function ChallengeSurrenderSheet({
  seasonId,
  name = "",
  open,
  onClose,
}: {
  seasonId: string;
  name?: string;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  async function surrender() {
    if (busy) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("surrender_challenge", { _season_id: seasonId });
    setBusy(false);
    if (error) {
      toast(t("common.error"));
      return;
    }
    // Keep the frozen result for the recap card shown once the challenge is gone from Today.
    const r = (data ?? {}) as { points?: number; completed_days?: number; perfect_days?: number; consistency?: number; trophy?: boolean };
    saveSurrenderRecap({
      season_id: seasonId,
      name,
      points: Number(r.points ?? 0),
      completed_days: Number(r.completed_days ?? 0),
      perfect_days: Number(r.perfect_days ?? 0),
      consistency: Number(r.consistency ?? 0),
      trophy: !!r.trophy,
    });
    await qc.invalidateQueries();
    toast(t("challengeHistory.surrenderedToast"));
    onClose();
  }
  return (
    <BottomSheet open={open} onClose={onClose} title={t("challengeHistory.surrenderTitle")}>
      <div className="space-y-4">
        <p className="font-bold">{t("challengeHistory.surrenderIntro")}</p>
        <section className="rounded-[18px] bg-lime p-4 sticker-border">
          <h3 className="font-extrabold">{t("challengeHistory.keepTitle")}</h3>
          <p className="mt-1 text-[14px] font-semibold">{t("challengeHistory.keepBody")}</p>
        </section>
        <section className="rounded-[18px] bg-card p-4 sticker-border">
          <h3 className="font-extrabold">{t("challengeHistory.endsTitle")}</h3>
          <p className="mt-1 text-[14px] font-semibold">{t("challengeHistory.endsBody")}</p>
        </section>
        <div className="flex gap-3">
          <StickerButton block variant="secondary" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </StickerButton>
          <StickerButton block variant="danger" onClick={() => void surrender()} disabled={busy}>
            {t(busy ? "common.loading" : "challengeHistory.surrender")}
          </StickerButton>
        </div>
      </div>
    </BottomSheet>
  );
}
