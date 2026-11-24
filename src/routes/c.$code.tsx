import { ClientOnly, createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LezgoMark } from "@/components/lezgo/brand";
import { StickerButton, Num } from "@/components/lezgo/ui";
import { useUser } from "@/lib/data";
import { pageHead } from "@/lib/page-head";
import { challengePreview } from "@/lib/challenge-preview.functions";
import { loc } from "@/lib/i18n";
import i18n from "@/lib/i18n";
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
  validateSearch: (search: Record<string, unknown>) =>
    search["lang"] === "fr" || search["lang"] === "ar" ? { lang: search["lang"] } : {},
  loader: async ({ context, params, location }) => {
    const challenge = await context.queryClient.ensureQueryData(preview(params.code));
    const requestedLang = new URLSearchParams(location.searchStr).get("lang");
    const lang = requestedLang === "fr" || requestedLang === "ar" ? requestedLang : "en";
    return { challenge, lang };
  },
  head: ({ params, loaderData }) => {
    const data = loaderData as { challenge: ChallengePreview | null; lang: "en" | "fr" | "ar" } | undefined;
    const challenge = data?.challenge;
    const lang = data?.lang ?? "en";
    if (!challenge) return pageHead(
      lang === "fr" ? "Rejoignez votre crew sur lezgo" : lang === "ar" ? "انضم إلى فريقك على lezgo" : "Join a crew on lezgo",
      lang === "fr" ? "Rejoignez votre crew et soyez présents ensemble sur lezgo." : lang === "ar" ? "انضم إلى فريقك واظهروا معاً على lezgo." : "Join your crew and show up together on lezgo.",
      { privatePage: false, canonicalPath: `/c/${params.code}`, imagePath: `/og/challenge/${params.code}`, imageAlt: "Join a crew on lezgo" },
    );
    const creator = challenge.creator ? `@${challenge.creator.replace(/^@/, "")}` : "a creator";
    const title = lang === "fr"
      ? `Rejoignez « ${challenge.name} » avec ${creator} sur Lezgo — ${challenge.days} jours, ${challenge.habits.length} habitudes`
      : lang === "ar"
        ? `انضم إلى «${challenge.name}» مع ${creator} على Lezgo — ${challenge.days} أيام، ${challenge.habits.length} عادات`
        : `Join “${challenge.name}” by ${creator} on Lezgo — ${challenge.days} days, ${challenge.habits.length} habits`;
    const description = lang === "fr"
      ? `Rejoignez « ${challenge.name} » sur Lezgo. ${challenge.days} jours et ${challenge.habits.length} habitudes, à partir du ${challenge.starts_on}.`
      : lang === "ar"
        ? `انضم إلى «${challenge.name}» على Lezgo. ${challenge.days} أيام و${challenge.habits.length} عادات، ابتداءً من ${challenge.starts_on}.`
        : `Join “${challenge.name}” by ${creator} on Lezgo. ${challenge.days} days, ${challenge.habits.length} habits, starting ${challenge.starts_on}.`;
    return pageHead(
      title,
      description,
      { privatePage: false, canonicalPath: `/c/${params.code}`, imagePath: `/og/challenge/${params.code}`, imageAlt: `${challenge.name} challenge card` },
    );
  },
  component: Invite,
});

function Invite() {
  const { code } = Route.useParams();
  const { lang, challenge } = Route.useLoaderData();
  const t = i18n.getFixedT(lang);

  return (
    <main className="challenge-public">
      <LezgoMark size={64} />
      {challenge ? (
        <>
          <h1>{challenge.name}</h1>
          <p>{t("batch6.days", { n: challenge.days })} · {challenge.starts_on} — {challenge.ends_on}</p>
          <p>{t("batch6.creatorLabel", { name: challenge.creator.startsWith("@") ? challenge.creator : `@${challenge.creator}` })}</p>
          <Num>{t("batch6.members", { n: challenge.members })}</Num>
          <div className="challenge-preview-habits">
            {challenge.habits.map((habit) => <article key={habit.key} className="sticker rounded-[14px] bg-card p-3 text-start">
              <strong>{loc(habit.name, lang)}</strong>
              <p className="text-[13px] font-semibold">{loc(habit.what_counts, lang)} · {habit.target}{habit.unit ? ` ${habit.unit}` : ""}</p>
            </article>)}
          </div>
          <ClientOnly fallback={<p className="font-extrabold">Join this challenge on lezgo</p>}>
            <InviteActions code={code} challenge={challenge} />
          </ClientOnly>
        </>
      ) : (
        <>
          <h1>{t("crew.shareTitle")}</h1>
          <Num>{code}</Num>
          <p>{t("batch6.crewInviteNote")}</p>
          <ClientOnly fallback={<p className="font-extrabold">Join this crew on lezgo</p>}>
            <InviteActions code={code} challenge={null} />
          </ClientOnly>
        </>
      )}
    </main>
  );
}

function InviteActions({ code, challenge }: { code: string; challenge: ChallengePreview | null }) {
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
  const { t } = useTranslation();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);

  async function join() {
    if (!user || userProfile.data?.onboarded === false) {
      void nav({ to: "/start", search: { code } });
      return;
    }
    setBusy(true);
    const result = challenge
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

  const label = user ? (challenge ? t("batch6.join") : t("crew.joinBtn")) : t("batch6.signIn");
  return <>
    {challenge?.full || challenge?.ended
      ? <p>{t("batch6.full")}</p>
      : <StickerButton block disabled={busy || user === undefined || (!!user && userProfile.isLoading)} onClick={() => void join()}>{label}</StickerButton>}
    {!user && <Link to="/auth" className="sr-only">{t("batch6.signIn")}</Link>}
  </>;
}
