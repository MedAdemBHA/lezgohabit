import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { StickerButton } from "../ui";
export function CommunitySwitch({ active }: { active: "feed" | "crew" | "buddies" }) {
  const { t } = useTranslation();
  return (
    <div className="community-switch" role="navigation" aria-label={t("design.community")}>
      {(["feed", "crew", "buddies"] as const).map((view) => (
        <Link
          key={view}
          to={view === "feed" ? "/community" : view === "crew" ? "/crew" : "/buddies"}
          aria-current={active === view ? "page" : undefined}
        >
          <StickerButton
            variant="ghost"
            tabIndex={-1}
            className={active === view ? "bg-ink text-lime" : "text-ink"}
          >
            {view === "feed" ? t("nav.pulse") : t(`batch4.${view}`)}
          </StickerButton>
        </Link>
      ))}
    </div>
  );
}
