import { pageHead } from "@/lib/page-head";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ArrowRight, Copy, Hand, Plus, Share2, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/lezgo/app-shell";
import { FlameIcon } from "@/components/lezgo/icons";
import { Avatar, BottomSheet, Chip, Field, Num, StickerButton, StickerCard, colorFor, inputCls } from "@/components/lezgo/ui";
import { errKey, myCrewQuery, useBase } from "@/lib/data";
import { loc } from "@/lib/i18n";
import { msToMidnight, pad, splitMs, useNow } from "@/lib/time";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/crew")({
  head: () => pageHead("Crew — lezgo", "See who in your crew showed up today."),
  component: CrewPage,
});

type Member = { user_id: string; display_name: string; handle: string; avatar_url: string | null; total: number; done: number;
  missing: ({ name: Record<string, string> } | { private: true })[]; points: number; perfect: boolean; nudged: boolean };
type CrewToday = { crew: { id: string; name: string; code: string; kind: string; max_members: number; rank: number }; members: Member[]; week: boolean[] };
type Activity = { id: string; created_at: string; user_id: string; display_name: string; avatar_url: string | null; habit: Record<string, string> | null; respects: number; respected: boolean };

const link = (code: string) => `https://joinlezgo.com/c/${code}`;

function CrewPage() {
  const { uid, season } = useBase();
  const mine = useQuery({ ...myCrewQuery(uid, season?.id ?? ""), enabled: !!uid && !!season });
  return <AppShell>{mine.isLoading || !season ? null : mine.data ? <CrewToday crewId={mine.data} /> : <NoCrew />}</AppShell>;
}

function ShareSheet({ code, open, onClose }: { code: string; open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <BottomSheet open={open} onClose={onClose} title={t("crew.shareTitle")}>
      <p className="text-[15px] font-semibold text-muted-foreground">{t("crew.shareBody")}</p>
      <div className="mt-3 rounded-[18px] bg-lime p-4 text-center sticker-border shadow-hard">
        <Num className="text-[40px] font-bold tracking-[0.25em]">{code}</Num>
        <p className="mt-1 break-all text-[14px] font-bold"><bdi dir="ltr">{link(code)}</bdi></p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <StickerButton variant="secondary" onClick={async () => { await navigator.clipboard.writeText(link(code)); toast(t("crew.copied")); }}>
          <Copy strokeWidth={2.5} className="size-5" />{t("crew.copy")}</StickerButton>
        <StickerButton onClick={async () => {
          const text = t("crew.inviteText", { code });
          try { if (navigator.share) await navigator.share({ text, url: link(code) }); else { await navigator.clipboard.writeText(`${text} ${link(code)}`); toast(t("crew.copied")); } } catch { /* cancelled */ }
        }}><Share2 strokeWidth={2.5} className="size-5" />{t("crew.shareBtn")}</StickerButton>
      </div>
    </BottomSheet>
  );
}

function NoCrew() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [open, setOpen] = useState<"create" | "join" | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"duo" | "squad" | "club" | "company">("squad");
  const [size, setSize] = useState(8);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  const fail = (e: unknown) => { const k = errKey(e); toast(k ? t(`crew.err_${k}`) : t("common.error")); };

  async function create() {
    setBusy(true);
    const { data, error } = await supabase.rpc("create_crew", { _name: name.trim(), _kind: kind, _max_members: kind === "duo" ? 2 : size });
    setBusy(false);
    if (error) return fail(error);
    setOpen(null); setCreated(data as string);
  }
  async function join() {
    setBusy(true);
    const { error } = await supabase.rpc("join_crew", { _code: code });
    setBusy(false);
    if (error) return fail(error);
    void qc.invalidateQueries();
  }
  return (
    <>
      <h1 className="mb-4 text-[30px] font-extrabold">{t("crew.noneTitle")}</h1>
      <div className="space-y-4">
        <button type="button" onClick={() => setOpen("create")} className="press block w-full rounded-[22px] bg-lime p-5 text-start sticker-border shadow-hard">
          <Plus strokeWidth={3} className="size-8" /><p className="mt-3 text-[24px] font-extrabold">{t("crew.create")}</p>
          <p className="text-[15px] font-semibold">{t("crew.createDesc")}</p>
        </button>
        <button type="button" onClick={() => setOpen("join")} className="press block w-full rounded-[22px] bg-blue p-5 text-start sticker-border shadow-hard">
          <UserPlus strokeWidth={2.5} className="size-8" /><p className="mt-3 text-[24px] font-extrabold">{t("crew.join")}</p>
          <p className="text-[15px] font-semibold">{t("crew.joinDesc")}</p>
        </button>
      </div>

      <BottomSheet open={open === "create"} onClose={() => setOpen(null)} title={t("crew.create")}>
        <div className="space-y-4">
          <Field label={t("crew.name")}><input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} className={inputCls} /></Field>
          <div><span className="mb-1.5 block text-[14px] font-extrabold">{t("crew.type")}</span>
            <div className="flex flex-wrap gap-2">{(["duo", "squad", "club", "company"] as const).map((k) => <Chip key={k} active={kind === k} onClick={() => setKind(k)}>{t(`crew.${k}`)}</Chip>)}</div></div>
          {kind !== "duo" && (
            <Field label={<>{t("crew.size")}: <Num>{size}</Num></>}>
              <input type="range" min={3} max={50} value={size} onChange={(e) => setSize(Number(e.target.value))} className="w-full accent-[var(--ink)]" />
            </Field>
          )}
          <StickerButton block disabled={busy || !name.trim()} onClick={create}>{t("crew.create")}</StickerButton>
        </div>
      </BottomSheet>
      <BottomSheet open={open === "join"} onClose={() => setOpen(null)} title={t("crew.join")}>
        <Field label={t("crew.code")}>
          <input dir="ltr" value={code} maxLength={6} placeholder="ABC123" onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
            className={`${inputCls} num text-center text-[26px] tracking-[0.3em]`} />
        </Field>
        <StickerButton block className="mt-4" disabled={busy || code.length !== 6} onClick={join}>{t("crew.joinBtn")}</StickerButton>
      </BottomSheet>
      {created && <ShareSheet code={created} open onClose={() => { setCreated(null); void qc.invalidateQueries(); }} />}
    </>
  );
}

function CrewToday({ crewId }: { crewId: string }) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const { uid, tz } = useBase();
  const now = useNow();
  const [share, setShare] = useState(false);
  const q = useQuery({ queryKey: ["crewToday", crewId], queryFn: async () => {
    const { data, error } = await supabase.rpc("crew_today", { _crew_id: crewId }); if (error) throw error; return data as unknown as CrewToday; } });
  const act = useQuery({ queryKey: ["crewActivity", crewId], queryFn: async () => {
    const { data, error } = await supabase.rpc("crew_activity", { _crew_id: crewId }); if (error) throw error; return data as unknown as Activity[]; } });
  if (!q.data) return <p className="py-10 text-center">{t("common.loading")}</p>;
  const { crew, members, week } = q.data;
  const doneCount = members.filter((m) => m.perfect || (m.total > 0 && m.done >= m.total)).length;
  const allDone = members.length > 1 && doneCount === members.length;
  const left = splitMs(now ? msToMidnight(tz, now) : 0);
  const name = (m: Member["missing"][number]) => ("private" in m ? t("crew.private") : loc(m.name, i18n.language));

  async function nudge(m: Member) {
    const { error } = await supabase.rpc("send_nudge", { _to_user: m.user_id });
    if (error) { toast(t("common.error")); return; }
    toast(t("crew.nudgeToast", { name: m.display_name }));
    void qc.invalidateQueries({ queryKey: ["crewToday", crewId] });
  }
  async function respect(a: Activity) {
    await supabase.rpc("toggle_respect", { _checkin_id: a.id });
    void qc.invalidateQueries({ queryKey: ["crewActivity", crewId] });
  }

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[30px] font-extrabold leading-tight">{t("crew.title")}</h1>
          <Link to="/crew-details" className="block min-h-11 truncate text-[15px] font-bold text-muted-foreground underline">{crew.name} · {t("crew.membersCount", { n: members.length })}</Link>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <Chip as="span" active><Num>#{crew.rank}</Num></Chip>
          <Chip onClick={() => setShare(true)}><UserPlus strokeWidth={2.5} className="size-4" />{t("crew.invite")}</Chip>
        </div>
      </div>

      <StickerCard className={cn("mt-4", allDone ? "bg-lime" : "bg-card")}>
        <div className="flex items-center gap-2"><FlameIcon size={30} dim={doneCount === 0} />
          <p className="text-[24px] font-extrabold">{t("crew.doneOf", { done: doneCount, total: members.length })}</p></div>
        <p className="mt-1 text-[15px] font-bold">{allDone ? t("crew.allDone") : members.length > 1 ? t("crew.oneMore", { n: members.length - doneCount }) : t("crew.shareBody")}</p>
        <div className="mt-3 flex gap-1.5">
          {members.map((m) => {
            const done = m.perfect || (m.total > 0 && m.done >= m.total);
            return <span key={m.user_id} className={cn("h-4 flex-1 rounded-full", done ? `${colorFor(m.user_id)} sticker-border` : "dashed-ink")} />;
          })}
        </div>
        <p className="mt-4 text-[13px] font-extrabold uppercase text-muted-foreground">{t("crew.allIn")}</p>
        <div className="mt-1.5 grid grid-cols-7 gap-1.5">
          {week.map((w, i) => (
            <div key={i} className="text-center">
              <span className={cn("block aspect-square rounded-[8px]", w ? "bg-lime sticker-border" : "dashed-ink")} />
              <span className="text-[12px] font-bold">{(t("crew.wd", { returnObjects: true }) as string[])[i]}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[15px] font-bold">{t("crew.closesIn")} <Num className="font-bold">{pad(left.h)}:{pad(left.m)}:{pad(left.s)}</Num></p>
      </StickerCard>

      <h2 className="mt-6 mb-2 text-[20px] font-extrabold">{t("crew.who")}</h2>
      <div className="space-y-3">
        {members.map((m) => {
          const done = m.perfect || (m.total > 0 && m.done >= m.total);
          return (
            <div key={m.user_id} className={cn("flex h-16 items-center gap-3 rounded-[18px] px-3", done ? "bg-card sticker-border shadow-hard-sm" : "dashed-orange bg-card")}>
              <Avatar id={m.user_id} name={m.display_name} url={m.avatar_url} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[16px] font-extrabold">{m.display_name}</p>
                {done ? (
                  <p className="truncate text-[13px] font-bold text-success">{t("crew.doneLine", { done: m.done, total: m.total })} · <Num>+{m.points}</Num></p>
                ) : (
                  <p className="truncate text-[13px] font-bold text-warning">{t("crew.left", { n: m.total - m.done })}{m.missing.length > 0 && " · " + m.missing.map(name).join(", ")}</p>
                )}
              </div>
              {!done && m.user_id !== uid && (
                <StickerButton variant="yellow" disabled={m.nudged} onClick={() => nudge(m)}>
                  <Hand strokeWidth={2.5} className="size-4" />{m.nudged ? t("crew.nudged") : t("crew.nudge")}</StickerButton>
              )}
            </div>
          );
        })}
      </div>

      <h2 className="mt-6 mb-2 text-[20px] font-extrabold">{t("crew.activity")}</h2>
      <div className="space-y-2">
        {(act.data ?? []).length === 0 && <p className="text-[15px] font-semibold text-muted-foreground">{t("crew.noActivity")}</p>}
        {(act.data ?? []).map((a) => (
          <div key={a.id} className="flex min-h-[62px] items-center gap-3 rounded-[16px] bg-card px-3 sticker-border">
            <Avatar id={a.user_id} name={a.display_name} url={a.avatar_url} size={36} />
            <p className="min-w-0 flex-1 truncate text-[15px] font-bold">{a.display_name} · <span className="text-muted-foreground">{a.habit ? loc(a.habit, i18n.language) : t("crew.private")}</span></p>
            {a.user_id !== uid && (
              <Chip active={a.respected} onClick={() => respect(a)}>{t("crew.respect")}{a.respects > 0 && <Num> {a.respects}</Num>}</Chip>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6">
        <Link to="/today" className="block"><StickerButton block>{t("crew.next")}<ArrowRight strokeWidth={3} className="size-5 rtl:-scale-x-100" /></StickerButton></Link>
      </div>
      <ShareSheet code={crew.code} open={share} onClose={() => setShare(false)} />
    </>
  );
}
