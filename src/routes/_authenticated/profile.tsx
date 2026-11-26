import { ManageCommunity } from "@/components/lezgo/community/moderation";
import { pageHead } from "@/lib/page-head";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Settings, Upload, ChevronRight, CheckCircle2, Star } from "lucide-react";
import { toast } from "sonner";
import { Compose } from "@/components/lezgo/community/compose";
import { AppShell } from "@/components/lezgo/app-shell";
import { StreakIcon, SalatIcon, BossIcon, NoSugarIcon } from "@/components/icons";
import { Avatar, BottomSheet, Num, StickerButton } from "@/components/lezgo/ui";
import { FittedLabel } from "@/components/lezgo/fitted-label";
import { useHabitStatLabel } from "@/components/lezgo/habit-stat";
import { habitsQuery, scoresQuery, useBase } from "@/lib/data";
import { buddyQuery, countryName, summaryQuery } from "@/lib/community-data";
import { challengePulseQuery } from "@/lib/feed-data";
import { COUNTRY_RANK_MIN_PLAYERS } from "@/lib/challenge-plan";
import { BADGE_KEYS, trailState } from "@/lib/community-rules";
import { addDays, daysBetween } from "@/lib/time";
import { loc } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { bossQuery, rolesQuery, challengeLink } from "@/lib/batch6-data";
export const Route = createFileRoute("/_authenticated/profile")({
  head: () =>
    pageHead(
      "Your profile — lezgo",
      "Your earned badges, season trail, crew and best habit results.",
    ),
  component: ProfilePage,
});
const COLORS = {
  first_go: "bg-lime",
  streak7: "bg-yellow",
  boss_ko: "bg-pink",
  salat5: "bg-teal",
  sugar7: "bg-pink",
  perfect5: "bg-yellow",
};
function BadgeIcon({ badge }: { badge: (typeof BADGE_KEYS)[number] }) {
  switch (badge) {
    case "first_go":
      return <CheckCircle2 size={30} strokeWidth={2.5} />;
    case "streak7":
      return <StreakIcon size={30} />;
    case "boss_ko":
      return <BossIcon size={30} />;
    case "salat5":
      return <SalatIcon size={30} />;
    case "sugar7":
      return <NoSugarIcon size={30} />;
    case "perfect5":
      return <Star size={30} strokeWidth={2.5} />;
  }
}
function ProfilePage() {
  const { t, i18n } = useTranslation();
  const { uid, profile, season, today } = useBase();
  const roles = useQuery({ ...rolesQuery(uid), enabled: !!uid });
  const creatorDashboard = useQuery({
    queryKey: ["creatorDashboard", uid],
    enabled: !!uid && (!!roles.data?.includes("creator") || !!profile?.is_admin),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("creator_dashboard");
      if (error) throw error;
      return data as unknown as {
        id: string;
        season_id: string;
        name: string;
        code: string;
        days: number;
        starts_on: string;
        ends_on: string;
        participants: number;
        surrenders: number;
        checked_in: number;
        checkin_percent: number;
        url: string;
      }[];
    },
  });
  const [share, setShare] = useState(false);
  const [winOpen, setWinOpen] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState<(typeof BADGE_KEYS)[number] | null>(null);
  const scores = useQuery({ ...scoresQuery(uid, season?.id ?? ""), enabled: !!uid && !!season });
  const q = useQuery({ ...summaryQuery(uid, season?.id ?? ""), enabled: !!uid && !!season });
  const pulse = useQuery({
    ...challengePulseQuery(uid, season?.id ?? ""),
    enabled: !!uid && !!season,
  });
  const countryReady = (pulse.data?.participants ?? 0) >= COUNTRY_RANK_MIN_PLAYERS;
  // Only badges this challenge can award (plus anything already earned) — no "Sugar-free week"
  // in a challenge without a sugar habit.
  const myHabits = useQuery({ ...habitsQuery(uid, season?.id ?? ""), enabled: !!uid && !!season });
  const boss = useQuery({ ...bossQuery(uid, season?.id ?? ""), enabled: !!uid && !!season });
  const habitKeys = new Set(
    (myHabits.data ?? []).map((h) => (h.kind === "salat" ? "salat" : (h.template?.key ?? ""))),
  );
  const achievable: Record<(typeof BADGE_KEYS)[number], boolean> = {
    first_go: true,
    streak7: true,
    perfect5: true,
    salat5: habitKeys.has("salat"),
    sugar7: habitKeys.has("no_sugar") || habitKeys.has("sugar_free_coffee"),
    boss_ko: !!boss.data?.boss || (boss.data?.next.length ?? 0) > 0,
  };
  const visibleBadges = BADGE_KEYS.filter((b) => achievable[b] || q.data?.badges.includes(b));
  const shareQ = useQuery({
    ...summaryQuery(uid, season?.id ?? "", true),
    enabled: !!uid && !!season && share,
  });
  const buddy = useQuery({ ...buddyQuery(uid, season?.id ?? ""), enabled: !!uid && !!season });
  const statLabel = useHabitStatLabel(q.data?.stat);
  const shareStat = useHabitStatLabel(shareQ.data?.stat);
  if (!profile)
    return (
      <AppShell todayLayout>
        <p>{t("common.loading")}</p>
      </AppShell>
    );
  const creatorPanel = (roles.data?.includes("creator") || !!profile?.is_admin) && (
    <section className="sticker mt-3 rounded-[20px] bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[18px] font-extrabold">{t("batch6.creatorDashboard")}</h2>
        <Link to="/create-challenge">
          <StickerButton size="sm" variant="lime">
            {t("batch6.create")}
          </StickerButton>
        </Link>
      </div>
      {creatorDashboard.data?.map((challenge) => (
        <article
          key={challenge.id}
          className="mb-3 rounded-[16px] bg-background p-3 sticker-border"
        >
          <h3 className="truncate font-extrabold">{challenge.name}</h3>
          <p className="text-[13px] font-semibold">
            {t("batch6.days", { n: challenge.days })} · {challenge.starts_on} — {challenge.ends_on}
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
            <span>
              <Num>{challenge.participants}</Num>
              <small className="block">{t("batch6.participants")}</small>
            </span>
            <span>
              <Num>{challenge.checkin_percent}%</Num>
              <small className="block">{t("batch6.checkedInToday")}</small>
            </span>
            <span>
              <Num>{challenge.surrenders}</Num>
              <small className="block">{t("batch6.surrenders")}</small>
            </span>
          </div>
          <StickerButton
            size="sm"
            variant="secondary"
            className="mt-2 w-full"
            onClick={() =>
              void navigator.clipboard
                .writeText(challengeLink(challenge.code))
                .then(() => toast(t("crew.copied")))
            }
          >
            {t("batch6.copy")}: <bdi dir="ltr">{challenge.code}</bdi>
          </StickerButton>
          <div className="mt-2">
            <ManageCommunity season={challenge.season_id} />
          </div>
        </article>
      ))}
      {!creatorDashboard.data?.length && (
        <p className="text-[14px] font-semibold text-muted-foreground">
          {t("batch6.noCreatorChallenges")}
        </p>
      )}
    </section>
  );

  if (!season)
    return (
      <AppShell todayLayout>
        <div className="flex items-center justify-between">
          <Link to="/today">
            <StickerButton variant="secondary" className="habit-back" aria-label={t("common.back")}>
              <ArrowLeft size={22} className="rtl:-scale-x-100" />
            </StickerButton>
          </Link>
          <Link to="/settings">
            <StickerButton
              variant="secondary"
              className="habit-back"
              aria-label={t("common.settings")}
            >
              <Settings size={22} />
            </StickerButton>
          </Link>
        </div>
        <div className="profile-header mt-3">
          <Avatar
            id={profile.id}
            name={profile.display_name}
            url={profile.avatar_url}
            size={84}
            className="border-[3px] bg-yellow text-[40px]"
          />
          <div className="min-w-0 flex-1">
            <h1 className="profile-name">{profile.display_name}</h1>
            <p className="text-[16px] font-semibold text-design-muted">
              <bdi dir="ltr">@{profile.handle}</bdi>
            </p>
          </div>
        </div>
        <h2 className="mt-4 text-[22px] font-extrabold">{t("challengeHistory.title")}</h2>
        <p className="text-[15px] font-semibold">{t("challengeHistory.noActive")}</p>
        <Link to="/challenges" search={{ season: "" }} className="mt-3 block">
          <StickerButton block variant="lime">
            {t("challengeHistory.openHistory")}
          </StickerButton>
        </Link>
        <Link to="/start" className="mt-3 block">
          <StickerButton block variant="secondary">
            {t("challengeHistory.pickNext")}
          </StickerButton>
        </Link>
        <Link to="/create-challenge" className="mt-3 block">
          <StickerButton block variant="secondary">
            {t("batch6.create")}
          </StickerButton>
        </Link>
        {creatorPanel}
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Link to="/lift">
            <StickerButton block variant="secondary">
              {t("design.lift")}
            </StickerButton>
          </Link>
          <Link to="/boss">
            <StickerButton block variant="secondary">
              {t("design.boss")}
            </StickerButton>
          </Link>
        </div>
      </AppShell>
    );
  const data = q.data;
  const byDay = new Map((scores.data ?? []).map((s) => [s.day, s]));
  const length = daysBetween(season.starts_on, season.ends_on) + 1;
  const day = Math.min(length, Math.max(1, daysBetween(season.starts_on, today) + 1));
  const country = countryName(profile.country_code, i18n.language);
  async function shareCard() {
    const info = shareQ.data;
    if (!info) return;
    const text = t("socialDesign.shareText", {
      name: profile?.display_name,
      points: info.points,
      streak: info.streak,
    });
    try {
      if (navigator.share)
        await navigator.share({ title: "lezgo", text, url: window.location.origin });
      else {
        await navigator.clipboard.writeText(`${text} ${window.location.origin}`);
        toast(t("crew.copied"));
      }
    } catch {
      /* cancelled */
    }
  }
  return (
    <AppShell todayLayout>
      <div className="flex items-center justify-between">
        <Link to="/today">
          <StickerButton variant="secondary" className="habit-back" aria-label={t("common.back")}>
            <ArrowLeft size={22} className="rtl:-scale-x-100" />
          </StickerButton>
        </Link>
        <div className="flex items-center gap-2">
          <Link to="/settings">
            <StickerButton
              variant="secondary"
              className="habit-back"
              aria-label={t("common.settings")}
            >
              <Settings size={22} />
            </StickerButton>
          </Link>
          <StickerButton
            variant="lime"
            size="sm"
            className="profile-share-button rounded-[14px] text-[16px]"
            onClick={() => setShare(true)}
          >
            <Upload size={18} />
            {t("socialDesign.share")}
          </StickerButton>
        </div>
      </div>
      <div className="profile-header mt-2">
        <div className="relative shrink-0">
          <Avatar
            id={profile.id}
            name={profile.display_name}
            url={profile.avatar_url}
            size={84}
            className="border-[3px] bg-yellow text-[40px]"
          />
          <span className="absolute -bottom-1 -end-1 flex items-center gap-1 rounded-[8px] bg-orange px-1.5 py-0.5 sticker-border">
            <Num className="text-[13px] font-bold">{data?.streak ?? 0}</Num>
            <StreakIcon size={16} />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="profile-name">{profile.display_name}</h1>
          <p className="text-[16px] font-semibold text-design-muted">
            <bdi dir="ltr">@{profile.handle}</bdi>
          </p>
          <p className="mt-1 text-[16px] font-bold">
            {[profile.city, country].filter(Boolean).join(", ")}
          </p>
          {data?.crew && (
            <Link
              to="/crew-details"
              className="mt-2 inline-flex max-w-full items-center rounded-full bg-card px-3 py-1 text-[15px] font-extrabold sticker-border"
            >
              <span className="truncate">{data.crew.name}</span>
            </Link>
          )}
        </div>
      </div>
      {q.isError ? (
        <StickerButton variant="secondary" onClick={() => void q.refetch()}>
          {t("common.error")}
        </StickerButton>
      ) : (
        <div className="mt-3 grid grid-cols-3 gap-3">
          {[
            { value: data?.points ?? "—", label: t("socialDesign.seasonPts") },
            {
              value: data?.rank && countryReady ? `#${data.rank}` : "—",
              label: t("socialDesign.countryRank", { rank: "", country }).replace(/^#\s*/, ""),
            },
            { value: data?.stat?.value ?? 0, label: statLabel },
          ].map((s, i) => (
            <div key={i} className="profile-stat bg-card sticker-border shadow-hard-lg">
              <Num className="stat-value">{s.value}</Num>
              <FittedLabel className="stat-label" text={s.label} />
            </div>
          ))}
        </div>
      )}
      <h2 className="mt-3 text-[13px] font-extrabold">{t("ux.currentChallenge")}</h2>
      <Link
        to="/seasons"
        className="flex items-center gap-3 rounded-[20px] bg-blue px-[18px] py-[14px] sticker-border shadow-hard-lg"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[18px] font-extrabold">
            {loc(season.name, i18n.language)} · {t("common.season1")}
          </span>
          <span className="block text-[15px] font-bold">
            {t("socialDesign.inProgress", { day, total: length })}
          </span>
        </span>
        <ChevronRight className="shrink-0 rtl:-scale-x-100" />
      </Link>
      <Link
        to="/trail"
        search={{ season: season.id }}
        className="mt-2 block"
        aria-label={t("batch8.viewTrail")}
      >
        <h2 className="mb-2 text-[13px] font-extrabold">{t("profile.trail")}</h2>
        <div className="season-trail">
          {Array.from({ length }, (_, i) => {
            const d = addDays(season.starts_on, i);
            const s = byDay.get(d);
            const state = trailState(
              d,
              today,
              s ? { completion: Number(s.completion), shield_used: s.shield_used } : undefined,
            );
            return (
              <span
                key={d}
                title={s?.finalized_at ? `${d} · ${t("integrity.final")}` : d}
                data-final={!!s?.finalized_at}
                data-state={state}
                className={cn(
                  "season-square",
                  state === "shield"
                    ? "bg-blue"
                    : state === "done"
                      ? "bg-lime"
                      : state === "today"
                        ? "bg-card"
                        : "bg-transparent",
                )}
              />
            );
          })}
        </div>
      </Link>
      <Link to="/lights-out" className="mt-3 block">
        <StickerButton block variant="secondary">
          {t("ux.closeMyDay")}
        </StickerButton>
      </Link>
      <Link to="/challenges" search={{ season: "" }} className="mt-3 block">
        <StickerButton block variant="secondary">
          {t("challengeHistory.title")}
        </StickerButton>
      </Link>
      <div className="mt-3 flex items-center justify-between">
        <h2 className="text-[13px] font-extrabold">
          {t("profile.badges").toLocaleUpperCase(i18n.language === "aeb" ? "ar" : i18n.language)}
        </h2>
        <Num className="text-[13px] font-bold">
          {visibleBadges.filter((b) => data?.badges.includes(b)).length}/{visibleBadges.length}
        </Num>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {visibleBadges.map((b) => {
          const earned = data?.badges.includes(b);
          return (
            <StickerButton
              key={b}
              variant="ghost"
              className={cn(
                "badge-tile",
                earned ? `${COLORS[b]} sticker-border shadow-hard` : "badge-locked shadow-none",
              )}
              aria-label={`${t(`socialDesign.${b}`)} · ${t(earned ? "socialDesign.earned" : "socialDesign.locked")}`}
              onClick={() => setSelectedBadge(b)}
            >
              <BadgeIcon badge={b} />
              <span>{t(`socialDesign.${b}`)}</span>
            </StickerButton>
          );
        })}
      </div>
      <h2 className="mt-4 text-[13px] font-extrabold">{t("ux.more")}</h2>
      <Link to="/create-challenge">
        <StickerButton block variant="lime">
          {t("batch6.create")}
        </StickerButton>
      </Link>
      <Link to="/wrapped" search={{ season: season.id }}>
        <StickerButton block variant="secondary">
          {t("batch6.wrapped")}
        </StickerButton>
      </Link>
      <Link to="/small-wins">
        <StickerButton block variant="secondary">
          {t("batch6.winTitle")}
        </StickerButton>
      </Link>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Link to="/lift">
          <StickerButton block variant="secondary">
            {t("design.lift")}
          </StickerButton>
        </Link>
        <Link to="/boss">
          <StickerButton block variant="secondary">
            {t("design.boss")}
          </StickerButton>
        </Link>
      </div>
      <Link
        to="/buddies"
        className="mt-2 flex items-center gap-3 rounded-[20px] bg-card px-[18px] py-4 dashed-ink"
      >
        {buddy.data?.buddy && (
          <Avatar
            id={buddy.data.buddy.user_id}
            name={buddy.data.buddy.display_name}
            url={buddy.data.buddy.avatar_url}
            size={40}
          />
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-[18px] font-extrabold">
            {buddy.data?.buddy?.display_name ?? t("socialDesign.noBuddy")}
          </span>
          <span className="block text-[14px] font-semibold">
            {buddy.data?.buddy
              ? t("socialDesign.streakStat", { n: buddy.data.buddy.streak })
              : t("socialDesign.findBuddySub")}
          </span>
        </span>
        <ChevronRight className="shrink-0 rtl:-scale-x-100" />
      </Link>
      {creatorPanel}
      {profile.is_admin && (
        <Link to="/admin">
          <StickerButton block variant="secondary">
            {t("admin.title")}
          </StickerButton>
        </Link>
      )}
      <BottomSheet
        open={!!selectedBadge}
        onClose={() => setSelectedBadge(null)}
        title={selectedBadge ? t(`socialDesign.${selectedBadge}`) : ""}
      >
        <p className="font-bold">
          {t(
            data?.badges.includes(selectedBadge ?? "")
              ? "socialDesign.earned"
              : "socialDesign.locked",
          )}
        </p>
      </BottomSheet>
      <BottomSheet
        open={share}
        onClose={() => setShare(false)}
        title={t("socialDesign.shareProfile")}
      >
        <div className="rounded-[20px] bg-yellow p-5 sticker-border shadow-hard-lg">
          <div className="flex items-center gap-4">
            <Avatar
              id={profile.id}
              name={profile.display_name}
              url={profile.avatar_url}
              size={64}
            />
            <div>
              <p className="text-[24px] font-extrabold">{profile.display_name}</p>
              <bdi dir="ltr">@{profile.handle}</bdi>
            </div>
          </div>
          <p className="mt-4 text-[28px] font-extrabold">
            <Num>{shareQ.data?.points ?? "—"}</Num> {t("socialDesign.seasonPts")}
          </p>
          <p className="font-bold">
            {t("socialDesign.streakStat", { n: shareQ.data?.streak ?? 0 })}
          </p>
          {shareQ.data?.stat && (
            <p className="mt-2">
              {t("socialDesign.habitStat", { value: shareQ.data.stat.value, name: shareStat })}
            </p>
          )}
          <div className="mt-3 flex gap-3">
            {BADGE_KEYS.filter((b) => shareQ.data?.badges.includes(b)).map((b) => (
              <span key={b} title={t(`socialDesign.${b}`)}>
                <BadgeIcon badge={b} />
              </span>
            ))}
          </div>
        </div>
        <p className="my-4 text-[13px] font-semibold">{t("socialDesign.privateShare")}</p>
        <StickerButton
          block
          variant="lime"
          className="mb-3"
          disabled={!shareQ.data}
          onClick={() => {
            setShare(false);
            setWinOpen(true);
          }}
        >
          {t("batch4.shareWin")}
        </StickerButton>
        <StickerButton block disabled={!shareQ.data} onClick={() => void shareCard()}>
          <Upload size={20} />
          {t("socialDesign.share")}
        </StickerButton>
      </BottomSheet>
      <Compose
        open={winOpen}
        onClose={() => setWinOpen(false)}
        initialType="win"
        initialBody={t("socialDesign.shareText", {
          name: profile.display_name,
          points: data?.points ?? 0,
          streak: data?.streak ?? 0,
        })}
      />
    </AppShell>
  );
}


