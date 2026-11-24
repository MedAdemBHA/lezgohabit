import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BottomSheet, StickerButton } from "@/components/lezgo/ui";

export function ChallengeSurrenderSheet({
  seasonId,
  open,
  onClose,
}: {
  seasonId: string;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  async function surrender() {
    if (busy) return;
    setBusy(true);
    const { error } = await supabase.rpc("surrender_challenge", { _season_id: seasonId });
    setBusy(false);
    if (error) {
      toast(t("common.error"));
      return;
    }
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
