import { ManageCommunity } from "@/components/lezgo/community/moderation";
import { BuddyIcon, FirstGoIcon, PerfectIcon, WinsIcon } from "@/components/icons/feature-icons";
import { StickerLoading } from "@/components/lezgo/launch/loading";
import { pageHead } from "@/lib/page-head";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Settings, Upload, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Compose } from "@/components/lezgo/community/compose";
import { AppShell } from "@/components/lezgo/app-shell";
import { AppTourButton } from "@/components/lezgo/app-tour";
import { StreakIcon, SalatIcon, BossIcon, NoSugarIcon } from "@/components/icons";
import { Avatar, BottomSheet, Num, StickerButton } from "@/components/lezgo/ui";
import { FittedLabel } from "@/components/lezgo/fitted-label";
import { useHabitStatLabel } from "@/components/lezgo/habit-stat";
import { habitsQuery, scoresQuery, useBase } from "@/lib/data";
import { useFeature } from "@/lib/features";
import { buddyQuery, countryName, countryWhere, summaryQuery } from "@/lib/community-data";
import { challengePulseQuery } from "@/lib/feed-data";
import { COUNTRY_RANK_MIN_PLAYERS } from "@/lib/challenge-plan";
import { BADGE_KEYS, trailState } from "@/lib/community-rules";
import { challengeHistoryQuery, joinedDay, resultsFinal } from "@/lib/challenge-history";
import { localHour, useNow } from "@/lib/time";
import { addDays, daysBetween } from "@/lib/time";
import { formatNumber, loc } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { bossQuery, rolesQuery, challengeLink } from "@/lib/batch6-data";
export const Route = createFileRoute("/_authenticated/profile")({
  head: () =>
    pageHead(
      "Your profile · lezgo",
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
      return <FirstGoIcon size={30} />;
    case "streak7":
      return <StreakIcon size={30} />;
    case "boss_ko":
      return <BossIcon size={30} />;
    case "salat5":
      return <SalatIcon size={30} />;
    case "sugar7":
      return <NoSugarIcon size={30} />;
    case "perfect5":
      return <PerfectIcon size={30} />;
  }
}
function ProfilePage() {
  const { t, i18n } = useTranslation();
  const { uid, profile, season, today, tz, loading } = useBase();
  const joinHistory = useQuery({ ...challengeHistoryQuery(uid), enabled: !!uid && !!season });
  const joinEntry = joinHistory.data?.find((entry) => entry.season_id === season?.id);
  const joinedOn = joinEntry ? joinedDay(joinEntry.joined_at, tz) : null;
  const now = useNow(60_000);
  const roles = useQuery({ ...rolesQuery(uid), enabled: !!uid });
  const creatorDashboard = useQuery({
    queryKey: ["creatorDashboard", uid],
    enabled: !!uid && (!!roles.data?.includes("creator") || !!profile?.is_admin),
    retry: false,
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
  const liftOn = useFeature("lift");
  const bossOn = useFeature("bosses");
  const buddiesOn = useFeature("buddies");
  const buddy = useQuery({
    ...buddyQuery(uid, season?.id ?? ""),
    enabled: !!uid && !!season && buddiesOn,
  });
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
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(challengeLink(challenge.code));
                toast(t("crew.copied"));
              } catch {
                toast.error(t("common.error"));
              }
            }}
          >
            {t("batch6.copy")}: <bdi dir="ltr">{challenge.code}</bdi>
          </StickerButton>
          <div className="mt-2">
            <ManageCommunity season={challenge.season_id} />
          </div>
        </article>
      ))}
      {creatorDashboard.isPending && <p role="status">{t("common.loading")}</p>}
      {creatorDashboard.isError && (
        <div className="space-y-2">
          <p role="alert">{t("common.error")}</p>
          <StickerButton
            size="sm"
            variant="secondary"
            onClick={() => void creatorDashboard.refetch()}
          >
            {t("common.retry")}
          </StickerButton>
        </div>
      )}
      {creatorDashboard.isSuccess && !creatorDashboard.data.length && (
        <p className="text-[14px] font-semibold text-muted-foreground">
          {t("batch6.noCreatorChallenges")}
        </p>
      )}
    </section>
  );

  if (loading)
    return (
      <AppShell todayLayout>
        <StickerLoading />
      </AppShell>
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
        {(liftOn || bossOn) && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            {liftOn && (
              <Link to="/lift">
                <StickerButton block variant="secondary">
                  {t("design.lift")}
                </StickerButton>
              </Link>
            )}
            {bossOn && (
              <Link to="/boss">
                <StickerButton block variant="secondary">
                  {t("design.boss")}
                </StickerButton>
              </Link>
            )}
          </div>
        )}
        <AppTourButton className="self-start" />
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
  const stats = [
    { key: "points", value: data?.points, label: t("socialDesign.seasonPts") },
    {
      key: "country",
      value: data?.rank && countryReady ? `#${formatNumber(data.rank, i18n.language)}` : undefined,
      label: t("socialDesign.rankLabel", {
        country,
        where: countryWhere(profile.country_code, i18n.language),
      }),
    },
    { key: "habit", value: data?.stat?.value, label: statLabel },
  ];
  return (
    <AppShell
      title={t("nav.me")}
      actions={
        <>
          <button
            type="button"
            className="app-icon-button"
            aria-label={t("socialDesign.share")}
            onClick={() => setShare(true)}
          >
            <Upload size={20} aria-hidden="true" />
          </button>
          <Link to="/settings" className="app-icon-button" aria-label={t("common.settings")}>
            <Settings size={20} aria-hidden="true" />
          </Link>
        </>
      }
    >
      <section className="profile-pass">
        <div className="profile-header">
          <Avatar
            id={profile.id}
            name={profile.display_name}
            url={profile.avatar_url}
            size={68}
            className="profile-portrait"
          />
          <div className="min-w-0 flex-1">
            <h2 className="profile-name">{profile.display_name}</h2>
            <p className="profile-byline">
              <bdi dir="ltr">@{profile.handle}</bdi>
            </p>
            <p className="profile-byline">{[profile.city, country].filter(Boolean).join(", ")}</p>
          </div>
        </div>
        <div className="profile-pass-meta">
          <span>
            <StreakIcon size={18} />
            {t("socialDesign.streakStat", { n: formatNumber(data?.streak ?? 0, i18n.language) })}
          </span>
          {data?.crew && (
            <Link to="/crew-details">
              {data.crew.name}
              <ChevronRight size={15} className="rtl:-scale-x-100" aria-hidden="true" />
            </Link>
          )}
        </div>
        {q.isError ? (
          <StickerButton variant="secondary" size="sm" onClick={() => void q.refetch()}>
            {t("common.retry")}
          </StickerButton>
        ) : (
          <dl className="profile-pass-stats">
            {stats.map(({ key, value, label }) => (
              <div key={key} className="profile-stat">
                <dt>
                  <FittedLabel className="stat-label" text={label} />
                </dt>
                <dd>
                  <Num className="stat-value">
                    {typeof value === "number"
                      ? formatNumber(value, i18n.language)
                      : (value ?? "—")}
                  </Num>
                </dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <section className="app-surface profile-journey">
        <Link
          to="/challenges"
          search={{ season: season.id }}
          className="app-row-link profile-season-link"
        >
          <span>
            <small>{t("ux.currentChallenge")}</small>
            <strong>{loc(season.name, i18n.language)}</strong>
          </span>
          <span className="profile-day-label">
            <Num>
              {day}/{length}
            </Num>
            <ChevronRight size={18} className="rtl:-scale-x-100" aria-hidden="true" />
          </span>
        </Link>
        <Link
          to="/trail"
          search={{ season: season.id }}
          className="profile-trail"
          aria-label={t("batch8.viewTrail")}
        >
          <span className="app-row-link">
            <strong>{t("profile.trail")}</strong>
            <ChevronRight size={18} className="rtl:-scale-x-100" aria-hidden="true" />
          </span>
          <span className="season-trail" aria-hidden="true">
            {Array.from({ length }, (_, i) => {
              const d = addDays(season.starts_on, i);
              const score = byDay.get(d);
              const state = trailState(
                d,
                today,
                score
                  ? { completion: Number(score.completion), shield_used: score.shield_used }
                  : undefined,
                joinedOn,
              );
              return (
                <span
                  key={d}
                  className="season-square"
                  data-state={state}
                  data-final={!!score?.finalized_at}
                  title={score?.finalized_at ? `${d} · ${t("integrity.final")}` : d}
                />
              );
            })}
          </span>
        </Link>
      </section>

      <Link
        to="/small-wins"
        search={{ from: "profile" }}
        className="app-surface app-row-link profile-wins-link"
      >
        <WinsIcon className="profile-win-icon" size={26} />
        <span>
          <strong>{t("batch6.winTitle")}</strong>
          <small>{t("appRefresh.shareWin")}</small>
        </span>
        <ChevronRight size={20} className="rtl:-scale-x-100" aria-hidden="true" />
      </Link>

      {buddiesOn && (
        <Link to="/buddies" className="app-surface app-row-link profile-wins-link profile-buddy-link">
          <BuddyIcon className="profile-win-icon" size={26} />
          <span>
            <strong>{buddy.data?.buddy?.display_name ?? t("socialDesign.findBuddy")}</strong>
            <small>{t(buddy.data?.buddy ? "batch5.myBuddy" : "socialDesign.findBuddySub")}</small>
          </span>
          <ChevronRight size={20} className="rtl:-scale-x-100" aria-hidden="true" />
        </Link>
      )}

      <details className="app-disclosure profile-badges">
        <summary>
          {t("profile.badges")}
          <Num>
            {visibleBadges.filter((badge) => data?.badges.includes(badge)).length}/
            {visibleBadges.length}
          </Num>
          <ChevronDown size={20} aria-hidden="true" />
        </summary>
        <div className="grid grid-cols-3 gap-2 p-3 pt-0">
          {visibleBadges.map((badge) => {
            const earned = data?.badges.includes(badge);
            return (
              <StickerButton
                key={badge}
                variant="ghost"
                className={cn(
                  "badge-tile",
                  earned ? `${COLORS[badge]} sticker-border` : "badge-locked shadow-none",
                )}
                aria-label={`${t(`socialDesign.${badge}`)} · ${t(earned ? "socialDesign.earned" : "socialDesign.locked")}`}
                onClick={() => setSelectedBadge(badge)}
              >
                <BadgeIcon badge={badge} />
                <span>{t(`socialDesign.${badge}`)}</span>
              </StickerButton>
            );
          })}
        </div>
      </details>
      <details className="app-disclosure">
        <summary>
          {t("appRefresh.profileTools")}
          <ChevronDown size={20} aria-hidden="true" />
        </summary>
        <div className="profile-tools">
          <Link to="/lights-out">{t("ux.closeMyDay")}</Link>
          <Link to="/challenges" search={{ season: "" }}>
            {t("challengeHistory.title")}
          </Link>
          {joinEntry && now && resultsFinal(joinEntry.end_date, today, localHour(tz, now)) && (
            <Link to="/wrapped" search={{ season: season.id }}>
              {t("batch6.wrapped")}
            </Link>
          )}
          <Link to="/create-challenge">{t("batch6.create")}</Link>
          {liftOn && <Link to="/lift">{t("design.lift")}</Link>}
          {bossOn && <Link to="/boss">{t("design.boss")}</Link>}
          <AppTourButton />
          {creatorPanel}
          {profile.is_admin && <Link to="/admin">{t("admin.title")}</Link>}
        </div>
      </details>
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
