import { Link, useLocation } from "@tanstack/react-router";
import { useEffect, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { applyLang } from "@/lib/i18n";
import { useBase } from "@/lib/data";
import { LezgoMark } from "./brand";
import { Avatar } from "./ui";
import { RanksIcon, TodayIcon } from "./icons";
import { CrewIcon, TrainIcon, BossIcon } from "@/components/icons";

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
    { to: "/lift" as const, label: t("design.lift"), Icon: TrainIcon },
    { to: "/ranks" as const, label: t("common.ranks"), Icon: RanksIcon },
    { to: "/boss" as const, label: t("design.boss"), Icon: BossIcon },
    { to: "/community" as const, label: t("design.community"), Icon: CrewIcon },
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
              const active = loc.pathname.startsWith(to) || (to === "/community" && loc.pathname.startsWith("/crew"));
              return (
                <Link key={to} to={to} aria-current={active ? "page" : undefined} className={cn("flex min-h-[56px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-[16px] text-[10px] font-extrabold transition-colors",
                  active ? "bg-ink text-lime" : "text-muted-foreground")}>
                  <Icon size={22} /> <span className="max-w-full truncate">{label}</span>
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
