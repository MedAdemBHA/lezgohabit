import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Copy, Share2, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { challengeLink } from "@/lib/batch6-data";
import { BottomSheet, Num, StickerButton } from "../ui";
import { shareInvite } from "../crew-invite";

/** One-time flag per player and challenge: the invite step is shown once, then never again. */
export const firstInviteKey = (uid: string, seasonId: string) =>
  `lezgo_first_invite_${uid}_${seasonId}`;

export function shouldOfferFirstInvite(opts: {
  privateChallenge: boolean;
  alreadyShown: boolean;
  value: number;
}) {
  return !opts.privateChallenge && !opts.alreadyShown && opts.value > 0;
}

/**
 * After the first successful log in a shared challenge: "bring two friends", with the crew
 * code and the /c/<code> invite link. Skippable; without a crew it points to creating one.
 */
export function FirstInviteSheet({
  open,
  onClose,
  crewId,
}: {
  open: boolean;
  onClose: () => void;
  crewId: string | null;
}) {
  const { t } = useTranslation();
  const crew = useQuery({
    queryKey: ["crewCode", crewId],
    enabled: open && !!crewId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crews")
        .select("code")
        .eq("id", crewId!)
        .single();
      if (error) throw error;
      return data.code;
    },
  });
  const code = crew.data;
  return (
    <BottomSheet open={open} onClose={onClose} title={t("firstInvite.title")}>
      <div className="space-y-4">
        <p className="text-[15px] font-semibold">{t("firstInvite.body")}</p>
        {crewId && code ? (
          <>
            <div className="rounded-[18px] bg-lime p-4 text-center sticker-border shadow-hard">
              <Num className="text-[36px] font-bold tracking-[0.25em]">{code}</Num>
              <p className="mt-1 break-all text-[14px] font-bold">
                <bdi dir="ltr">{challengeLink(code)}</bdi>
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <StickerButton
                variant="secondary"
                onClick={async () => {
                  await navigator.clipboard.writeText(challengeLink(code));
                  toast(t("crew.copied"));
                }}
              >
                <Copy className="size-5" aria-hidden="true" />
                {t("crew.copy")}
              </StickerButton>
              <StickerButton onClick={() => void shareInvite(code, t)}>
                <Share2 className="size-5" aria-hidden="true" />
                {t("crew.shareBtn")}
              </StickerButton>
            </div>
          </>
        ) : !crewId ? (
          <Link to="/crew" onClick={onClose}>
            <StickerButton block>
              <UsersRound className="size-5" aria-hidden="true" />
              {t("firstInvite.makeCrew")}
            </StickerButton>
          </Link>
        ) : (
          <p role="status">{t("common.loading")}</p>
        )}
        <StickerButton block variant="ghost" onClick={onClose}>
          {t("firstInvite.skip")}
        </StickerButton>
      </div>
    </BottomSheet>
  );
}
