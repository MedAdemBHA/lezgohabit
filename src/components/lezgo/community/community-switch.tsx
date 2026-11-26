import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { StickerButton } from "../ui";

/** Pulse's one switch: the whole challenge, or my crew (crew today, activity, invites, crew posts). */
export function CommunitySwitch({ active }: { active: "challenge" | "crew" }) {
  const { t } = useTranslation();
  return (
    <div className="community-switch" role="navigation" aria-label={t("nav.pulse")}>
      {(["challenge", "crew"] as const).map((view) => (
        <Link key={view} to={view === "challenge" ? "/community" : "/crew"} aria-current={active === view ? "page" : undefined}>
          <StickerButton variant="ghost" tabIndex={-1} className={active === view ? "bg-ink text-lime" : "text-ink"}>
            {t(view === "challenge" ? "ux.pulseChallenge" : "ux.pulseCrew")}
          </StickerButton>
        </Link>
      ))}
    </div>
  );
}
