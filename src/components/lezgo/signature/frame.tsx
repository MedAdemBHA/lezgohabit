import { GuestChromeAuto } from "../guest";
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { StickerButton } from "../ui";
export function SignatureFrame({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <main className="signature-page">
      <GuestChromeAuto />
      <Link to="/today" className="self-start">
        <StickerButton variant="secondary" className="icon-control" aria-label={t("common.back")}>
          <ArrowLeft className="rtl:-scale-x-100" />
        </StickerButton>
      </Link>
      {children}
    </main>
  );
}
