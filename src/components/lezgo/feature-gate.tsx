import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { featureFlagsQuery } from "@/lib/admin-data";
import { AppShell } from "./app-shell";
import { StickerButton } from "./ui";
export function FeatureGate({ feature, children }: { feature: string; children: ReactNode }) {
  const { t } = useTranslation();
  const flags = useQuery(featureFlagsQuery);
  if (flags.data?.[feature] !== false) return children;
  return (
    <AppShell>
      <div className="flex flex-col items-center gap-5 py-14">
        <Lock size={44} />
        <p className="text-center text-[22px] font-extrabold">{t("batch7.featureDisabled")}</p>
        <Link to="/today">
          <StickerButton>{t("batch7.back")}</StickerButton>
        </Link>
      </div>
    </AppShell>
  );
}
