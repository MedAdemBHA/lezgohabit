import { useTranslation } from "react-i18next";
import { BottomSheet } from "./ui";
import type { ScoringVersion } from "@/lib/scoring-version";

/** Today's "how points work" sheet; explains the rule of the season being played. */
export function ScoringSheet({
  open,
  onClose,
  version = 1,
}: {
  open: boolean;
  onClose: () => void;
  version?: ScoringVersion;
}) {
  const { t } = useTranslation();
  const keys =
    version === 2
      ? (["scoreRuleV2", "scoreShield"] as const)
      : (["scoreHabits", "scoreStacks", "scoreStreak", "scoreShield", "scoreTotal"] as const);
  return (
    <BottomSheet open={open} onClose={onClose} title={t("socialDesign.scoringTitle")}>
      <div className="space-y-4 text-[15px] font-semibold">
        {keys.map((key) => (
          <p key={key}>{t(`socialDesign.${key}`)}</p>
        ))}
      </div>
    </BottomSheet>
  );
}
