import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

/** Pulse's one switch: the whole challenge, or my crew (crew today, activity, invites, crew posts). */
export function CommunitySwitch({ active }: { active: "challenge" | "crew" }) {
  const { t } = useTranslation();
  return (
    <div className="community-switch" role="navigation" aria-label={t("nav.pulse")}>
      {(["challenge", "crew"] as const).map((view) => (
        <Link
          key={view}
          to={view === "challenge" ? "/community" : "/crew"}
          aria-current={active === view ? "page" : undefined}
          activeOptions={{ exact: true }}
        >
          {t(view === "challenge" ? "ux.pulseChallenge" : "ux.pulseCrew")}
        </Link>
      ))}
    </div>
  );
}
