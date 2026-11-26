import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppShell } from "../app-shell";
import { StickerButton } from "../ui";

/** Trail and Time capsule: the standard app shell (same width, padding and nav) plus a back button. */
export function SignatureFrame({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <AppShell todayLayout>
      <div className="signature-page">
        <Link to="/today" className="self-start">
          <StickerButton variant="secondary" className="icon-control" aria-label={t("common.back")}>
            <ArrowLeft className="rtl:-scale-x-100" />
          </StickerButton>
        </Link>
        {children}
      </div>
    </AppShell>
  );
}
