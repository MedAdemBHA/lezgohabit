import { ClientOnly, createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { LezgoMark } from "@/components/lezgo/brand";
import { StickerButton, Num } from "@/components/lezgo/ui";
import { errKey, useUser } from "@/lib/data";
import { pageHead } from "@/lib/page-head";
import { challengePreview, crewInvitePreview } from "@/lib/challenge-preview.functions";
import { formatDayMonth, isRtl, loc, selectLang, type Lang } from "@/lib/i18n";
import i18n from "@/lib/i18n";
import { inviteBlock } from "@/lib/challenge-catalog";
import { joinErrorKey } from "@/lib/event-data";
import { supabase } from "@/integrations/supabase/client";
import { isGuestMode } from "@/lib/guest";
import { useLeaveGuest } from "@/components/lezgo/guest";

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
  validateSearch: (search: Record<string, unknown>): { lang?: Lang } => {
    const lang = selectLang(search["lang"]);
    return lang ? { lang } : {};
  },
  loaderDeps: ({ search }) => ({ lang: search.lang ?? "en" }),
  loader: async ({ context, params, deps: { lang } }) => {
    const code = params.code.toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(code)) return { challenge: null, crew: null, unavailable: false, lang };
    try {
      const challenge = await context.queryClient.ensureQueryData(preview(code));
      const crew = challenge ? null : await crewInvitePreview({ data: code });
      return { challenge, crew, unavailable: false, lang };
    } catch {
      return { challenge: null, crew: null, unavailable: true, lang };
    }
  },
  head: ({ params, loaderData }) => {
    const data = loaderData;
    const challenge = data?.challenge;
    const lang = data?.lang ?? "en";
    const copyLang = lang === "aeb" ? "ar" : lang;
    if (!challenge) return pageHead(
      copyLang === "fr" ? "Rejoignez votre crew sur lezgo" : copyLang === "ar" ? "انضم إلى فريقك على lezgo" : "Join a crew on lezgo",
      copyLang === "fr" ? "Rejoignez votre crew et soyez présents ensemble sur lezgo." : copyLang === "ar" ? "انضم إلى فريقك واظهروا معاً على lezgo." : "Join your crew and show up together on lezgo.",
      { privatePage: true, localeAlternates: false, canonicalPath: `/c/${params.code}`, imagePath: `/og/challenge/${params.code}`, imageAlt: "Join a crew on lezgo", lang },
    );
    const creator = challenge.creator ? `@${challenge.creator.replace(/^@/, "")}` : "";
    const habits = challenge.habits.map((habit) => loc(habit.name, lang)).filter(Boolean);
    const habitList = habits.slice(0, 3).join(", ") + (habits.length > 3 ? "…" : "");
    const startDate = new Intl.DateTimeFormat(copyLang === "ar" ? "ar-TN" : copyLang, { day: "numeric", month: "long", timeZone: "UTC" })
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
    }[copyLang];
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
  const { lang, challenge, crew, unavailable } = Route.useLoaderData();
  const preview = challenge ?? crew;
  const blocked = preview ? inviteBlock(preview, crew ? "crew" : "creator") : null;
  const t = i18n.getFixedT(lang);

  return (
    <main className="challenge-public" lang={lang} dir={isRtl(lang) ? "rtl" : "ltr"}>
      <LezgoMark size={64} />
      {challenge ? (
        <>
          <h1>{challenge.name}</h1>
          <p>{t("batch6.days", { n: challenge.days })} · {formatDayMonth(challenge.starts_on, lang)} – {formatDayMonth(challenge.ends_on, lang)}</p>
          <p>{t("batch6.creatorLabel", { name: challenge.creator.startsWith("@") ? challenge.creator : `@${challenge.creator}` })}</p>
          <Num>{t("batch6.members", { n: challenge.members })}</Num>
          <div className="challenge-preview-habits">
            {challenge.habits.map((habit) => <article key={habit.key} className="sticker rounded-[14px] bg-card p-3 text-start">
              <strong>{loc(habit.name, lang)}</strong>
              <p className="text-[13px] font-semibold">{loc(habit.what_counts, lang)} · {habit.target}{habit.unit ? ` ${habit.unit}` : ""}</p>
            </article>)}
          </div>
          <ClientOnly fallback={<p className="font-extrabold">{t(blocked ?? "events.joinOnLezgo")}</p>}>
            <InviteActions code={code} challenge={challenge} blocked={blocked} lang={lang} />
          </ClientOnly>
        </>
      ) : crew ? (
        <>
          <h1>{crew.name}</h1>
          <p>{loc(crew.event, lang)} · {formatDayMonth(crew.starts_on, lang)} – {formatDayMonth(crew.ends_on, lang)}</p>
          <Num>{code.toUpperCase()}</Num>
          <p>{t("batch6.crewInviteNote")}</p>
          <ClientOnly fallback={<p className="font-extrabold">{blocked ? t(blocked) : t("crew.joinBtn")}</p>}>
            <InviteActions code={code} challenge={null} blocked={blocked} lang={lang} />
          </ClientOnly>
        </>
      ) : (
        <>
          <h1 className="invite-error">{t(unavailable ? "events.inviteUnavailable" : "events.invalidCode")}</h1>
          {unavailable && <RetryInvite label={t("batch9.retry")} />}
          <Link to="/start" search={{ lang }} className="public-action public-action-secondary">{t("challengeHistory.pickNext")}</Link>
        </>
      )}
    </main>
  );
}

function RetryInvite({ label }: { label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return <StickerButton variant="lime" disabled={busy} onClick={() => {
    setBusy(true);
    void router.invalidate().finally(() => setBusy(false));
  }}>{label}</StickerButton>;
}

function InviteActions({ code, challenge, blocked, lang }: { code: string; challenge: ChallengePreview | null; blocked: string | null; lang: Lang }) {
  const user = useUser();
  const leaveGuest = useLeaveGuest();
  // The player's own entry in this challenge's season (any status), readable under RLS.
  const entry = useQuery({
    queryKey: ["inviteEntry", user?.id, challenge?.season_id],
    enabled: !!user && !!challenge,
    queryFn: async () => {
      const { data, error } = await supabase.from("season_entries").select("status")
        .eq("user_id", user!.id).eq("season_id", challenge!.season_id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const userProfile = useQuery({
    queryKey: ["startProfile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("onboarded").eq("id", user!.id).single();
      if (error) throw error;
      return data;
    },
  });
  const t = i18n.getFixedT(lang);
  const qc = useQueryClient();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [joinIssue, setJoinIssue] = useState<string | null>(null);

  async function join() {
    if (!user || !userProfile.data?.onboarded) {
      void nav({ to: "/start", search: { code, lang } });
      return;
    }
    if (busy) return;
    if (isGuestMode()) { setJoinIssue("guest_read_only"); return; }
    setJoinIssue(null);
    setBusy(true);
    try {
      const result = challenge
        ? await supabase.rpc("join_challenge", { _code: code })
        : await supabase.rpc("join_crew", { _code: code });
      if (result.error) {
        setJoinIssue(errKey(result.error));
        return;
      }
      sessionStorage.removeItem("lezgo_challenge_invite");
      await qc.invalidateQueries();
      void nav({ to: "/today" });
    } catch {
      setJoinIssue("");
    } finally {
      setBusy(false);
    }
  }

  function signUpFromGuest() {
    // Bring the invite along so the new account lands back here after sign-in.
    sessionStorage.setItem("lezgo_challenge_invite", code);
    void leaveGuest();
  }

  // Members come first: an upcoming or full challenge still belongs to them (ended ones offer the recap).
  const member = entry.data?.status === "active" && !challenge?.ended;
  if (member) return <>
    <p role="status" className="font-extrabold">{t("flows.youreIn")}</p>
    <Link to="/today" className="public-action public-action-primary">{t("events.goToday")}</Link>
  </>;
  if (blocked) return <>
    <p role="status">{t(blocked)}</p>
    {blocked === "events.closed" && challenge && entry.data && (
      <Link to="/wrapped" search={{ season: challenge.season_id }} className="public-action public-action-secondary">{t("flows.seeRecap")}</Link>
    )}
    <Link to="/start" search={{ lang }} className="public-action public-action-secondary">{t("challengeHistory.pickNext")}</Link>
  </>;
  const label = user ? (challenge ? t("batch6.join") : t("crew.joinBtn")) : t("batch6.signIn");
  const issueText = joinIssue === "guest_read_only" ? t("flows.guestJoin")
    : joinIssue === "already_in_crew" ? t("flows.alreadyInCrew")
    : joinIssue !== null ? t(joinErrorKey(joinIssue)) : null;
  return <>
    {issueText && <p role="alert">{issueText}</p>}
    {joinIssue === "guest_read_only"
      ? <StickerButton block variant="lime" onClick={signUpFromGuest}>{t("guest.create")}</StickerButton>
      : joinIssue === "active_challenge_exists" || joinIssue === "already_in_crew"
      ? <Link to="/today" className="public-action public-action-secondary">{t("events.goToday")}</Link>
      : <StickerButton block disabled={busy || user === undefined || (!!user && userProfile.isLoading)} onClick={() => void join()}>{busy ? t("common.loading") : label}</StickerButton>}
    {!user && <Link to="/auth" className="sr-only">{t("batch6.signIn")}</Link>}
  </>;
}
