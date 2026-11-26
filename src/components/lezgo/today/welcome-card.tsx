import { useTranslation } from "react-i18next";
import type { ChallengePlan } from "@/lib/challenge-plan";
import { numberLocale } from "@/lib/i18n";

/** First-day card: what's left, what a good day is, and whether the trophy is still possible. */
export function WelcomeCard({
  name,
  plan,
  habits,
  onDismiss,
}: {
  name: string;
  plan: ChallengePlan & { goodHabits: number };
  habits: number;
  onDismiss: () => void;
}) {
  const { t, i18n } = useTranslation();
  const fmt = new Intl.NumberFormat(numberLocale(i18n.language));
  return (
    <section className="today-new-feature today-welcome" aria-labelledby="today-welcome-title">
      <div className="today-new-heading">
        <strong id="today-welcome-title">{t("ux.welcomeTitle", { name })}</strong>
        <button type="button" onClick={onDismiss} aria-label={t("common.close")}>
          ×
        </button>
      </div>
      <p className="font-semibold">
        {t("ux.welcomeLeft", { left: fmt.format(plan.left) })}{" "}
        {habits > 0 &&
          t("ux.welcomeGood", { x: fmt.format(plan.goodHabits), y: fmt.format(habits) })}
      </p>
      <p className="font-semibold">
        {t(plan.reachable ? "ux.welcomeTrophy" : "ux.welcomeNoTrophy", {
          need: fmt.format(plan.need),
        })}
      </p>
    </section>
  );
}
