import { Link, useHydrated } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, LogIn, Ticket } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { CatalogCard } from "@/lib/challenge-catalog";
import i18n, { formatDayMonth, loc, selectLang, type Lang } from "@/lib/i18n";
import { Brand } from "./brand";
import { DesignLanguage } from "./design-language";
import { HabitIcon } from "./habit-icon";
import { BottomSheet, Field, StickerButton, inputCls } from "./ui";

export function usePublicLanguage(requested?: Lang) {
  const { i18n: locale } = useTranslation();
  const hydrated = useHydrated();
  return requested ?? (hydrated ? selectLang(locale.language) : undefined) ?? "en";
}

export function PublicHeader({
  lang,
  onLanguage,
  onBrowse,
  signedIn,
}: {
  lang: Lang;
  onLanguage: (lang: Lang) => void;
  onBrowse?: () => void;
  /** true: show "Back to Today" instead of "Sign in"; undefined while the session is unknown. */
  signedIn?: boolean | undefined;
}) {
  const t = i18n.getFixedT(lang);
  return (
    <header className="public-header">
      <Link
        to="/"
        search={{ lang }}
        aria-label={t("landing.home")}
        className="shrink-0 rounded-lg"
        dir="ltr"
      >
        <Brand size={35} />
      </Link>
      <div className="flex items-center gap-1.5 sm:gap-3">
        <DesignLanguage lang={lang} onSelect={onLanguage} />
        {signedIn ? (
          <Link to="/today" className="public-sign-in">
            {t("ux.backToToday")}
          </Link>
        ) : (
          <Link to="/auth" className="public-sign-in">
            <LogIn className="hidden size-4 rtl:rotate-180 sm:block" aria-hidden="true" />
            {t("auth.signIn")}
          </Link>
        )}
      </div>
      <nav aria-label={t("landing.navigation")} className="public-nav">
        <Link to="/start" search={{ lang }} className="public-nav-link" onClick={onBrowse}>
          {t("landing.browse")}
        </Link>
        <Link
          to="/"
          search={{ lang }}
          hash="how-it-works"
          className="public-nav-link"
          activeOptions={{ includeHash: true }}
        >
          {t("landing.how")}
        </Link>
      </nav>
    </header>
  );
}

export function InviteCodeButton({
  lang,
  onSubmit,
}: {
  lang: Lang;
  onSubmit: (code: string) => void;
}) {
  const t = i18n.getFixedT(lang);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  return (
    <>
      <button
        type="button"
        className="public-action public-action-secondary"
        onClick={() => setOpen(true)}
      >
        <Ticket className="size-5" aria-hidden="true" /> {t("landing.haveCode")}
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title={t("landing.codeTitle")}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (code.length !== 6) return;
            setOpen(false);
            onSubmit(code);
          }}
        >
          <Field label={t("landing.codeHint")}>
            <input
              dir="ltr"
              autoFocus
              value={code}
              maxLength={6}
              autoCapitalize="characters"
              autoComplete="off"
              placeholder="ABC123"
              onChange={(event) =>
                setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
              }
              className={`${inputCls} num text-center text-[24px] tracking-[0.25em]`}
            />
          </Field>
          <StickerButton block type="submit" disabled={code.length !== 6}>
            {t("common.next")} <ArrowRight className="size-5 rtl:rotate-180" aria-hidden="true" />
          </StickerButton>
        </form>
      </BottomSheet>
    </>
  );
}

export function ChallengeDates({ card, lang }: { card: CatalogCard; lang: Lang }) {
  return (
    <span className="public-dates">
      <CalendarDays className="size-4 shrink-0" aria-hidden="true" />
      <span>
        <time dateTime={card.starts_on}>{formatDayMonth(card.starts_on, lang)}</time> –{" "}
        <time dateTime={card.ends_on}>{formatDayMonth(card.ends_on, lang)}</time>
      </span>
    </span>
  );
}

export function ChallengeHabits({ card, lang }: { card: CatalogCard; lang: Lang }) {
  if (!card.habits.length) return null;
  const t = i18n.getFixedT(lang);
  return (
    <div className="public-habits">
      <p className="public-caption">{t("landing.dailyHabits")}</p>
      <ul>
        {card.habits.map((habit) => {
          const detail = loc(habit.what_counts, lang);
          return (
            <li key={habit.key}>
              <span className="public-habit-icon" aria-hidden="true">
                <HabitIcon name={habit.key} className="size-5" />
              </span>
              <div>
                <p className="font-extrabold">{loc(habit.name, lang)}</p>
                {detail && <p className="text-sm text-design-muted">{detail}</p>}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
