import { moderationAccess } from "@/lib/event-data";
import { createFileRoute, Link } from "@tanstack/react-router";
import { infiniteQueryOptions, useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/lezgo/app-shell";
import { ChallengeEventCard } from "@/components/lezgo/community/challenge-event-card";
import { Compose } from "@/components/lezgo/community/compose";
import { PostCard } from "@/components/lezgo/community/post-card";
import { FitHeading } from "@/components/lezgo/fit-heading";
import { Avatar, StickerButton } from "@/components/lezgo/ui";
import { CommunitySwitch } from "@/components/lezgo/community/community-switch";
import { useBase } from "@/lib/data";
import { rolesQuery } from "@/lib/batch6-data";
import { challengeEventsQuery, challengePulseQuery, fetchFeed } from "@/lib/feed-data";
import { challengeHistoryQuery } from "@/lib/challenge-history";
import { loc } from "@/lib/i18n";
import { pageHead } from "@/lib/page-head";
import { supabase } from "@/integrations/supabase/client";

type Scope = "crew" | "challenge";
function postsOptions(uid: string, sid: string, scope: Scope) {
  return infiniteQueryOptions({
    queryKey: ["feed", uid, sid, scope, "all", "pages"],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => fetchFeed(sid, scope, "all", pageParam),
    getNextPageParam: (last) => (last.length === 20 ? last.at(-1)?.created_at : undefined),
    staleTime: 15_000,
  });
}

export const Route = createFileRoute("/_authenticated/community")({
  head: () => pageHead("Challenge pulse — lezgo", "A quiet pulse of check-ins and wins from your challenge."),
  component: Community,
});

function Community() {
  const { t, i18n } = useTranslation();
  const { uid, season, profile } = useBase();
  const sid = season?.id ?? "";
  const qc = useQueryClient();
  // Crew posts live under My crew now; this screen is the whole challenge.
  const scope: Scope = "challenge";
  const [compose, setCompose] = useState(false);
  const [nudging, setNudging] = useState("");
  const history = useQuery({ ...challengeHistoryQuery(uid), enabled: !!uid && !season });
  const lastCompleted = !season ? history.data?.find((entry) => entry.status === "completed") : undefined;
  const completedEvents = useQuery({
    ...challengeEventsQuery(uid, lastCompleted?.season_id ?? "", "challenge"),
    enabled: !!uid && !!lastCompleted,
  });
  const posts = useInfiniteQuery({ ...postsOptions(uid, sid, scope), enabled: !!uid && !!sid });
  const pulse = useQuery({ ...challengePulseQuery(uid, sid), enabled: !!uid && !!sid });
  const events = useQuery({ ...challengeEventsQuery(uid, sid, scope), enabled: !!uid && !!sid });
  const roles = useQuery({ ...rolesQuery(uid), enabled: !!uid });
  const challenge = useQuery({
    queryKey: ["challengeOwner", sid],
    enabled: !!sid,
    queryFn: async () => {
      const { data, error } = await supabase.from("challenges").select("owner_id,audience").eq("season_id", sid).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const crewScope: string | undefined = undefined;
  const modScope = { season: sid, crew: crewScope };
  const modAccess = useQuery({
    ...moderationAccess(modScope, uid), enabled: !!uid && !!sid,
  });
  const rows = posts.data?.pages.flat() ?? [];
  const momentRows = events.data ?? [];
  const challengeName = loc(season?.name, i18n.language) || t("challengePulse.challenge");
  const canPin = !!profile?.is_admin || (roles.data?.includes("creator") === true && challenge.data?.audience === "creator" && challenge.data.owner_id === uid);

  async function nudge(userId: string, name: string) {
    if (nudging) return;
    setNudging(userId);
    const { error } = await supabase.rpc("send_nudge", { _to_user: userId });
    setNudging("");
    if (error) toast(t("common.error"));
    else {
      toast(t("crew.nudgeToast", { name }));
      await qc.invalidateQueries({ queryKey: ["challengePulse", uid, sid] });
    }
  }

  if (!season) {
    return (
      <AppShell todayLayout>
        <FitHeading className="feed-title" requestedSize={42} text={t("challengePulse.title")} />
        {lastCompleted ? <>
          <p className="font-semibold">{t("challengePulse.lastComplete", { name: lastCompleted.name })}</p>
          {(completedEvents.data ?? []).map((event) => <ChallengeEventCard key={event.id} event={event} challengeName={lastCompleted.name} />)}
          <Link to="/challenges" search={{ season: lastCompleted.season_id }}><StickerButton block variant="secondary">{t("challengeHistory.details")}</StickerButton></Link>
        </> : <p className="font-semibold">{t("challengePulse.noChallenge")}</p>}
        <Link to="/start"><StickerButton block variant="lime">{t("challengeHistory.pickNext")}</StickerButton></Link>
      </AppShell>
    );
  }

  return (
    <AppShell todayLayout>
      <header className="space-y-3">
        <CommunitySwitch active="challenge" />
        <FitHeading className="feed-title" requestedSize={42} text={challengeName} />
      </header>

      <section className="rounded-[20px] bg-yellow p-4 sticker-border shadow-hard-lg" aria-label={t("challengePulse.title")}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[12px] font-extrabold uppercase tracking-wide">{t("challengePulse.today")}</p>
            <p className="text-[16px] font-extrabold">{t("challengePulse.checkedIn", { done: pulse.data?.checked_in ?? 0, total: pulse.data?.participants ?? 0 })}</p>
          </div>
          <Users size={26} aria-hidden />
        </div>
        <progress className="mt-3 block h-3 w-full accent-ink" value={pulse.data?.checked_in ?? 0} max={Math.max(1, pulse.data?.participants ?? 0)} />
        <div className="mt-3 flex flex-wrap gap-2">
          {(pulse.data?.crew ?? []).map((member) => (
            member.checked_in || member.id === uid ? (
              <span key={member.id} className="flex min-h-11 items-center gap-2 rounded-full bg-card px-2 py-1 sticker-border" title={member.name}>
                <Avatar id={member.id} name={member.name} url={member.avatar_url} size={32} />
                <span className="max-w-24 truncate text-[12px] font-bold">{member.name}</span>
              </span>
            ) : (
              <button
                key={member.id}
                type="button"
                className="flex min-h-11 items-center gap-2 rounded-full bg-card px-2 py-1 text-start sticker-border press"
                disabled={!!nudging}
                aria-label={t("challengePulse.nudge", { name: member.name })}
                onClick={() => void nudge(member.id, member.name)}
              >
                <Avatar id={member.id} name={member.name} url={member.avatar_url} size={32} />
                <span className="max-w-24 truncate text-[12px] font-bold">{member.name}</span>
              </button>
            )
          ))}
          {pulse.data && !pulse.data.crew.length && <Link to="/crew"><StickerButton size="sm" variant="secondary">{t("challengePulse.findCrew")}</StickerButton></Link>}
        </div>
      </section>

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[18px] font-extrabold">{t("challengePulse.moments")}</h2>
        <StickerButton variant="lime" size="sm" aria-label={t("batch4.newPost")} onClick={() => setCompose(true)}><Plus size={20} />{t("challengePulse.shareProof")}</StickerButton>
      </div>
      {momentRows.map((event) => <ChallengeEventCard key={event.id} event={event} challengeName={challengeName} />)}
      {!momentRows.length && <p className="rounded-[18px] bg-card p-3 text-[14px] font-semibold sticker-border">{t("challengePulse.emptyMoments")}</p>}

      <h2 className="text-[18px] font-extrabold">{t("challengePulse.challengePosts")}</h2>
      {rows.map((post) => <PostCard key={post.id} post={post} uid={uid} start={season.starts_on} season={sid} canPin={canPin && post.visibility === "everyone"}
        reportCrew={crewScope} moderation={modAccess.data ? modScope : undefined} />)}
      {!rows.length && <div className="rounded-[18px] bg-card p-4 text-center text-[14px] font-semibold sticker-border">{t("challengePulse.emptyPosts")}</div>}
      {posts.hasNextPage && <StickerButton block variant="secondary" disabled={posts.isFetchingNextPage} onClick={() => void posts.fetchNextPage()}>{t(posts.isFetchingNextPage ? "common.loading" : "batch4.loadMore")}</StickerButton>}
      <Compose open={compose} onClose={() => setCompose(false)} initialAudience="everyone" />
    </AppShell>
  );
}
