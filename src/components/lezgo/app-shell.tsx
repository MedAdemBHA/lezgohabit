import { Link, useLocation } from "@tanstack/react-router";
import { useEffect, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { applyLang } from "@/lib/i18n";
import { useBase } from "@/lib/data";
import { LezgoMark } from "./brand";
import { Avatar } from "./ui";
import { TabIcon } from "@/components/icons/tab-icons";
import { AppStatus } from "./app-status";
import { OfflineStatus } from "./launch/offline-status";
import { BadgeSignals } from "./signature/moments";
import { GuestChrome } from "./guest";
import { FitHeading } from "./fit-heading";

export function AppShell({
  children,
  hideTabs,
  todayLayout = false,
  title,
  actions,
  back,
}: {
  children: ReactNode;
  hideTabs?: boolean;
  todayLayout?: boolean;
  title?: string;
  actions?: ReactNode;
  back?: "/today" | "/profile";
}) {
  const { t, i18n } = useTranslation();
  const { profile } = useBase();
  const loc = useLocation();
  const applied = useRef(false);
  useEffect(() => {
    if (profile && !applied.current) {
      applied.current = true;
      if (!profile.is_demo && profile.onboarded && profile.language !== i18n.language)
        applyLang(profile.language);
    }
  }, [profile, i18n.language]);

  const tabs = [
    { to: "/today" as const, label: t("nav.today"), kind: "today" as const },
    { to: "/community" as const, label: t("nav.pulse"), kind: "community" as const },
    { to: "/ranks" as const, label: t("nav.board"), kind: "ranks" as const },
    { to: "/profile" as const, label: t("nav.me"), kind: "profile" as const },
  ];
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[440px] flex-col bg-background">
      <GuestChrome active={!!profile?.is_demo} />
      {!title && <AppStatus profile={profile} hideBell={loc.pathname === "/today"} />}
      {profile && <OfflineStatus uid={profile.id} />}
      <BadgeSignals />
      {!todayLayout && !title && (
        <header className="sticky top-0 z-30 flex items-center justify-between bg-background/95 px-4 py-3 backdrop-blur">
          <Link to="/today" aria-label="lezgo">
            <LezgoMark size={40} />
          </Link>
          <Link
            to="/profile"
            aria-label={t("common.openProfile")}
            className="press rounded-full shadow-hard-sm"
          >
            {profile ? (
              <Avatar
                id={profile.id}
                name={profile.display_name}
                url={profile.avatar_url}
                size={44}
              />
            ) : (
              <span className="block size-11 rounded-full bg-muted sticker-border" />
            )}
          </Link>
        </header>
      )}
      <main
        className={cn(
          todayLayout || title ? "today-content" : "page-content",
          hideTabs && "no-tabs",
        )}
      >
        {title && (
          <header className="app-page-header">
            {back && (
              <Link to={back} className="app-icon-button" aria-label={t("common.back")}>
                <ArrowLeft size={20} className="rtl:-scale-x-100" aria-hidden="true" />
              </Link>
            )}
            <FitHeading text={title} className="app-page-title" requestedSize={36} />
            <div className="app-page-actions">
              {actions}
              <AppStatus profile={profile} />
            </div>
          </header>
        )}
        {children}
      </main>
      {!hideTabs && (
        <nav className="main-tab-wrap">
          <div className="main-tab-bar">
            {tabs.map(({ to, label, kind }) => {
              const mePaths = [
                "/profile",
                "/settings",
                "/boss",
                "/seasons",
                "/wrapped",
                "/trail",
                "/challenges",
                "/create-challenge",
                "/small-wins",
                "/admin",
                "/capsule",
                "/buddies",
              ];
              const pulsePaths = ["/crew"];
              // Lift is opened from the Train habit, so it stays under Today.
              const active =
                loc.pathname.startsWith(to) ||
                (to === "/today" && loc.pathname.startsWith("/lift")) ||
                (to === "/community" && pulsePaths.some((path) => loc.pathname.startsWith(path))) ||
                (to === "/profile" && mePaths.some((path) => loc.pathname.startsWith(path))) ||
                (to === "/ranks" && loc.pathname.startsWith("/scoring"));
              return (
                <Link
                  key={to}
                  to={to}
                  aria-current={active ? "page" : undefined}
                  className={cn("main-tab", active ? "bg-ink text-lime" : "text-ink")}
                >
                  <TabIcon kind={kind} /> <span className="max-w-full truncate">{label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}

export function NextStep({ children }: { children: ReactNode }) {
  return <div className="mt-6">{children}</div>;
}
