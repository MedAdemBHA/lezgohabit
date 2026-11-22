import { pageHead } from "@/lib/page-head";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/lezgo/app-shell";
import { FlameIcon } from "@/components/lezgo/icons";
import { Avatar, BottomSheet, Chip, Flag, Num, Segmented, StickerButton, StickerCard } from "@/components/lezgo/ui";
import { useBase } from "@/lib/data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/ranks")({
  head: () => pageHead("Ranks — lezgo", "Tunisia, World and Crew leaderboards for the season."),
  component: Ranks,
});

type Row = { rank: number; user_id?: string; crew_id?: string; display_name: string; handle?: string; avatar_url?: string | null;
  country_code?: string; streak: number; points: number; is_me: boolean; members?: number };
type Scope = "country" | "world" | "crews";
type Period = "today" | "week" | "season";

function Ranks() {
  const { t } = useTranslation();
  const { season, profile } = useBase();
  const [scope, setScope] = useState<Scope>("country");
  const [period, setPeriod] = useState<Period>("season");
  const [sel, setSel] = useState<Row | null>(null);
  const q = useQuery({
    queryKey: ["leaderboard", season?.id, scope, period, profile?.country_code],
    enabled: !!season && !!profile,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("leaderboard", { _season_id: season!.id, _scope: scope, _period: period, _country_code: profile!.country_code });
      if (error) throw error;
      return data as unknown as { rows: Row[]; me: Row | null };
    },
  });
  const rows = q.data?.rows ?? [];
  const me = q.data?.me;
  const meVisible = rows.some((r) => r.is_me);

  return (
    <AppShell>
      <h1 className="mb-4 text-[30px] font-extrabold">{t("common.ranks")}</h1>
      <Segmented value={scope} onChange={setScope} options={[
        { value: "country", label: t("ranks.tunisia") }, { value: "world", label: t("ranks.world") }, { value: "crews", label: t("ranks.crews") }]} />
      <div className="mt-3 flex gap-2">
        {(["today", "week", "season"] as const).map((p) => <Chip key={p} active={period === p} onClick={() => setPeriod(p)}>{t(`ranks.${p}`)}</Chip>)}
      </div>

      <div className="mt-5 space-y-3">
        {q.isLoading && <p className="py-8 text-center">{t("common.loading")}</p>}
        {!q.isLoading && rows.length === 0 && <StickerCard className="text-center font-bold">{t("ranks.empty")}</StickerCard>}
        {rows.map((r) => <RankRow key={(r.user_id ?? r.crew_id)!} r={r} onClick={() => setSel(r)} />)}
      </div>

      {me && !meVisible && (
        <div className="fixed inset-x-0 bottom-[92px] z-30 mx-auto w-full max-w-[440px] px-4">
          <RankRow r={me} onClick={() => setSel(me)} />
        </div>
      )}

      <div className={cn("mt-6", me && !meVisible && "mb-20")}>
        <Link to="/today" className="block"><StickerButton block variant="secondary">{t("ranks.next")}<ArrowRight strokeWidth={3} className="size-5 rtl:-scale-x-100" /></StickerButton></Link>
      </div>

      <BottomSheet open={!!sel} onClose={() => setSel(null)} title={sel?.display_name}>
        {sel && (
          <div className="flex items-center gap-4">
            <Avatar id={(sel.user_id ?? sel.crew_id)!} name={sel.display_name} url={sel.avatar_url} size={72} />
            <div className="space-y-1">
              {sel.handle && <p className="text-[16px] font-bold text-muted-foreground"><bdi dir="ltr">@{sel.handle}</bdi></p>}
              {sel.members != null && <p className="font-bold">{t("ranks.members", { n: sel.members })}</p>}
              <p className="flex items-center gap-3 text-[18px] font-bold">
                <span><Num>#{sel.rank}</Num></span>
                {sel.country_code && <Flag code={sel.country_code} />}
                <span className="flex items-center gap-1"><FlameIcon size={20} /><Num>{sel.streak}</Num></span>
                <span><Num>{sel.points}</Num> {t("common.pts")}</span>
              </p>
            </div>
          </div>
        )}
      </BottomSheet>
    </AppShell>
  );
}

const TOP = ["bg-gold -rotate-1", "bg-silver rotate-1", "bg-bronze -rotate-[0.5deg]"];
function RankRow({ r, onClick }: { r: Row; onClick: () => void }) {
  const { t } = useTranslation();
  const top = r.rank <= 3 ? TOP[r.rank - 1] : "";
  return (
    <button type="button" onClick={onClick}
      className={cn("press flex h-16 w-full items-center gap-3 rounded-[18px] px-3 text-start sticker-border shadow-hard",
        top || (r.is_me ? "bg-lime" : "bg-card"), r.is_me && top && "outline-[3px] outline-offset-2 outline-orange outline")}>
      <Num className="w-8 shrink-0 text-center text-[18px] font-bold">{r.rank}</Num>
      <Avatar id={(r.user_id ?? r.crew_id)!} name={r.display_name} url={r.avatar_url} size={40} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] font-extrabold">{r.display_name}{r.is_me && <span className="text-muted-foreground"> · {t("ranks.you")}</span>}</span>
        <span className="flex items-center gap-2 text-[13px] font-bold text-muted-foreground">
          {r.country_code && <Flag code={r.country_code} />}
          {r.members != null ? t("ranks.members", { n: r.members }) : <span className="flex items-center gap-0.5"><FlameIcon size={14} /><Num>{r.streak}</Num></span>}
        </span>
      </span>
      <Num className="shrink-0 text-[18px] font-bold">{r.points}</Num>
    </button>
  );
}
