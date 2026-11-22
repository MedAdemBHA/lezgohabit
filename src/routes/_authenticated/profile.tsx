import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Settings, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/lezgo/app-shell";
import { FlameIcon } from "@/components/lezgo/icons";
import { Avatar, Flag, Num, StickerButton, StickerCard } from "@/components/lezgo/ui";
import { scoresQuery, useBase } from "@/lib/data";
import { addDays, daysBetween } from "@/lib/time";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — lezgo" }, { name: "description", content: "Your season score, rank and trail." }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { t } = useTranslation();
  const { uid, profile, season, today } = useBase();
  const scores = useQuery({ ...scoresQuery(uid, season?.id ?? ""), enabled: !!uid && !!season });
  const rank = useQuery({ queryKey: ["myRank", season?.id], enabled: !!season, queryFn: async () => {
    const { data } = await supabase.rpc("leaderboard", { _season_id: season!.id, _scope: "world", _period: "season" });
    return (data as unknown as { me: { rank: number } | null })?.me?.rank ?? null; } });
  if (!profile || !season) return <AppShell>{null}</AppShell>;
  const list = scores.data ?? [];
  const total = list.reduce((s, x) => s + x.total, 0);
  const best = list.reduce((m, x) => Math.max(m, x.streak), 0);
  const byDay = new Map(list.map((s) => [s.day, s]));
  const len = daysBetween(season.starts_on, season.ends_on) + 1;

  return (
    <AppShell>
      <div className="flex items-center gap-4">
        <Avatar id={profile.id} name={profile.display_name} url={profile.avatar_url} size={80} className="shadow-hard" />
        <div className="min-w-0">
          <h1 className="truncate text-[28px] font-extrabold">{profile.display_name}</h1>
          <p className="flex items-center gap-2 text-[16px] font-bold text-muted-foreground"><bdi dir="ltr">@{profile.handle}</bdi><Flag code={profile.country_code} /></p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3">
        {[[t("profile.seasonScore"), total], [t("profile.rank"), rank.data ? `#${rank.data}` : "—"], [t("profile.bestStreak"), best]].map(([l, v], i) => (
          <StickerCard key={i} className="p-3">
            <p className="text-[12px] font-extrabold uppercase text-muted-foreground">{l}</p>
            <p className="mt-1 flex items-center gap-1 text-[24px] font-bold">{i === 2 && <FlameIcon size={20} />}<Num>{v}</Num></p>
          </StickerCard>
        ))}
      </div>
      <h2 className="mt-6 mb-2 text-[20px] font-extrabold">{t("profile.trail")}</h2>
      <StickerCard>
        <div className="grid grid-cols-8 gap-1.5">
          {Array.from({ length: len }, (_, i) => {
            const d = addDays(season.starts_on, i);
            const s = byDay.get(d);
            const isToday = d === today; const past = d < today;
            return <span key={d} title={d} className={cn("aspect-square rounded-[6px]",
              s && Number(s.completion) >= 0.6 ? "bg-lime sticker-border [border-width:1.5px]" : isToday ? "sticker-border bg-card" : past ? "dashed-ink [border-width:1.5px]" : "bg-muted")} />;
          })}
        </div>
      </StickerCard>
      <h2 className="mt-6 mb-2 text-[20px] font-extrabold">{t("profile.badges")}</h2>
      <StickerCard className="dashed-ink bg-transparent shadow-none"><p className="font-bold text-muted-foreground">{t("profile.badgesSoon")}</p></StickerCard>
      <div className="mt-6 space-y-3">
        <Link to="/settings" className="block"><StickerButton block variant="secondary"><Settings strokeWidth={2.5} className="size-5" />{t("common.settings")}</StickerButton></Link>
        {profile.is_admin && <Link to="/admin" className="block"><StickerButton block variant="secondary"><Shield strokeWidth={2.5} className="size-5" />{t("admin.title")}</StickerButton></Link>}
        <Link to="/today" className="block"><StickerButton block>{t("profile.next")}</StickerButton></Link>
      </div>
    </AppShell>
  );
}
