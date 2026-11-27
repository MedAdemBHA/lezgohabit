import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import { Num } from "@/components/lezgo/ui";

export function BonusSection({
  uid,
  seasonId,
  points,
  children,
}: {
  uid: string;
  seasonId: string;
  points?: number;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const key = `lezgo_bonus_open_${uid}_${seasonId}`;
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setOpen(localStorage.getItem(key) === "1");
    setReady(true);
  }, [key]);
  return (
    <details
      className="today-bonus"
      open={ready ? open : false}
      onToggle={(e) => {
        const next = e.currentTarget.open;
        setOpen(next);
        if (ready) localStorage.setItem(key, next ? "1" : "0");
      }}
    >
      <summary>
        <span>{t("appRefresh.moreToday")}</span>
        {!!points && (
          <Num>
            +{points} {t("common.pts")}
          </Num>
        )}
        <ChevronDown className="bonus-chevron" size={19} />
      </summary>
      <div className="today-bonus-content">{children}</div>
    </details>
  );
}

export function NewFeature({
  title,
  onDismiss,
  children,
}: {
  title: string;
  onDismiss: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <section className="today-new-feature">
      <div className="today-new-heading">
        <span>{t("todayDesign.newLabel")}</span>
        <strong>{title}</strong>
        <button type="button" onClick={onDismiss} aria-label={t("common.close")}>
          ×
        </button>
      </div>
      {children}
    </section>
  );
}
