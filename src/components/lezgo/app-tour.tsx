import * as Dialog from "@radix-ui/react-dialog";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Check,
  Compass,
  Flame,
  RefreshCw,
  Share2,
  X,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { TabIcon } from "@/components/icons/tab-icons";
import { pickCaption, type WinKey } from "@/lib/batch6-rules";
import { countryName } from "@/lib/community-data";
import { unitLabel } from "@/lib/habits";
import { formatNumber } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { HabitIcon } from "./habit-icon";
import { Avatar, StickerButton } from "./ui";

const steps = [
  { key: "today", label: "nav.today", to: "/today", color: "lime" },
  { key: "feed", label: "nav.pulse", to: "/community", color: "yellow" },
  { key: "board", label: "nav.board", to: "/ranks", color: "blue" },
  { key: "profile", label: "nav.me", to: "/profile", color: "pink" },
  { key: "wins", label: "batch6.winTitle", to: "/small-wins", color: "purple" },
] as const;

const habits = [
  { key: "train", icon: "train", label: "tour.trainHabit" },
  { key: "read", icon: "read", label: "tour.readHabit" },
] as const;

type PracticeHabit = (typeof habits)[number]["key"];

export function AppTourButton({
  preview = false,
  className,
}: {
  preview?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <StickerButton
          variant={preview ? "secondary" : "ghost"}
          size="sm"
          className={cn("app-tour-trigger", className)}
        >
          <Compass size={19} aria-hidden="true" />
          {t("tour.start")}
        </StickerButton>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="app-tour-overlay" />
        <Dialog.Content className="app-tour" onOpenAutoFocus={(event) => event.preventDefault()}>
          <TourContent preview={preview} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function TourContent({ preview }: { preview: boolean }) {
  const { t, i18n } = useTranslation();
  const [index, setIndex] = useState(0);
  const [logged, setLogged] = useState<PracticeHabit[]>([]);
  const title = useRef<HTMLHeadingElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const step = steps[index] ?? steps[0];
  const last = index === steps.length - 1;
  const screen = t(step.label);

  useEffect(() => {
    if (body.current) body.current.scrollTop = 0;
    title.current?.focus({ preventScroll: true });
  }, [index]);

  return (
    <>
      <header className="app-tour-header">
        <div>
          <p className="app-tour-name">{t("tour.title")}</p>
          <p className="app-tour-count">
            {t("tour.position", {
              current: formatNumber(index + 1, i18n.language),
              total: formatNumber(steps.length, i18n.language),
            })}
          </p>
        </div>
        <Dialog.Close asChild>
          <StickerButton
            variant="secondary"
            className="app-tour-close"
            aria-label={t("common.close")}
          >
            <X size={20} aria-hidden="true" />
          </StickerButton>
        </Dialog.Close>
      </header>
      <div className="app-tour-steps" aria-hidden="true">
        {steps.map(({ key }, i) => (
          <span key={key} data-reached={i <= index} />
        ))}
      </div>
      <div className="app-tour-body" ref={body}>
        <Dialog.Title ref={title} className="app-tour-title" tabIndex={-1}>
          {t(`tour.${step.key}Title`)}
        </Dialog.Title>
        <Dialog.Description className="app-tour-description">
          {t(`tour.${step.key}Body`)}
        </Dialog.Description>
        <section className="app-tour-preview" data-color={step.color} aria-label={t("tour.sample")}>
          <div className="app-tour-preview-head">
            <span className="app-tour-screen">
              {step.key === "wins" ? (
                <Share2 size={18} aria-hidden="true" />
              ) : (
                <TabIcon
                  kind={
                    step.key === "feed" ? "community" : step.key === "board" ? "ranks" : step.key
                  }
                  size={20}
                />
              )}
              {screen}
            </span>
            <span className="app-tour-sample">{t("tour.sample")}</span>
          </div>
          {step.key === "today" && (
            <TodayExample
              logged={logged}
              onToggle={(key) =>
                setLogged((previous) =>
                  previous.includes(key)
                    ? previous.filter((habit) => habit !== key)
                    : [...previous, key],
                )
              }
            />
          )}
          {step.key === "feed" && <FeedExample />}
          {step.key === "board" && <BoardExample />}
          {step.key === "profile" && <ProfileExample />}
          {step.key === "wins" && <WinsExample read={logged.includes("read")} />}
        </section>
        {!preview && (
          <Dialog.Close asChild>
            <Link to={step.to} className="app-tour-screen-link">
              {t("tour.openScreen", { screen })}
              <ArrowRight size={16} className="rtl:-scale-x-100" aria-hidden="true" />
            </Link>
          </Dialog.Close>
        )}
      </div>
      <footer className="app-tour-footer">
        {index > 0 && (
          <StickerButton variant="secondary" size="sm" onClick={() => setIndex(index - 1)}>
            <ArrowLeft size={17} className="rtl:-scale-x-100" aria-hidden="true" />
            {t("common.back")}
          </StickerButton>
        )}
        {last ? (
          <Dialog.Close asChild>
            <StickerButton variant="lime" size="sm">
              {t("tour.finish")}
              <Check size={18} aria-hidden="true" />
            </StickerButton>
          </Dialog.Close>
        ) : (
          <StickerButton variant="lime" size="sm" onClick={() => setIndex(index + 1)}>
            {t("tour.next")}
            <ArrowRight size={17} className="rtl:-scale-x-100" aria-hidden="true" />
          </StickerButton>
        )}
      </footer>
    </>
  );
}

function TodayExample({
  logged,
  onToggle,
}: {
  logged: PracticeHabit[];
  onToggle: (habit: PracticeHabit) => void;
}) {
  const { t, i18n } = useTranslation();
  const [showTarget, setShowTarget] = useState(false);
  const readButton = useRef<HTMLButtonElement>(null);
  const targetId = useId();
  return (
    <>
      <p className="app-tour-meter-label" role="status">
        {t("ux.habitsDone", {
          done: formatNumber(logged.length, i18n.language),
          total: formatNumber(habits.length, i18n.language),
        })}
      </p>
      <div className="app-tour-meter" aria-hidden="true">
        {habits.map(({ key }) => (
          <span key={key} data-done={logged.includes(key)} />
        ))}
      </div>
      {habits.map(({ key, icon, label }) => {
        const done = logged.includes(key);
        const isRead = key === "read";
        return (
          <button
            key={key}
            ref={isRead ? readButton : undefined}
            type="button"
            aria-pressed={isRead ? undefined : done}
            aria-expanded={isRead ? showTarget : undefined}
            aria-controls={isRead ? targetId : undefined}
            className="app-tour-habit"
            data-done={done}
            onClick={() => (isRead ? setShowTarget(!showTarget) : onToggle(key))}
          >
            <HabitIcon habitKey={key} name={icon} />
            <span>{t(label)}</span>
            <span className="app-tour-habit-action" aria-hidden="true">
              {done ? <Check size={16} /> : null}
              {t(done ? "tour.logged" : "tour.log")}
            </span>
          </button>
        );
      })}
      <div id={targetId} hidden={!showTarget}>
        <StickerButton
          variant="secondary"
          size="sm"
          block
          className="app-tour-inline-action"
          onClick={() => {
            onToggle("read");
            setShowTarget(false);
            readButton.current?.focus();
          }}
        >
          {logged.includes("read")
            ? t("todayDesign.undo")
            : t("ux.doneTarget", {
                target: formatNumber(10, i18n.language),
                unit: unitLabel(t, "pages"),
              })}
        </StickerButton>
      </div>
    </>
  );
}

function FeedExample() {
  const { t } = useTranslation();
  const [crew, setCrew] = useState(false);
  const name = crew ? "Sami" : "Nour";
  return (
    <>
      <div className="app-tour-switch" role="group" aria-label={t("nav.pulse")}>
        <button type="button" aria-pressed={!crew} onClick={() => setCrew(false)}>
          {t("ux.pulseChallenge")}
        </button>
        <button type="button" aria-pressed={crew} onClick={() => setCrew(true)}>
          {t("ux.pulseCrew")}
        </button>
      </div>
      <div className="app-tour-post" aria-live="polite">
        <Avatar id={name} name={name} size={32} />
        <div>
          <strong>
            <bdi>{name}</bdi>
          </strong>
          <p>{t(crew ? "tour.crewPost" : "tour.challengePost")}</p>
        </div>
      </div>
    </>
  );
}

function BoardExample() {
  const { t, i18n } = useTranslation();
  const [country, setCountry] = useState(false);
  const rows = country ? ["Nour", "Sami"] : ["Maya", "Nour"];
  return (
    <>
      <div className="app-tour-switch" role="group" aria-label={t("nav.board")}>
        <button type="button" aria-pressed={!country} onClick={() => setCountry(false)}>
          {t("challengePulse.challengeTab")}
        </button>
        <button type="button" aria-pressed={country} onClick={() => setCountry(true)}>
          {countryName("TN", i18n.language)}
        </button>
      </div>
      <ol className="app-tour-board" aria-live="polite">
        {rows.map((name, i) => (
          <li key={name}>
            <span className="app-tour-rank num">{formatNumber(i + 1, i18n.language)}</span>
            <bdi>{name}</bdi>
          </li>
        ))}
      </ol>
    </>
  );
}

function ProfileExample() {
  const { t, i18n } = useTranslation();
  const [inbox, setInbox] = useState(false);
  const id = useId();
  return (
    <>
      <div className="app-tour-profile">
        <Avatar id="Nour" name="Nour" size={42} />
        <div>
          <bdi>Nour</bdi>
          <p>
            <Flame size={15} aria-hidden="true" />
            {t("socialDesign.streakStat", { n: formatNumber(3, i18n.language) })}
          </p>
        </div>
        <button
          className="app-tour-bell"
          type="button"
          aria-label={t("batch7.inbox")}
          aria-expanded={inbox}
          aria-controls={id}
          onClick={() => setInbox(!inbox)}
        >
          <Bell size={20} aria-hidden="true" />
        </button>
      </div>
      <p id={id} className="app-tour-nudge" hidden={!inbox}>
        {t("tour.sampleNudge")}
      </p>
    </>
  );
}

function WinsExample({ read }: { read: boolean }) {
  const { t } = useTranslation();
  const [caption, setCaption] = useState(0);
  const wins: WinKey[] = read ? ["read"] : ["water"];
  const words = pickCaption(
    wins,
    t("batch6.winCaptions", { returnObjects: true }) as Partial<Record<WinKey, string[]>>,
    t("batch6.captions", { returnObjects: true }) as string[],
    "lezgo-tour",
    caption,
  );
  return (
    <>
      <div className="app-tour-win" aria-live="polite">
        <strong>{t(read ? "batch6.read" : "batch6.water")}</strong>
        <q>{words}</q>
      </div>
      <StickerButton
        variant="secondary"
        size="sm"
        className="app-tour-inline-action"
        onClick={() => setCaption(caption + 1)}
      >
        <RefreshCw size={16} aria-hidden="true" />
        {t("batch6.newCaption")}
      </StickerButton>
    </>
  );
}
