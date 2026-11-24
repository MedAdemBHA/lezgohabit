import { ClientOnly, createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { queryOptions, useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LezgoMark } from "@/components/lezgo/brand";
import { StickerButton, Num } from "@/components/lezgo/ui";
import { useUser } from "@/lib/data";
import { pageHead } from "@/lib/page-head";
import { challengePreview } from "@/lib/challenge-preview.functions";
import { loc } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

export type ChallengePreview = {
  id: string; season_id: string; name: string; days: number; audience: string; creator: string;
  starts_on: string; ends_on: string; code: string; members: number; full: boolean; ended: boolean;
  habits: { key: string; name: Record<string, string>; what_counts: Record<string, string>; kind: string; target: number; unit: string | null; is_faith: boolean }[];
};
const preview = (code: string) => queryOptions({
  queryKey: ["challengeInvite", code],
  queryFn: async () => await challengePreview({ data: code }) as unknown as ChallengePreview | null,
});
export const Route = createFileRoute("/c/$code")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(preview(params.code)),
  head: () => pageHead("Join a challenge — lezgo", "Join your people’s lezgo challenge with your invitation."),
  component: Invite,
});
function Invite() {
  const { code } = Route.useParams();
  return <ClientOnly fallback={<main className="challenge-public"><LezgoMark size={64} /></main>}><InviteContent code={code} /></ClientOnly>;
}
function InviteContent({ code }: { code: string }) {
  const q = useSuspenseQuery(preview(code));
  const user = useUser();
  const userProfile = useQuery({
    queryKey: ["startProfile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("onboarded").eq("id", user!.id).single();
      if (error) throw error;
      return data;
    },
  });
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  async function join() {
    if (!user || userProfile.data?.onboarded === false) {
      void nav({ to: "/start", search: { code } });
      return;
    }
    setBusy(true);
    const result = q.data
      ? await supabase.rpc("join_challenge", { _code: code })
      : await supabase.rpc("join_crew", { _code: code });
    setBusy(false);
    if (result.error) {
      const message = result.error.message;
      const key = message.includes("active_challenge_exists") ? "batch6.activeChallengeExists"
        : message.includes("challenge_full") || message.includes("crew_full") ? "batch6.full"
        : message.includes("challenge_ended") || message.includes("challenge_complete") ? "batch6.challengeClosed"
        : "common.error";
      toast(t(key));
      return;
    }
    sessionStorage.removeItem("lezgo_challenge_invite");
    await qc.invalidateQueries();
    void nav({ to: "/today" });
  }
  const challenge = q.data;
  return (
    <main className="challenge-public">
      <LezgoMark size={64} />
      {challenge ? (
        <>
          <h1>{challenge.name}</h1>
          <p>{t("batch6.days", { n: challenge.days })} · {challenge.starts_on} — {challenge.ends_on}</p>
          <p>{t("batch6.creatorLabel", { name: challenge.creator })}</p>
          <Num>{t("batch6.members", { n: challenge.members })}</Num>
          <div className="challenge-preview-habits">
            {challenge.habits.map((habit) => <article key={habit.key} className="sticker rounded-[14px] bg-card p-3 text-start">
              <strong>{loc(habit.name, i18n.language)}</strong>
              <p className="text-[13px] font-semibold">{loc(habit.what_counts, i18n.language)} · {habit.target}{habit.unit ? ` ${habit.unit}` : ""}</p>
            </article>)}
          </div>
          {challenge.full || challenge.ended ? <p>{t("batch6.full")}</p> : <StickerButton block disabled={busy || user === undefined || (!!user && userProfile.isLoading)} onClick={() => void join()}>{user ? t("batch6.join") : t("batch6.signIn")}</StickerButton>}
        </>
      ) : (
        <>
          <h1>{t("crew.shareTitle")}</h1>
          <Num>{code}</Num>
          <p>{t("batch6.crewInviteNote")}</p>
          <StickerButton block disabled={busy || user === undefined || (!!user && userProfile.isLoading)} onClick={() => void join()}>{user ? t("crew.joinBtn") : t("batch6.signIn")}</StickerButton>
        </>
      )}
      {!user && <Link to="/auth" className="sr-only">{t("batch6.signIn")}</Link>}
    </main>
  );
}
