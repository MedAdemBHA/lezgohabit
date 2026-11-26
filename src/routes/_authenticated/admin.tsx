import { supabase } from "@/integrations/supabase/client";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard,
  CalendarDays,
  ShieldCheck,
  Users,
  Star,
  Flag,
  SlidersHorizontal,
  ShieldAlert,
  Megaphone,
  ToggleLeft,
  Database,
  ScrollText,
  Menu,
  X,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  RefreshCw,
  Trash2,
  Check,
  Copy,
  Eye,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { Brand } from "@/components/lezgo/brand";
import { Avatar, StickerButton, Switch, BottomSheet, Num, inputCls } from "@/components/lezgo/ui";
import { AdminProofThumbnail } from "@/components/lezgo/admin/proof-thumbnail";
import { ManageCommunity } from "@/components/lezgo/community/moderation";
import { AdminModerationAppeals } from "@/components/lezgo/community/moderation-notices";
import { OfficialEventsAdmin } from "@/components/lezgo/admin/official-events";
import { AdminOverview } from "@/components/lezgo/admin/charts";
import { AdminEditor, type EditorKind } from "@/components/lezgo/admin/editor";
import { adminQuery, adminWrite, type AdminRow } from "@/lib/admin-data";
import { adminDemo, adminAccount } from "@/lib/admin.functions";
import { ADMIN_SECTIONS, type AdminSection, requiresReason } from "@/lib/admin-rules";
import { applyLang, loc, numberLocale } from "@/lib/i18n";
import { pageHead } from "@/lib/page-head";
import { planFor } from "@/lib/challenge-plan";
const icons = [
  LayoutDashboard,
  CalendarDays,
  ShieldCheck,
  Users,
  Star,
  Flag,
  SlidersHorizontal,
  ShieldAlert,
  Megaphone,
  ToggleLeft,
  Database,
  ScrollText,
];
export const Route = createFileRoute("/_authenticated/admin")({
  validateSearch: (search: Record<string, unknown>): { section?: AdminSection } => {
    const value = search["section"];
    return typeof value === "string" && (ADMIN_SECTIONS as readonly string[]).includes(value)
      ? { section: value as AdminSection }
      : {};
  },
  head: ({ match }) =>
    pageHead(
      `${match.search.section ?? "Overview"} · lezgo admin`,
      "Manage lezgo seasons, moderation, player safety and sample data.",
      true,
    ),
  component: AdminPage,
});
const str = (r: AdminRow, k: string) => String(r[k] ?? "");
function AdminPage() {
  const { t, i18n } = useTranslation();
  const { user } = Route.useRouteContext();
  const section = Route.useSearch().section ?? "overview";
  const nav = useNavigate();
  const qc = useQueryClient();
  const [drawer, setDrawer] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [target, setTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState<{ kind: EditorKind; row?: AdminRow } | null>(null);
  const [pending, setPending] = useState<{
    action: string;
    id: string | null;
    payload: AdminRow;
    demo?: boolean;
  } | null>(null);
  const [reason, setReason] = useState("");
  const [menu, setMenu] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminRow | null>(null);
  const [word, setWord] = useState("");
  const [wordLang, setWordLang] = useState("en");
  const [showDemo, setShowDemo] = useState(false);
  const q = useQuery(adminQuery(user.id, section, search, page, target, showDemo));
  const guests = useQuery({ queryKey: ["admin-guest-sessions", user.id], enabled: !!q.data, refetchInterval: 60_000, queryFn: async () => { const { data, error } = await supabase.rpc("admin_guest_sessions"); if (error) throw error; return data as unknown as { today: number; week: number }; } });
  const creatorRequests = useQuery({
    queryKey: ["creator-requests", user.id],
    enabled: section === "creators" && !!q.data,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("creator_requests_admin");
      if (error) throw error;
      return (data ?? []) as unknown as AdminRow[];
    },
  });
  const seedFn = useServerFn(adminDemo);
  async function refresh() {
    await qc.invalidateQueries();
  }
  const accountFn = useServerFn(adminAccount);
  async function save(action: string, id: string | null, payload: AdminRow = {}) {
    setBusy(true);
    try {
      if (id && (action === "ban" || action === "unban" || action === "delete_user"))
        await accountFn({ data: { action, user: id } });
      else await adminWrite(action, id, payload);
      setEditor(null);
      setPending(null);
      setMenu(null);
      toast.success(t("batch7.saved"));
      await refresh();
    } catch (e) {
      toast.error(
        (e as { message?: string })?.message?.includes("reason_required")
          ? t("batch7.noReason")
          : t("batch7.actionFailed"),
      );
    } finally {
      setBusy(false);
    }
  }
  async function reviewCreator(id: string, approve: boolean) {
    setBusy(true);
    const { error } = await supabase.rpc("review_creator_request", { _request_id: id, _approve: approve, _note: "" });
    setBusy(false);
    if (error) toast.error(t("batch7.actionFailed"));
    else { toast.success(t("batch7.saved")); await refresh(); }
  }
  async function demoAction(action: "seed" | "clear" | "reseed") {
    setBusy(true);
    try {
      await seedFn({ data: { action } });
      toast.success(t(`batch7.${action === "clear" ? "cleared" : "seeded"}`));
      setPending(null);
      await refresh();
    } catch {
      toast.error(t("batch7.actionFailed"));
    } finally {
      setBusy(false);
    }
  }
  function confirm(action: string, id: string | null, payload: AdminRow = {}, demo = false) {
    setReason("");
    setPending({ action, id, payload, demo });
  }
  function change(s: AdminSection) {
    setPage(0);
    setTarget(null);
    setSearch("");
    setMenu(null);
    setDrawer(false);
    void nav({ to: "/admin", search: { section: s } });
  }
  const a = (key: string) => t(`batch7.${key}`);
  const actionButton = (
    label: string,
    onClick: () => void,
    variant: "secondary" | "lime" | "danger" | "ghost" = "secondary",
  ) => (
    <StickerButton size="sm" variant={variant} disabled={busy} onClick={onClick}>
      {a(label)}
    </StickerButton>
  );
  if (q.isLoading)
    return (
      <div className="admin-loading">
        <Brand />
        <p>{t("common.loading")}</p>
      </div>
    );
  if (q.error || !q.data) {
    const forbidden = q.error?.message === "forbidden" || (q.error as { code?: string })?.code === "42501";
    return (
      <div className="admin-loading">
        <ShieldAlert className="size-12" />
        <h1>{forbidden ? a("noAccess") : t("common.error")}</h1>
        {!forbidden && <StickerButton disabled={q.isFetching} onClick={() => void q.refetch()}>{t("common.retry")}</StickerButton>}
        <Link to="/" className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-ink px-5 font-extrabold text-lime sticker-border">
          <ArrowLeft className="rtl:rotate-180" />
          {a("back")}
        </Link>
      </div>
    );
  }
  const data = q.data;
  const seasonPlan = data.season ? planFor(data.season.starts_on, data.season.ends_on, data.day) : null;
  const number = new Intl.NumberFormat(numberLocale(i18n.language));
  const table = (
    columns: string[],
    rows: AdminRow[],
    render: (r: AdminRow, key: string) => React.ReactNode,
  ) => (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            {columns.map((k) => (
              <th key={k}>{a(k)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={str(r, "id") || i}>
              {columns.map((k) => (
                <td key={k}>{render(r, k)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="p-8 text-center font-semibold">{a("empty")}</p>}
    </div>
  );
  const rows = data.rows ?? [];
  return (
    <div className="admin-shell">
      {drawer && <div className="admin-drawer-backdrop" onClick={() => setDrawer(false)} />}
      <aside className={`admin-sidebar ${drawer ? "is-open" : ""}`}>
        <div className="admin-sidebar-brand">
          <Brand size={42} />
          <strong className="text-[22px]">admin</strong>
          <StickerButton
            variant="ghost"
            className="admin-drawer-close !px-2"
            onClick={() => setDrawer(false)}
            aria-label={t("common.close")}
          >
            <X />
          </StickerButton>
        </div>
        <span className="admin-super-pill">{a("superAdmin")}</span>
        <nav className="admin-nav">
          {ADMIN_SECTIONS.map((s, i) => {
            const Icon = icons[i] ?? LayoutDashboard;
            return (
              <StickerButton
                key={s}
                variant="ghost"
                className={`admin-nav-item ${section === s ? "is-active" : ""}`}
                aria-current={section === s ? "page" : undefined}
                onClick={() => change(s)}
              >
                <Icon className="size-5 shrink-0" />
                <span>{a(s)}</span>
                {s === "moderation" && Number(data.open_reports ?? 0) > 0 && (
                  <Num className="admin-nav-count">{data.open_reports}</Num>
                )}
              </StickerButton>
            );
          })}
        </nav>
        <Link to="/today" className="admin-account">
          <Avatar id={data.me.id} name={data.me.display_name} url={data.me.avatar_url} size={46} />
          <span>
            <strong>{data.me.display_name}</strong>
            <small>{a("superAdmin")}</small>
          </span>
        </Link>
      </aside>
      <main className="admin-main">
        <header className="admin-topbar">
          <div className="admin-heading">
            <StickerButton
              className="admin-menu-button !px-2"
              variant="secondary"
              onClick={() => setDrawer(true)}
              aria-label={a("overview")}
            >
              <Menu />
            </StickerButton>
            <h1>{a(section)}</h1>
          </div>
          <div className="admin-top-actions">
            {data.season && seasonPlan && (
              <span className="admin-season-pill">
                {loc(data.season.name, i18n.language)} · <Num>{number.format(seasonPlan.day)}/{number.format(seasonPlan.total)}</Num>
              </span>
            )}
            {data.sample && (
              <StickerButton
                variant="ghost"
                size="sm"
                className="admin-sample-pill num"
                aria-pressed={showDemo}
                aria-label={t("integrity.showDemo")}
                onClick={() => setShowDemo((v) => !v)}
              >
                {showDemo ? a("sample") : t("integrity.realPlayers")}
              </StickerButton>
            )}
            {guests.data && <span className="admin-season-pill">{t("guest.sessionsToday")} · <Num>{guests.data.today}</Num></span>}
            <div className="admin-language">
              {(["en", "ar"] as const).map((l) => (
                <StickerButton
                  key={l}
                  variant="ghost"
                  aria-pressed={i18n.language === l}
                  className={i18n.language === l ? "is-active" : ""}
                  onClick={() => applyLang(l)}
                >
                  {l === "en" ? "EN" : "ع"}
                </StickerButton>
              ))}
            </div>
            <StickerButton size="sm" onClick={() => setEditor({ kind: "season" })}>
              <Plus className="size-4" />
              {a("newSeason")}
            </StickerButton>
          </div>
        </header>
        <div className="admin-page-actions">
          {section === "demo" ? (
            <>
              <StickerButton disabled={busy} onClick={() => void demoAction("seed")}>
                <Database className="size-4" />
                {busy ? a("working") : a("seed")}
              </StickerButton>
              {actionButton("reseed", () => confirm("reseed", null, {}, true))}
              {actionButton("clear", () => confirm("clear", null, {}, true), "danger")}
            </>
          ) : (
            <StickerButton size="sm" variant="ghost" disabled={busy} onClick={() => void refresh()}>
              <RefreshCw className="size-4" />
              {a("refresh")}
            </StickerButton>
          )}
          {section === "seasons" && actionButton("newBoss", () => setEditor({ kind: "boss" }))}
          {section === "habits" && actionButton("newHabit", () => setEditor({ kind: "habit" }))}
          {section === "creators" &&
            actionButton("newReferral", () => setEditor({ kind: "referral" }))}
          {section === "broadcast" &&
            actionButton("newBroadcast", () => setEditor({ kind: "announcement" }))}
        </div>
        {section === "overview" && <AdminOverview data={data} />}
        {section === "moderation" && !showDemo && <AdminModerationAppeals />}
        {section === "seasons" && !showDemo && <OfficialEventsAdmin />}
        {section === "seasons" && (
          <>
            <div className="admin-section-title">
              <h2>{a("seasons")}</h2>
              <select
                className={`${inputCls} !w-auto`}
                aria-label={a("season")}
                value={target ?? data.season?.id ?? ""}
                onChange={(e) => setTarget(e.target.value)}
              >
                {rows.map((r) => (
                  <option key={str(r, "id")} value={str(r, "id")}>
                    {loc(r["name"], i18n.language)}
                  </option>
                ))}
              </select>
            </div>
            {showDemo && table(["season", "dates", "status", "players", "edit"], rows, (r, k) =>
              k === "season" ? (
                <strong>
                  {loc(r["name"], i18n.language)}
                  {r["is_demo"] === true && (
                    <span className="admin-inline-demo">{a("demoSticker")}</span>
                  )}
                </strong>
              ) : k === "dates" ? (
                <Num>
                  {str(r, "starts_on")} → {str(r, "ends_on")}
                </Num>
              ) : k === "status" ? (
                <span className="admin-status bg-lime">{a(str(r, "status"))}</span>
              ) : k === "players" ? (
                <Num>{str(r, "players")}</Num>
              ) : (
                <div className="flex gap-2">
                  {actionButton("edit", () => setEditor({ kind: "season", row: r }))}
                  {actionButton("archive", () => confirm("archive_season", str(r, "id")), "ghost")}
                </div>
              ),
            )}
            <h2 className="admin-section-title">
              {a("bosses")} ·{" "}
              {loc(
                rows.find((r) => str(r, "id") === (target ?? data.season?.id))?.["name"],
                i18n.language,
              )}
            </h2>
            <div className="admin-boss-grid">
              {(data.bosses ?? []).map((r) => {
                const now = Date.now();
                const live =
                  new Date(str(r, "starts_at")).getTime() <= now &&
                  new Date(str(r, "ends_at")).getTime() >= now;
                const done = new Date(str(r, "ends_at")).getTime() < now;
                return (
                  <article
                    key={str(r, "id")}
                    className={`admin-boss ${live ? "bg-yellow" : done ? "bg-cream" : "bg-card"}`}
                  >
                    <div className="flex justify-between">
                      <Num>
                        {a("week_no").toUpperCase()} {str(r, "week_no")}
                      </Num>
                      <span className="admin-status bg-card">
                        {a(live ? "live" : done ? "done" : "upcoming")}
                      </span>
                    </div>
                    <h3>{loc(r["name"], i18n.language)}</h3>
                    <p>
                      {r["sponsor"] ? `${a("sponsor")}: ${str(r, "sponsor")}` : a("sponsorOpen")}
                    </p>
                    <div className="mt-4 flex gap-2">
                      {actionButton("edit", () => setEditor({ kind: "boss", row: r }))}
                      {actionButton(
                        "archive",
                        () => confirm("archive_boss", str(r, "id")),
                        "ghost",
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
        {section === "moderation" && (
          <>
            <div className="admin-moderation-grid">
              {rows.map((r) => (
                <article className="admin-moderation" key={str(r, "id")}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <bdi dir="ltr" className="font-extrabold">
                      @{str(r, "handle")}
                    </bdi>
                    <span className="admin-status bg-yellow">
                      {str(r, "reasons") || a("filtered_post")} · <Num>{str(r, "reports")}</Num>
                    </span>
                  </div>
                  <p className="my-6 whitespace-pre-wrap break-words text-[16px] font-semibold">
                    {str(r, "body")}
                  </p>
                  {typeof r["image_url"] === "string" && <AdminProofThumbnail post={str(r, "id")} />}
                  <div className="flex flex-wrap gap-2">
                    {actionButton("keep", () => void save("keep_post", str(r, "id")), "lime")}
                    {actionButton("remove", () => confirm("remove_post", str(r, "id")))}
                    {actionButton("ban", () => confirm("ban", str(r, "user_id")), "danger")}
                  </div>
                </article>
              ))}
            </div>
            {rows.length === 0 && <p className="py-10">{a("empty")}</p>}
            <section className="admin-settings-band">
              <h2>{a("filters")}</h2>
              <Switch
                checked={data.flags?.["auto_flag_links"] ?? true}
                onChange={(b) => void save("flag", null, { key: "auto_flag_links", enabled: b })}
                label={a("links")}
              />
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void save("word_filter", null, { word, language: wordLang }).then(() =>
                    setWord(""),
                  );
                }}
                className="flex flex-wrap items-center gap-3"
              >
                <select
                  className={`${inputCls} !w-auto`}
                  value={wordLang}
                  aria-label={a("language")}
                  onChange={(e) => setWordLang(e.target.value)}
                >
                  {["en", "fr", "ar", "aeb"].map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
                <input
                  className={`${inputCls} !w-auto grow`}
                  value={word}
                  required
                  aria-label={a("word")}
                  onChange={(e) => setWord(e.target.value)}
                />
                <StickerButton type="submit" size="sm">
                  <Plus className="size-4" />
                  {a("addFilter")}
                </StickerButton>
              </form>
              <div className="mt-4 flex flex-wrap gap-3">
                {(data.filters ?? []).map((r) => (
                  <StickerButton
                    key={str(r, "id")}
                    size="sm"
                    variant="secondary"
                    onClick={() => void save("delete_filter", str(r, "id"))}
                  >
                    {str(r, "language")} · {str(r, "word")}
                    <X className="size-4" />
                  </StickerButton>
                ))}
              </div>
            </section>
          </>
        )}
        {section === "users" && (
          <>
            <div className="admin-search">
              <Search className="size-5" />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                placeholder={a("search")}
                aria-label={a("search")}
              />
            </div>
            {table(
              ["user", "country", "crew", "streak", "points", "role", "status", "action"],
              rows,
              (r, k) =>
                k === "user" ? (
                  <div className="flex items-center gap-3">
                    <Avatar
                      id={str(r, "id")}
                      name={str(r, "display_name")}
                      url={r["avatar_url"] as string | null}
                      size={38}
                    />
                    <div>
                      <strong className="block">{str(r, "display_name")}</strong>
                      <bdi dir="ltr" className="text-[12px]">
                        @{str(r, "handle")}
                      </bdi>
                    </div>
                  </div>
                ) : k === "country" ? (
                  str(r, "country_code")
                ) : k === "status" ? (
                  <span
                    className={`admin-status ${r["account_status"] === "active" ? "bg-lime" : "bg-pink"}`}
                  >
                    {a(str(r, "account_status"))}
                  </span>
                ) : k === "role" ? (
                  <select
                    aria-label={`${a("role")} ${str(r, "handle")}`}
                    disabled={r["is_demo"] === true || str(r, "id") === data.me.id}
                    className="admin-role-select"
                    value={str(r, "role")}
                    onChange={(e) => confirm("role", str(r, "id"), { role: e.target.value })}
                  >
                    {["user", "creator", "admin"].map((role) => (
                      <option key={role} value={role}>
                        {a(`${role}Role`)}
                      </option>
                    ))}
                  </select>
                ) : k === "action" ? (
                  <div className="relative">
                    <StickerButton
                      variant="ghost"
                      size="sm"
                      aria-label={`${a("action")} ${str(r, "handle")}`}
                      onClick={() => setMenu(menu === str(r, "id") ? null : str(r, "id"))}
                    >
                      <MoreHorizontal />
                    </StickerButton>
                    {menu === str(r, "id") && (
                      <div className="admin-row-menu">
                        {actionButton(
                          "profile",
                          () => {
                            setDetail(r);
                            setMenu(null);
                          },
                          "ghost",
                        )}
                        {r["is_demo"] !== true && (
                          <>
                            {actionButton(
                              r["account_status"] === "banned" ? "unban" : "ban",
                              () =>
                                confirm(
                                  r["account_status"] === "banned" ? "unban" : "ban",
                                  str(r, "id"),
                                ),
                              "ghost",
                            )}
                            {actionButton(
                              "resetStreak",
                              () => confirm("reset_streak", str(r, "id")),
                              "ghost",
                            )}
                            {actionButton(
                              "delete",
                              () => confirm("delete_user", str(r, "id")),
                              "danger",
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ) : ["streak", "points"].includes(k) ? (
                  <Num>{str(r, k)}</Num>
                ) : (
                  str(r, k)
                ),
            )}
          </>
        )}
        {section === "creators" && (
          <>
            {table(["user", "code", "signups", "share", "action"], rows, (r, k) =>
              k === "user" ? (
                <strong>@{str(r, "handle")}</strong>
              ) : k === "share" ? (
                actionButton("copy", () => {
                  void navigator.clipboard.writeText(str(r, "code"));
                  toast.success(a("saved"));
                })
              ) : k === "action" ? (
                actionButton(
                  r["featured"] ? "featured" : "feature",
                  () => void save("feature_creator", str(r, "id"), { featured: !r["featured"] }),
                )
              ) : k === "signups" ? (
                <Num>{str(r, k) || 0}</Num>
              ) : (
                <bdi dir="ltr">{str(r, k)}</bdi>
              ),
            )}
            <div className="admin-pass-grid">
              <article className="admin-kpi bg-yellow">
                <p>{a("sponsored")}</p>
                <Num className="admin-kpi-value">
                  {data.sponsored ?? 0} / {data.boss_count ?? 0}
                </Num>
              </article>
            </div>
            <h2 className="admin-section-title">{a("creator_challenges")}</h2>
            {table(["name", "status", "action"], data.challenges ?? [], (r, k) =>
              k === "action"
                ? <div className="flex flex-wrap gap-2">
                    {actionButton(r["approved"] ? "approved" : "approve", () => void save("approve_challenge", str(r, "id")))}
                    {!showDemo && str(r, "season_id") && <ManageCommunity season={str(r, "season_id")} />}
                  </div>
                : k === "status"
                  ? a(r["approved"] ? "approved" : "open")
                  : str(r, k),
            )}
            <h2 className="admin-section-title">{t("batch6.creatorRequests")}</h2>
            {table(["handle", "created_at", "action"], creatorRequests.data ?? [], (r, k) =>
              k === "handle" ? <strong>@{str(r, k)}</strong>
                : k === "action" ? <div className="flex gap-2">
                  <StickerButton size="sm" variant="lime" disabled={busy} onClick={() => void reviewCreator(str(r, "id"), true)}>{t("batch6.approveCreator")}</StickerButton>
                  <StickerButton size="sm" variant="secondary" disabled={busy} onClick={() => void reviewCreator(str(r, "id"), false)}>{t("batch6.rejectCreator")}</StickerButton>
                </div>
                : str(r, k),
            )}
          </>
        )}
        {section === "crews" && (
          <>
            {table(["crew", "members", "owner", "audience", "privacy", "action"], rows, (r, k) =>
              k === "crew" ? (
                <strong>{str(r, "name")}</strong>
              ) : k === "members" ? (
                <Num>{str(r, k)}</Num>
              ) : k === "audience" ? (
                a(str(r, "audience") || str(r, "kind"))
              ) : k === "privacy" ? (
                a(r["is_public"] ? "public" : "private")
              ) : k === "action" ? (
                <div className="flex gap-2">
                  {actionButton("members", () => setTarget(str(r, "id")))}
                  {!showDemo && str(r, "season_id") && <ManageCommunity season={str(r, "season_id")} crew={str(r, "id")} />}
                  {actionButton("disband", () => confirm("disband_crew", str(r, "id")), "danger")}
                </div>
              ) : (
                str(r, k)
              ),
            )}
            {target && (
              <section className="admin-settings-band">
                <h2>{a("members")}</h2>
                {(data.members ?? []).map((r) => (
                  <p className="py-3 font-bold" key={str(r, "id")}>
                    {str(r, "display_name")} · <bdi dir="ltr">@{str(r, "handle")}</bdi>
                  </p>
                ))}
              </section>
            )}
            <h2 className="admin-section-title">{a("crews")}</h2>
            {table(
              ["name", "members", "owner", "audience", "privacy", "action"],
              data.challenges ?? [],
              (r, k) =>
                k === "privacy"
                  ? a(r["public_board"] ? "public" : "private")
                  : k === "audience"
                    ? a(str(r, k))
                    : k === "action"
                      ? actionButton(
                          "disband",
                          () => confirm("disband_challenge", str(r, "id")),
                          "danger",
                        )
                      : str(r, k),
            )}
          </>
        )}
        {section === "habits" &&
          table(
            ["name", "kind", "default_target", "unit", "is_faith", "sort", "action"],
            rows,
            (r, k) =>
              k === "name" ? (
                loc(r["name"], i18n.language)
              ) : k === "kind" ? (
                a(str(r, k))
              ) : k === "is_faith" ? (
                <Check className={r[k] ? "size-5" : "invisible size-5"} />
              ) : k === "action" ? (
                <div className="flex gap-2">
                  {actionButton("edit", () => setEditor({ kind: "habit", row: r }))}
                  {actionButton("archive", () => confirm("archive_habit", str(r, "id")), "ghost")}
                </div>
              ) : (
                str(r, k)
              ),
          )}
        {section === "anticheat" &&
          table(["user", "reason", "day", "status", "action"], rows, (r, k) =>
            k === "user" ? (
              <bdi dir="ltr">@{str(r, "handle")}</bdi>
            ) : k === "reason" ? (
              a(str(r, "kind"))
            ) : k === "status" ? (
              a(str(r, k))
            ) : k === "action" ? (
              <div className="flex gap-2">
                {actionButton("review", () => void save("review", str(r, "id")))}
                {actionButton("resetDay", () =>
                  confirm("reset_day", str(r, "user_id"), { day: str(r, "day") || data.day }),
                )}
                {actionButton("ban", () => confirm("ban", str(r, "user_id")), "danger")}
              </div>
            ) : (
              <Num>{str(r, k)}</Num>
            ),
          )}
        {section === "broadcast" &&
          table(["title", "body", "target", "scheduled_at", "edit"], rows, (r, k) =>
            k === "title" || k === "body"
              ? loc(r[k], i18n.language)
              : k === "target"
                ? `${str(r, "country") || a("all")} · ${str(r, "language") || a("all")}`
                : k === "edit"
                  ? actionButton("edit", () => setEditor({ kind: "announcement", row: r }))
                  : new Intl.DateTimeFormat(i18n.language === "ar" ? "ar-TN" : "en-GB", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      numberingSystem: "latn",
                    }).format(new Date(str(r, k))),
          )}
        {section === "flags" && (
          <section className="admin-settings-band">
            {rows
              .filter((r) => str(r, "key") !== "auto_flag_links")
              .map((r) => (
                <Switch
                  key={str(r, "key")}
                  label={a(str(r, "key"))}
                  checked={r["enabled"] === true}
                  onChange={(b) => void save("flag", null, { key: str(r, "key"), enabled: b })}
                />
              ))}
          </section>
        )}
        {section === "demo" && (
          <>
            <div className="admin-demo-status">
              <Database className="size-8" />
              <strong>{a(data.demo_counts.posts ? "demoReady" : "demoEmpty")}</strong>
              {data.demo_counts.posts > 0 && (
                <span className="admin-sample-pill">
                  {a("demoDate")} · <Num>{data.day}</Num>
                </span>
              )}
            </div>
            <div className="admin-kpis">
              {(["profiles", "posts", "crews", "checkins"] as const).map((key, i) => (
                <article
                  className={`admin-kpi ${["bg-lime", "bg-blue", "bg-yellow", "bg-pink"][i]}`}
                  key={key}
                >
                  <p>
                    {a(
                      `demo${key === "profiles" ? "Profiles" : key === "posts" ? "Posts" : key === "crews" ? "Crews" : "Checkins"}`,
                    )}
                  </p>
                  <Num className="admin-kpi-value">{data.demo_counts[key]}</Num>
                </article>
              ))}
            </div>
            <Link to="/" className="inline-flex mt-6">
              <StickerButton variant="secondary">
                <Eye className="size-5" />
                {t("design.demo")}
              </StickerButton>
            </Link>
          </>
        )}
        {section === "audit" &&
          table(["actor", "action", "target", "payload", "created"], rows, (r, k) =>
            k === "actor" ? (
              str(r, "admin_name")
            ) : k === "created" ? (
              <Num>
                {new Date(str(r, "created_at")).toLocaleString(
                  i18n.language === "ar" ? "ar-TN" : "en-GB",
                  { numberingSystem: "latn" },
                )}
              </Num>
            ) : k === "payload" ? (
              <details>
                <summary className="min-h-11 cursor-pointer font-bold">{a("payload")}</summary>
                <pre className="max-w-72 whitespace-pre-wrap break-words text-[12px]">
                  {JSON.stringify(r["payload"], null, 2)}
                </pre>
              </details>
            ) : (
              <span className="break-all">{str(r, k)}</span>
            ),
          )}
        {["users", "audit"].includes(section) && (
          <div className="admin-pagination">
            <span>
              <Num>
                {page * 20 + 1}–{Math.min((page + 1) * 20, data.total)} / {data.total}
              </Num>
            </span>
            <StickerButton
              size="sm"
              variant="secondary"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              aria-label={a("previous")}
            >
              <ChevronLeft className="size-5 rtl:rotate-180" />
            </StickerButton>
            <StickerButton
              size="sm"
              variant="secondary"
              disabled={(page + 1) * 20 >= data.total}
              onClick={() => setPage((p) => p + 1)}
              aria-label={a("next")}
            >
              <ChevronRight className="size-5 rtl:rotate-180" />
            </StickerButton>
          </div>
        )}
      </main>
      {editor && (
        <AdminEditor
          kind={editor.kind}
          {...(editor.row ? { row: editor.row } : {})}
          seasonId={target ?? data.season?.id ?? ""}
          busy={busy}
          onClose={() => setEditor(null)}
          onSave={save}
        />
      )}
      <BottomSheet
        open={!!pending}
        onClose={() => setPending(null)}
        title={a(pending?.demo ? "clearTitle" : "confirmAction")}
      >
        <p className="font-semibold">{a(pending?.demo ? "clearHint" : "confirmHint")}</p>
        {pending && requiresReason(pending.action) && (
          <label className="mt-4 block font-bold">
            {a("reason")}
            <input
              className={`${inputCls} mt-2`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
        )}
        <div className="mt-5 flex gap-3">
          <StickerButton variant="secondary" onClick={() => setPending(null)}>
            {a("cancel")}
          </StickerButton>
          <StickerButton
            disabled={
              busy || (!!pending && requiresReason(pending.action) && reason.trim().length < 3)
            }
            onClick={() => {
              if (!pending) return;
              if (pending.demo) void demoAction(pending.action as "clear" | "reseed");
              else
                void save(pending.action, pending.id, {
                  ...pending.payload,
                  ...(requiresReason(pending.action) ? { reason } : {}),
                });
            }}
          >
            {busy ? a("working") : a("confirm")}
          </StickerButton>
        </div>
      </BottomSheet>
      <BottomSheet
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? str(detail, "display_name") : ""}
      >
        {detail && (
          <>
            <Avatar id={str(detail, "id")} name={str(detail, "display_name")} size={64} />
            <bdi dir="ltr" className="mt-3 block font-bold">
              @{str(detail, "handle")}
            </bdi>
            <dl className="mt-4 grid grid-cols-2 gap-4">
              {["country_code", "crew", "streak", "points", "role", "account_status"].map((k) => (
                <div key={k}>
                  <dt className="text-[12px]">
                    {a(k === "country_code" ? "country" : k === "account_status" ? "status" : k)}
                  </dt>
                  <dd className="font-extrabold">{str(detail, k)}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </BottomSheet>
    </div>
  );
}
