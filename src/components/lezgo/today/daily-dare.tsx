import { useTranslation } from "react-i18next";
import { ChaosIcon } from "@/components/icons";
import { Num, StickerButton } from "@/components/lezgo/ui";

export function DailyDare({ text, done, canSpin, busy, onSpin, onToggle }: { text: string; done: boolean; canSpin: boolean; busy: boolean; onSpin: () => void; onToggle: () => void }) {
  const { t } = useTranslation();
  return (
    <section className="daily-chaos">
      <ChaosIcon size={30} className="shrink-0" />
      <div className="chaos-copy"><h2>{t("todayDesign.chaosTitle")} · <Num>+10</Num></h2><p>{text}</p></div>
      <div className="chaos-actions">
        <StickerButton variant="secondary" className="chaos-spin" disabled={busy || !canSpin} title={canSpin ? t("todayDesign.spin") : t("todayDesign.spinLimit")} onClick={onSpin}>{t("todayDesign.spin")}</StickerButton>
        <StickerButton variant="ghost" className={`chaos-do ${done ? "is-done" : ""}`} aria-pressed={done} disabled={busy} onClick={onToggle}>{t(done ? "todayDesign.done" : "todayDesign.doIt")}</StickerButton>
      </div>
    </section>
  );
}
