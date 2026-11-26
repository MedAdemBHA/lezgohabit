import { infiniteQueryOptions, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { Compose } from "./compose";
import { PostCard } from "./post-card";
import { StickerButton } from "../ui";
import { fetchFeed } from "@/lib/feed-data";
import { moderationAccess } from "@/lib/event-data";

const crewPostsOptions = (uid: string, sid: string) =>
  infiniteQueryOptions({
    queryKey: ["feed", uid, sid, "crew", "all", "pages"],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => fetchFeed(sid, "crew", "all", pageParam),
    getNextPageParam: (last) => (last.length === 20 ? last.at(-1)?.created_at : undefined),
    staleTime: 15_000,
  });

/** Crew-only posts, shown under My crew so the crew feed lives with the rest of the crew. */
export function CrewPosts({ uid, seasonId, startsOn, crewId }: { uid: string; seasonId: string; startsOn: string; crewId: string }) {
  const { t } = useTranslation();
  const [compose, setCompose] = useState(false);
  const posts = useInfiniteQuery({ ...crewPostsOptions(uid, seasonId), enabled: !!uid && !!seasonId });
  const scope = { season: seasonId, crew: crewId };
  const mod = useQuery({ ...moderationAccess(scope, uid), enabled: !!uid && !!seasonId });
  const rows = posts.data?.pages.flat() ?? [];
  return (
    <section className="mt-6 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[20px] font-extrabold">{t("challengePulse.crewPosts")}</h2>
        <StickerButton variant="lime" size="sm" aria-label={t("batch4.newPost")} onClick={() => setCompose(true)}>
          <Plus size={20} />
          {t("challengePulse.shareProof")}
        </StickerButton>
      </div>
      {rows.map((post) => (
        <PostCard key={post.id} post={post} uid={uid} start={startsOn} season={seasonId} reportCrew={crewId} moderation={mod.data ? scope : undefined} />
      ))}
      {!rows.length && !posts.isPending && (
        <p className="rounded-[18px] bg-card p-4 text-center text-[14px] font-semibold sticker-border">{t("challengePulse.emptyPosts")}</p>
      )}
      {posts.hasNextPage && (
        <StickerButton block variant="secondary" disabled={posts.isFetchingNextPage} onClick={() => void posts.fetchNextPage()}>
          {t(posts.isFetchingNextPage ? "common.loading" : "batch4.loadMore")}
        </StickerButton>
      )}
      <Compose open={compose} onClose={() => setCompose(false)} initialAudience="crew" />
    </section>
  );
}
