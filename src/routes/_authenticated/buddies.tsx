import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  Ban,
  CalendarCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Flag,
  Flame,
  Mail,
  MapPin,
  MoreHorizontal,
  ShieldCheck,
  SlidersHorizontal,
  UserRoundMinus,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/lezgo/app-shell";
import { Avatar, BottomSheet, Field, inputCls, Num, StickerButton } from "@/components/lezgo/ui";
import { HabitIcon } from "@/components/lezgo/habit-icon";
import { FeatureGate } from "@/components/lezgo/feature-gate";
import { StickerLoading } from "@/components/lezgo/launch/loading";
import { matchesQuery, outgoingBuddyCountQuery, type Match } from "@/lib/batch5-data";
import { countryName, crewDetailsQuery } from "@/lib/community-data";
import { useBase, activeSeasonQuery } from "@/lib/data";
import { formatNumber, loc } from "@/lib/i18n";
import { localDate, pad } from "@/lib/time";
import { pageHead } from "@/lib/page-head";

export const Route = createFileRoute("/_authenticated/buddies")({
  head: () =>
    pageHead(
      "Find a buddy · lezgo",
      "Find a habit buddy in your challenge and keep showing up together.",
    ),
  loader: ({ context }) => {
    const { queryClient, user } = context;
    void queryClient
      .ensureQueryData(activeSeasonQuery(user.id))
      .then((season) => {
        if (season) void queryClient.prefetchQuery(matchesQuery(user.id, season.id));
      })
      .catch(() => {});
  },
  component: () => (
    <FeatureGate feature="buddies">
      <Buddies />
    </FeatureGate>
  ),
});

const filtersList = ["sameLanguage", "closeTimezone", "sameGoals", "sameGender"] as const;
const defaultFilters = [false, false, false, false];
type BuddyAction = "invite" | "accept" | "decline" | "block" | "remove" | "report";
type BuddySheet = { kind: "options" | "block" | "remove" | "report"; person: Match };

function Buddies() {
  const { t, i18n } = useTranslation();
  const { season, profile, loading, tz } = useBase();
  const uid = Route.useRouteContext().user.id;
  const qc = useQueryClient();
  const [view, setView] = useState<"browse" | "invites">("browse");
  const [filters, setFilters] = useState(defaultFilters);
  const [selection, setSelection] = useState(0);
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [birthday, setBirthday] = useState<string | null>(null);
  const [sheet, setSheet] = useState<BuddySheet | null>(null);
  const [reason, setReason] = useState("");
  const q = useQuery({
    ...matchesQuery(uid, season?.id ?? "", filters),
    enabled: !!season,
    placeholderData: (previous, query) =>
      query?.queryKey[1] === uid && query.queryKey[2] === season?.id ? previous : undefined,
  });
  const out = useQuery({
    ...outgoingBuddyCountQuery(uid),
    enabled: !!season && !!q.data?.eligible,
  });
  const buddy = q.data?.buddy;
  const duo = useQuery({ ...crewDetailsQuery(buddy?.crew_id ?? ""), enabled: !!buddy?.crew_id });
  const results = q.data?.results ?? [];
  const incoming = q.data?.incoming ?? [];
  const index = Math.max(0, Math.min(selection, results.length - 1));
  const candidate = results[index];
  const activeFilters = filters.filter(Boolean).length;
  const birthDate = birthday ?? profile?.birth_date ?? "";
  const hasError = q.isError && !q.data;
  const adultCutoff = new Date(`${localDate(tz)}T12:00:00Z`);
  const cutoffDay = adultCutoff.getUTCDate();
  adultCutoff.setUTCFullYear(adultCutoff.getUTCFullYear() - 18);
  if (adultCutoff.getUTCDate() !== cutoffDay) adultCutoff.setUTCDate(0);
  const latestBirthDate = adultCutoff.toISOString().slice(0, 10);
  const number = (value: number) => formatNumber(value, i18n.language);

  function resetFilters() {
    setSelection(0);
    setFilters(defaultFilters);
  }
  function openOptions(person: Match) {
    setReason("");
    setSheet({ kind: "options", person });
  }
  async function run(operation: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      await operation();
    } catch {
      toast.error(t("common.error"));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  const refreshBuddies = () => qc.invalidateQueries({ queryKey: ["buddies", uid] });
  async function act(action: BuddyAction, person: Match) {
    await run(async () => {
      const { error } =
        action === "report"
          ? await supabase.rpc("report_buddy", { _target: person.user_id, _reason: reason.trim() })
          : await supabase.rpc("buddy_action", { _action: action, _target: person.user_id });
      if (error) {
        const message = error.message;
        if (message.includes("guest_read_only")) return;
        if (message.includes("too_many_requests")) {
          toast.error(t("buddies.requestLimit"));
          return;
        }
        if (message.includes("adults_only")) {
          toast.error(t("batch5.birthdayError"));
          return;
        }
        if (message.includes("buddy_limit")) {
          await refreshBuddies();
          toast.error(t("socialDesign.buddyLimit"));
          return;
        }
        if (
          ["incoming_request", "not_invited", "blocked", "invalid_target", "no_season"].some(
            (code) => message.includes(code),
          )
        ) {
          await refreshBuddies();
          setSheet(null);
          toast.error(t("buddies.invitationChanged"));
          return;
        }
        throw error;
      }
      setSheet(null);
      if (action === "accept") setView("browse");
      await Promise.all([
        refreshBuddies(),
        ...["myCrew", "day", "crewDetails", "profileSummary", "challengePulse"].map((key) =>
          qc.invalidateQueries({ queryKey: [key] }),
        ),
      ]);
      const messages = {
        invite: "batch5.invited",
        accept: "buddies.accepted",
        decline: null,
        block: "buddies.blocked",
        remove: "buddies.removed",
        report: "batch4.reported",
      } as const;
      if (messages[action]) toast.success(t(messages[action]));
    });
  }
  async function saveBirthday() {
    if (!birthDate || birthDate > latestBirthDate) return;
    await run(async () => {
      const { error } = await supabase
        .from("profiles")
        .update({ birth_date: birthDate })
        .eq("id", uid);
      if (error) throw error;
      await Promise.all([qc.invalidateQueries({ queryKey: ["profile", uid] }), refreshBuddies()]);
    });
  }

  const incomingCount = incoming.length;
  return (
    <AppShell title={t("socialDesign.findBuddy")} back="/profile">
      {loading || (!!season && q.isPending) ? (
        <StickerLoading />
      ) : !season ? (
        <section className="app-surface buddy-empty">
          <UsersRound size={28} aria-hidden="true" />
          <p>{t("buddies.noActive")}</p>
          <Link to="/start" className="buddy-primary-link">
            {t("challengeHistory.pickNext")}
            <ArrowRight size={17} className="rtl:-scale-x-100" aria-hidden="true" />
          </Link>
        </section>
      ) : hasError ? (
        <section className="app-surface buddy-empty">
          <p role="alert">{t("common.error")}</p>
          <StickerButton variant="secondary" size="sm" onClick={() => void q.refetch()}>
            {t("common.retry")}
          </StickerButton>
        </section>
      ) : !q.data?.eligible ? (
        <form
          className="app-surface buddy-age"
          onSubmit={(event) => {
            event.preventDefault();
            void saveBirthday();
          }}
        >
          <ShieldCheck size={28} aria-hidden="true" />
          <h2 className="app-section-title">{t("buddies.verifyAge")}</h2>
          <p>{t("batch5.ageNeeded")}</p>
          <Field label={t("batch5.birthDate")}>
            <input
              type="date"
              required
              max={latestBirthDate}
              value={birthDate}
              className={inputCls}
              onChange={(event) => setBirthday(event.target.value)}
            />
          </Field>
          {birthDate > latestBirthDate && <p role="alert">{t("batch5.birthdayError")}</p>}
          <StickerButton
            type="submit"
            variant="lime"
            disabled={busy || !birthDate || birthDate > latestBirthDate}
          >
            {t("common.save")}
          </StickerButton>
        </form>
      ) : (
        <>
          <div
            className="board-segments buddy-tabs"
            role="group"
            aria-label={t("socialDesign.findBuddy")}
          >
            <button
              type="button"
              aria-pressed={view === "browse"}
              onClick={() => setView("browse")}
            >
              {t(buddy ? "batch5.myBuddy" : "buddies.browse")}
            </button>
            <button
              type="button"
              aria-pressed={view === "invites"}
              onClick={() => setView("invites")}
            >
              {t("buddies.invites")}
              {incomingCount > 0 && <Num className="buddy-count">{number(incomingCount)}</Num>}
            </button>
          </div>
          {view === "invites" ? (
            <>
              <section className="buddy-invitations" aria-labelledby="buddy-incoming">
                <h2 id="buddy-incoming" className="app-section-title">
                  {t("buddies.received")}
                </h2>
                {!incomingCount && (
                  <p className="app-surface buddy-invite-empty">{t("buddies.noneReceived")}</p>
                )}
                {incoming.map((person) => (
                  <section className="app-surface buddy-invite" key={person.user_id}>
                    <BuddyIdentity person={person} onOptions={() => openOptions(person)} />
                    <details className="buddy-invite-details">
                      <summary>
                        {t("buddies.viewDetails")}
                        <ChevronDown size={17} aria-hidden="true" />
                      </summary>
                      <BuddyDetails person={person} />
                    </details>
                    <div className="buddy-actions">
                      <StickerButton
                        variant="secondary"
                        size="sm"
                        disabled={busy}
                        onClick={() => void act("decline", person)}
                      >
                        {t("socialDesign.decline")}
                      </StickerButton>
                      <StickerButton
                        variant="lime"
                        size="sm"
                        disabled={busy || !!buddy}
                        onClick={() => void act("accept", person)}
                      >
                        {t("socialDesign.accept")}
                      </StickerButton>
                    </div>
                    {buddy && <p className="buddy-hint">{t("socialDesign.buddyLimit")}</p>}
                  </section>
                ))}
              </section>
              <section className="buddy-invitations" aria-labelledby="buddy-outgoing">
                <h2 id="buddy-outgoing" className="app-section-title">
                  {t("buddies.sent")}
                </h2>
                <div className="app-surface buddy-sent" aria-live="polite">
                  <Mail size={22} aria-hidden="true" />
                  {out.isPending ? (
                    <p>{t("common.loading")}</p>
                  ) : out.isError ? (
                    <StickerButton variant="ghost" size="sm" onClick={() => void out.refetch()}>
                      {t("common.retry")}
                    </StickerButton>
                  ) : out.data ? (
                    <>
                      <p>{t("buddies.waiting")}</p>
                      <Num>{number(out.data)}</Num>
                    </>
                  ) : (
                    <p>{t("buddies.noneSent")}</p>
                  )}
                </div>
              </section>
            </>
          ) : buddy ? (
            <>
              <BuddyCard person={buddy} onOptions={() => openOptions(buddy)} />
              {duo.data && (
                <section className="app-surface buddy-duo">
                  <h2 className="app-section-title">{t("buddies.duoToday")}</h2>
                  {duo.data.members.map((member) => (
                    <div className="buddy-duo-member" key={member.user_id}>
                      <Avatar
                        id={member.user_id}
                        name={member.display_name}
                        url={member.avatar_url}
                        size={32}
                      />
                      <strong>{member.display_name}</strong>
                      <Num>
                        {number(member.done)}/{number(member.total)}
                      </Num>
                    </div>
                  ))}
                  <Link to="/today" className="buddy-primary-link">
                    {t("buddies.logHabit")}
                    <ArrowRight size={17} className="rtl:-scale-x-100" aria-hidden="true" />
                  </Link>
                </section>
              )}
            </>
          ) : (
            <>
              <details className="app-disclosure buddy-preferences">
                <summary>
                  <SlidersHorizontal size={18} aria-hidden="true" />
                  {t("buddies.filters")}
                  {activeFilters > 0 && <Num className="buddy-count">{number(activeFilters)}</Num>}
                  <ChevronDown size={18} aria-hidden="true" />
                </summary>
                <div className="buddy-filters">
                  {filtersList.map((key, i) => (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={filters[i] ?? false}
                      onClick={() => {
                        setSelection(0);
                        setFilters((previous) =>
                          previous.map((value, j) => (i === j ? !value : value)),
                        );
                      }}
                    >
                      {t(`batch5.${key}`)}
                    </button>
                  ))}
                  {activeFilters > 0 && (
                    <button type="button" className="buddy-reset" onClick={resetFilters}>
                      {t("buddies.clear")}
                    </button>
                  )}
                </div>
              </details>
              {q.isPlaceholderData ? (
                <StickerLoading />
              ) : candidate ? (
                <>
                  <BuddyCard person={candidate} onOptions={() => openOptions(candidate)}>
                    <StickerButton
                      block
                      variant="lime"
                      disabled={busy}
                      onClick={() => void act("invite", candidate)}
                    >
                      <Mail size={18} aria-hidden="true" />
                      {t("batch5.invite")}
                    </StickerButton>
                  </BuddyCard>
                  {results.length > 1 && (
                    <div className="buddy-pager">
                      <button
                        type="button"
                        className="app-icon-button"
                        aria-label={t("common.back")}
                        disabled={index === 0}
                        onClick={() => setSelection(index - 1)}
                      >
                        <ChevronLeft size={20} className="rtl:-scale-x-100" aria-hidden="true" />
                      </button>
                      <p role="status">
                        {t("buddies.position", {
                          current: number(index + 1),
                          total: number(results.length),
                        })}
                      </p>
                      <button
                        type="button"
                        className="app-icon-button"
                        aria-label={t("tour.next")}
                        disabled={index === results.length - 1}
                        onClick={() => setSelection(index + 1)}
                      >
                        <ChevronRight size={20} className="rtl:-scale-x-100" aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <section className="app-surface buddy-empty">
                  <UsersRound size={28} aria-hidden="true" />
                  <h2 className="app-section-title">{t("socialDesign.noResults")}</h2>
                  <p>{t(activeFilters ? "buddies.tryWider" : "buddies.empty")}</p>
                  {activeFilters > 0 && (
                    <StickerButton variant="secondary" size="sm" onClick={resetFilters}>
                      {t("buddies.clear")}
                    </StickerButton>
                  )}
                </section>
              )}
            </>
          )}
        </>
      )}
      <details className="app-disclosure buddy-help">
        <summary>
          <ShieldCheck size={18} aria-hidden="true" />
          {t("buddies.howItWorks")}
          <ChevronDown size={18} aria-hidden="true" />
        </summary>
        <ul>
          <li>{t("buddies.consent")}</li>
          <li>{t("buddies.matchInfo")}</li>
          <li>{t("buddies.bonus")}</li>
          <li>{t("buddies.safety")}</li>
        </ul>
      </details>
      <BottomSheet
        open={!!sheet}
        onClose={() => {
          if (!busy) setSheet(null);
        }}
        title={
          sheet
            ? t(
                {
                  options: "buddies.options",
                  block: "batch5.block",
                  remove: "socialDesign.removeBuddy",
                  report: "batch5.reportBlock",
                }[sheet.kind],
                { name: sheet.person.display_name },
              )
            : undefined
        }
      >
        {sheet &&
          (sheet.kind === "options" ? (
            <div className="buddy-option-list">
              {buddy?.user_id === sheet.person.user_id && (
                <button type="button" onClick={() => setSheet({ ...sheet, kind: "remove" })}>
                  <UserRoundMinus size={18} aria-hidden="true" />
                  {t("socialDesign.removeBuddy")}
                </button>
              )}
              <button type="button" onClick={() => setSheet({ ...sheet, kind: "block" })}>
                <Ban size={18} aria-hidden="true" />
                {t("batch5.block")}
              </button>
              <button type="button" onClick={() => setSheet({ ...sheet, kind: "report" })}>
                <Flag size={18} aria-hidden="true" />
                {t("batch5.reportBlock")}
              </button>
            </div>
          ) : (
            <form
              className="buddy-confirm"
              onSubmit={(event) => {
                event.preventDefault();
                if (sheet.kind !== "options") void act(sheet.kind, sheet.person);
              }}
            >
              <p>
                {t(
                  {
                    block: "buddies.blockConfirm",
                    remove: "buddies.removeConfirm",
                    report: "buddies.reportBody",
                  }[sheet.kind],
                  { name: sheet.person.display_name },
                )}
              </p>
              {sheet.kind === "report" && (
                <Field label={t("batch4.reason")}>
                  <textarea
                    required
                    maxLength={280}
                    value={reason}
                    className={inputCls}
                    onChange={(event) => setReason(event.target.value)}
                  />
                </Field>
              )}
              <div className="buddy-actions">
                <StickerButton
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  onClick={() => setSheet({ ...sheet, kind: "options" })}
                >
                  {t("common.back")}
                </StickerButton>
                <StickerButton
                  type="submit"
                  variant="danger"
                  size="sm"
                  disabled={busy || (sheet.kind === "report" && !reason.trim())}
                >
                  {t(
                    {
                      block: "batch5.block",
                      remove: "socialDesign.removeBuddy",
                      report: "batch5.reportBlock",
                    }[sheet.kind],
                  )}
                </StickerButton>
              </div>
            </form>
          ))}
      </BottomSheet>
    </AppShell>
  );
}

function BuddyCard({
  person,
  children,
  onOptions,
}: {
  person: Match;
  children?: ReactNode;
  onOptions: () => void;
}) {
  return (
    <article className="buddy-match">
      <div className="buddy-match-top">
        <BuddyIdentity person={person} onOptions={onOptions} featured />
      </div>
      <div className="buddy-match-content">
        <BuddyDetails person={person} />
        {children}
      </div>
    </article>
  );
}

function BuddyIdentity({
  person,
  onOptions,
  featured,
}: {
  person: Match;
  onOptions: () => void;
  featured?: boolean;
}) {
  const { t } = useTranslation();
  const Heading = featured ? "h2" : "h3";
  return (
    <div className="buddy-identity">
      <Avatar id={person.user_id} name={person.display_name} url={person.avatar_url} size={52} />
      <div>
        <Heading>{person.display_name}</Heading>
        {person.handle && (
          <p>
            <bdi dir="ltr">@{person.handle}</bdi>
          </p>
        )}
      </div>
      <button
        type="button"
        className="app-icon-button"
        aria-label={t("buddies.options", { name: person.display_name })}
        onClick={onOptions}
      >
        <MoreHorizontal size={20} aria-hidden="true" />
      </button>
    </div>
  );
}

function BuddyDetails({ person }: { person: Match }) {
  const { t, i18n } = useTranslation();
  const location = [person.city, countryName(person.country_code, i18n.language)]
    .filter(Boolean)
    .join(", ");
  const minutes = Math.round(Math.abs(person.utc_offset) * 60);
  const offset = `UTC${person.utc_offset < 0 ? "−" : "+"}${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
  return (
    <div className="buddy-details">
      <div className="buddy-facts">
        <span className="buddy-match-score">
          {t("buddies.match", { value: formatNumber(person.match, i18n.language) })}
        </span>
        {location && (
          <span>
            <MapPin size={15} aria-hidden="true" />
            {location}
          </span>
        )}
        {Number.isFinite(person.utc_offset) && <bdi dir="ltr">{offset}</bdi>}
      </div>
      <dl className="buddy-stats">
        <div>
          <Flame size={19} aria-hidden="true" />
          <dt>{t("buddies.streak")}</dt>
          <dd>
            <Num>{formatNumber(person.streak, i18n.language)}</Num>
          </dd>
        </div>
        <div>
          <CalendarCheck size={19} aria-hidden="true" />
          <dt>{t("buddies.activeDays")}</dt>
          <dd>
            <Num>{formatNumber(person.active_days, i18n.language)}</Num>
          </dd>
        </div>
      </dl>
      <div className="buddy-shared">
        <p className="buddy-shared-label">{t("batch5.shared")}</p>
        {person.shared.length > 0 ? (
          <ul className="buddy-habits">
            {person.shared.map((habit) => (
              <li key={habit.key} data-color={habit.color || "lime"}>
                <HabitIcon name={habit.icon || habit.key} />
                {loc(habit.name, i18n.language)}
              </li>
            ))}
          </ul>
        ) : (
          <p>{t("buddies.noShared")}</p>
        )}
      </div>
    </div>
  );
}
