import { Link, useLocation } from "@tanstack/react-router";
import { useEffect, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { applyLang } from "@/lib/i18n";
import { useBase } from "@/lib/data";
import { LezgoMark } from "./brand";
import { Avatar } from "./ui";
import { CrewIcon, RanksIcon, TodayIcon } from "./icons";

export function AppShell({ children, hideTabs }: { children: ReactNode; hideTabs?: boolean }) {
  const { t, i18n } = useTranslation();
  const { profile } = useBase();
  const loc = useLocation();
  const applied = useRef(false);
  useEffect(() => {
    if (profile && !applied.current) { applied.current = true; if (profile.language !== i18n.language) applyLang(profile.language); }
  }, [profile, i18n.language]);

  const tabs = [
    { to: "/today" as const, label: t("common.today"), Icon: TodayIcon },
    { to: "/ranks" as const, label: t("common.ranks"), Icon: RanksIcon },
    { to: "/crew" as const, label: t("common.crew"), Icon: CrewIcon },
  ];
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[440px] flex-col bg-background">
      <header className="sticky top-0 z-30 flex items-center justify-between bg-background/95 px-4 py-3 backdrop-blur">
        <Link to="/today" aria-label="lezgo"><LezgoMark size={40} /></Link>
        <Link to="/profile" aria-label={t("common.openProfile")} className="press rounded-full shadow-hard-sm">
          {profile ? <Avatar id={profile.id} name={profile.display_name} url={profile.avatar_url} size={44} /> : <span className="block size-11 rounded-full bg-muted sticker-border" />}
        </Link>
      </header>
      <main className={cn("flex-1 px-4", hideTabs ? "pb-8" : "pb-28")}>{children}</main>
      {!hideTabs && (
        <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[440px] px-4 pb-[max(12px,env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-around rounded-[22px] bg-card p-1.5 sticker-border shadow-hard">
            {tabs.map(({ to, label, Icon }) => {
              const active = loc.pathname.startsWith(to);
              return (
                <Link key={to} to={to} className={cn("flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-[16px] text-[15px] font-extrabold transition-colors",
                  active ? "bg-lime sticker-border" : "text-muted-foreground")}>
                  <Icon size={22} /> <span className={cn(!active && "sr-only sm:not-sr-only")}>{label}</span>
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
