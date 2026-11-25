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
    const requestedLang = new URLSearchParams(location.searchStr).get("lang");
    const lang = requestedLang === "fr" || requestedLang === "ar" ? requestedLang : "en";
    if (!/^[A-Z0-9]{6}$/i.test(params.code)) return { challenge: null, lang, issue: "batch6.notFound" } as const;
    try {
      const challenge = await context.queryClient.ensureQueryData(preview(params.code.toUpperCase()));
      return { challenge, lang, issue: null };
    } catch {
      return { challenge: null, lang, issue: "common.error" } as const;
    }
  },
  head: ({ params, loaderData }) => {
    const data = loaderData as { challenge: ChallengePreview | null; lang: "en" | "fr" | "ar" } | undefined;
    const challenge = data?.challenge;
    const lang = data?.lang ?? "en";
    if (!challenge) return pageHead(
      lang === "fr" ? "Rejoignez votre crew sur lezgo" : lang === "ar" ? "انضم إلى فريقك على lezgo" : "Join a crew on lezgo",
      lang === "fr" ? "Rejoignez votre crew et soyez présents ensemble sur lezgo." : lang === "ar" ? "انضم إلى فريقك واظهروا معاً على lezgo." : "Join your crew and show up together on lezgo.",
      { privatePage: !!loaderData?.issue, canonicalPath: `/c/${params.code}`, imagePath: `/og/challenge/${params.code}`, imageAlt: "Join a crew on lezgo", lang },
    );
    const creator = challenge.creator ? `@${challenge.creator.replace(/^@/, "")}` : "";
    const habits = challenge.habits.map((habit) => loc(habit.name, lang)).filter(Boolean);
    const habitList = habits.slice(0, 3).join(", ") + (habits.length > 3 ? "…" : "");
    const startDate = new Intl.DateTimeFormat(lang === "ar" ? "ar-TN" : lang, { day: "numeric", month: "long", timeZone: "UTC" })
      .format(new Date(`${challenge.starts_on}T00:00:00Z`));
    const copy = {
      en: {
        title: `Join “${challenge.name}” on lezgo`,
        who: creator ? `${creator} invited you` : "You're invited",
        meta: `${challenge.days} days · ${habits.length} habits`,
        people: challenge.members === 1 ? "1 person in" : `${challenge.members} people in`,
        when: challenge.ended ? "Season ended" : challenge.full ? "Crew is full" : `Starts ${startDate}`,
      },
      fr: {
        title: `Rejoins « ${challenge.name} » sur lezgo`,
        who: creator ? `${creator} t'invite` : "Tu es invité·e",
        meta: `${challenge.days} jours · ${habits.length} habitudes`,
        people: `${challenge.members} inscrit${challenge.members > 1 ? "s" : ""}`,
        when: challenge.ended ? "Saison terminée" : challenge.full ? "Crew complet" : `Début le ${startDate}`,
      },
      ar: {
        title: `انضم إلى «${challenge.name}» على lezgo`,
        who: creator ? `${creator} يدعوك` : "أنت مدعو",
        meta: `${challenge.days} يوم · ${habits.length} عادات`,
        people: `${challenge.members} مشارك`,
        when: challenge.ended ? "انتهى الموسم" : challenge.full ? "الفريق مكتمل" : `يبدأ ${startDate}`,
      },
    }[lang];
    const description = `${copy.who}: ${copy.meta} (${habitList}). ${copy.people} · ${copy.when}.`;
    return pageHead(
      copy.title,
      description,
      { privatePage: false, canonicalPath: `/c/${params.code}`, imagePath: `/og/challenge/${params.code}`, imageAlt: `${challenge.name} — ${copy.meta}`, lang },
    );
  },
  component: Invite,
});

function Invite() {
  const { code: rawCode } = Route.useParams();
  const code = rawCode.toUpperCase();
  const { lang, challenge, issue } = Route.useLoaderData();
  const t = i18n.getFixedT(lang);

  return (
    <main className="challenge-public">
      <LezgoMark size={64} />
      {issue ? (
        <>
          <h1>{t(issue)}</h1>
          <Link to="/start" className="font-extrabold underline">{t("challengeHistory.pickNext")}</Link>
        </>
      ) : challenge ? (
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
