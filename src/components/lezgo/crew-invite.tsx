import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Copy, Share2 } from "lucide-react";
import { challengeLink } from "@/lib/batch6-data";
import { BottomSheet, Num, StickerButton } from "./ui";

const link = challengeLink;

/** Web Share when available, clipboard otherwise; a cancelled share is not an error. */
export async function shareInvite(code: string, t: TFunction) {
  const text = t("crew.inviteText", { code });
  try {
    if (navigator.share) await navigator.share({ text, url: link(code) });
    else {
      await navigator.clipboard.writeText(`${text} ${link(code)}`);
      toast(t("crew.copied"));
    }
  } catch {
    /* cancelled */
  }
}

export function ShareSheet({ code, open, onClose }: { code: string; open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <BottomSheet open={open} onClose={onClose} title={t("crew.shareTitle")}>
      <p className="text-[15px] font-semibold text-muted-foreground">{t("crew.shareBody")}</p>
      <div className="mt-3 rounded-[18px] bg-lime p-4 text-center sticker-border shadow-hard">
        <Num className="text-[40px] font-bold tracking-[0.25em]">{code}</Num>
        <p className="mt-1 break-all text-[14px] font-bold">
          <bdi dir="ltr">{link(code)}</bdi>
        </p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <StickerButton
          variant="secondary"
          onClick={async () => {
            await navigator.clipboard.writeText(link(code));
            toast(t("crew.copied"));
          }}
        >
          <Copy strokeWidth={2.5} className="size-5" />
          {t("crew.copy")}
        </StickerButton>
        <StickerButton onClick={() => void shareInvite(code, t)}>
          <Share2 strokeWidth={2.5} className="size-5" />
          {t("crew.shareBtn")}
        </StickerButton>
      </div>
    </BottomSheet>
  );
}

