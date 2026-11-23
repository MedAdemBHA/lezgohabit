import { createFileRoute, Link } from "@tanstack/react-router";
import { infiniteQueryOptions, useSuspenseInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Smartphone } from "lucide-react";
import { ThoughtIcon } from "@/components/icons";
import { AppShell } from "@/components/lezgo/app-shell";
import { StickerButton } from "@/components/lezgo/ui";
import { FitHeading } from "@/components/lezgo/fit-heading";
import { CommunitySwitch } from "@/components/lezgo/community/community-switch";
import { Compose } from "@/components/lezgo/community/compose";
import { PostCard } from "@/components/lezgo/community/post-card";
import { fetchFeed } from "@/lib/feed-data";
import { useBase, seasonQuery, habitsQuery } from "@/lib/data";
import { loc } from "@/lib/i18n";
import { pageHead } from "@/lib/page-head";
function postsOptions(uid: string, sid: string, scope = "everyone", filter = "all") {
  return infiniteQueryOptions({
    queryKey: ["feed", uid, sid, scope, filter, "pages"],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => fetchFeed(sid, scope, filter, pageParam),
    getNextPageParam: (last) => (last.length === 20 ? last.at(-1)?.created_at : undefined),
    staleTime: 15_000,
  });
}
export const Route = createFileRoute("/_authenticated/community")({
  head: () =>
    pageHead("Proof feed — lezgo", "Daily proof, thoughts and wins from your crew and community."),
  loader: async ({ context }) => {
    const season = await context.queryClient.ensureQueryData(seasonQuery);
    if (season)
      await context.queryClient.ensureInfiniteQueryData(postsOptions(context.user.id, season.id));
  },
  component: Community,
});
function Community() {
  const { t, i18n } = useTranslation();
  const { uid, season } = useBase();
  const [scope, setScope] = useState("everyone");
  const [filter, setFilter] = useState("all");
  const [compose, setCompose] = useState(false);
  const posts = useSuspenseInfiniteQuery(postsOptions(uid, season?.id ?? "", scope, filter));
  const habits = useQuery({ ...habitsQuery(uid, season?.id ?? ""), enabled: !!uid && !!season });
  const rows = posts.data.pages.flat();
  const filters = new Map<string, string>();
  for (const h of habits.data ?? [])
    if (h.template && !h.template.is_faith)
      filters.set(h.template.key, loc(h.template.name, i18n.language));
  for (const p of rows) if (p.habit_key) filters.set(p.habit_key, loc(p.habit_name, i18n.language));
  return (
    <AppShell todayLayout>
      <CommunitySwitch active="feed" />
      <Link to="/detox" className="self-end">
        <StickerButton variant="secondary" size="sm"><Smartphone size={18}/>{t('batch5.detox')}</StickerButton>
      </Link>
      <div className="feed-header">
        <FitHeading className="feed-title" requestedSize={56} text={t("batch4.feedTitle")} />
        <StickerButton
          variant="lime"
          className="feed-add"
          aria-label={t("batch4.newPost")}
          onClick={() => setCompose(true)}
        >
          <Plus size={32} strokeWidth={3} />
        </StickerButton>
      </div>
      <div className="feed-filters">
        {[["all", t("batch4.all")], ...Array.from(filters), ["thought", t("batch4.thoughts")]].map(
          ([key, name]) =>
            key && (
              <StickerButton
                key={key}
                size="sm"
                variant="secondary"
                className={`feed-chip ${key === filter ? "bg-ink text-lime shadow-none" : ""}`}
                aria-pressed={key === filter}
                onClick={() => setFilter(key)}
              >
                {name}
              </StickerButton>
            ),
        )}
      </div>
      <div className="feed-scopes">
        {(["everyone", "crew", "country"] as const).map((s) => (
          <StickerButton
            size="sm"
            variant="ghost"
            key={s}
            aria-pressed={scope === s}
            className={scope === s ? "bg-ink text-lime" : "text-ink"}
            onClick={() => setScope(s)}
          >
            {s === "country"
              ? t("ranks.tunisia")
              : t(s === "crew" ? "batch4.myCrew" : "batch4.everyone")}
          </StickerButton>
        ))}
      </div>
      {rows.map((p) => (
        <PostCard key={p.id} post={p} uid={uid} start={season?.starts_on ?? p.day} />
      ))}
      {!rows.length && (
        <div className="flex flex-col items-center gap-4 py-12">
          <ThoughtIcon size={64} />
          <p className="font-bold">{t("batch4.feedEmpty")}</p>
          <StickerButton variant="lime" onClick={() => setCompose(true)}>
            <Plus size={22} />
            {t("batch4.newPost")}
          </StickerButton>
        </div>
      )}
      {posts.hasNextPage && (
        <StickerButton
          variant="secondary"
          disabled={posts.isFetchingNextPage}
          onClick={() => void posts.fetchNextPage()}
        >
          {t(posts.isFetchingNextPage ? "common.loading" : "batch4.loadMore")}
        </StickerButton>
      )}
      <Compose open={compose} onClose={() => setCompose(false)} />
    </AppShell>
  );
}
