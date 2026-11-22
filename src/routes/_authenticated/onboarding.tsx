import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, Ghost, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Brand } from "@/components/lezgo/brand";
import { LangGrid } from "@/components/lezgo/lang-switcher";
import { Field, StickerButton, inputCls } from "@/components/lezgo/ui";
import { HabitPicker, saveHabits, type Pick } from "@/components/lezgo/habit-picker";
import { errKey, habitsQuery, templatesQuery, useBase } from "@/lib/data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Get started — lezgo" }, { name: "description", content: "Set up your lezgo season in two steps." }] }),
  component: Onboarding,
});

const COUNTRIES = ["TN", "DZ", "MA", "LY", "EG", "FR", "BE", "CA", "DE", "IT", "US", "GB", "SA", "AE", "QA"];

function Onboarding() {
  const { t, i18n } = useTranslation();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { uid, profile, season } = useBase();
  const templates = useQuery(templatesQuery);
  const existing = useQuery({ ...habitsQuery(uid, season?.id ?? ""), enabled: !!uid && !!season });
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [country, setCountry] = useState("TN");
  const [handleState, setHandleState] = useState<"ok" | "taken" | "bad" | "idle">("idle");
  const [picks, setPicks] = useState<Pick[]>([]);
  const [mode, setMode] = useState<"solo" | "crew">("solo");
  const [crewName, setCrewName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setName(profile.display_name); setHandle(profile.handle); setCountry(profile.country_code);
    const pc = sessionStorage.getItem("lezgo_pending_code");
    if (pc) { setMode("crew"); setCode(pc); }
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    if (!/^[a-z0-9_]{3,20}$/.test(handle)) { setHandleState("bad"); return; }
    if (handle === profile.handle) { setHandleState("ok"); return; }
    const id = setTimeout(async () => {
      const { data } = await supabase.rpc("handle_available", { _handle: handle });
      setHandleState(data ? "ok" : "taken");
    }, 350);
    return () => clearTimeout(id);
  }, [handle, profile]);

  async function finish() {
    if (!season || !profile) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("profiles").update({ display_name: name.trim() || profile.display_name, handle, country_code: country, language: i18n.language, onboarded: true }).eq("id", uid);
      if (error) throw error;
      await saveHabits(uid, season.id, picks, existing.data ?? []);
      let goCrew = false;
      if (mode === "crew" && code.length === 6) { await supabase.rpc("join_crew", { _code: code }).throwOnError(); goCrew = true; }
      else if (mode === "crew" && crewName.trim()) { await supabase.rpc("create_crew", { _name: crewName.trim(), _kind: "squad", _max_members: 8 }).throwOnError(); goCrew = true; }
      else await supabase.rpc("join_season", { _season_id: season.id, _mode: "solo" }).throwOnError();
      sessionStorage.removeItem("lezgo_pending_code");
      await qc.invalidateQueries();
      void nav({ to: goCrew ? "/crew" : "/today" });
    } catch (e) {
      const k = errKey(e);
      toast(k ? t(`crew.err_${k}`, { defaultValue: t("common.error") }) : t("common.error"));
    } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[440px] flex-col px-5 pb-8 pt-4">
      <header className="flex items-center justify-between"><Brand size={32} />
        <span className="rounded-full bg-card px-3 py-1 text-[14px] font-bold sticker-border">{t("onb.step", { n: step })}</span></header>

      {step === 1 ? (
        <div className="mt-6 space-y-5">
          <h1 className="text-[32px] font-extrabold">{t("onb.youTitle")}</h1>
          <Field label={t("onb.displayName")}><input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} className={inputCls} /></Field>
          <Field label={t("onb.handle")} hint={<span className={cn("font-bold", handleState === "ok" ? "text-success" : handleState === "idle" ? "" : "text-warning")}>
            {handleState === "ok" ? t("onb.handleOk") : handleState === "taken" ? t("onb.handleTaken") : handleState === "bad" ? t("onb.handleBad") : ""}</span>}>
            <div dir="ltr" className="relative">
              <span className="num absolute start-4 top-1/2 -translate-y-1/2 text-[17px] font-bold text-muted-foreground">@</span>
              <input dir="ltr" value={handle} maxLength={20} onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} className={`${inputCls} num ps-9`} />
            </div>
          </Field>
          <Field label={t("onb.country")}>
            <select dir="ltr" value={country} onChange={(e) => setCountry(e.target.value)} className={inputCls}>
              {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <div><span className="mb-1.5 block text-[14px] font-extrabold">{t("common.language")}</span><LangGrid /></div>
          <StickerButton block size="lg" disabled={handleState !== "ok"} onClick={() => setStep(2)}>
            {t("common.next")} <ArrowRight strokeWidth={3} className="size-5 rtl:-scale-x-100" />
          </StickerButton>
        </div>
      ) : (
        <div className="mt-6">
          <h1 className="mb-3 text-[32px] font-extrabold">{t("onb.habitsTitle")}</h1>
          {templates.data && <HabitPicker templates={templates.data} picks={picks} onChange={setPicks} />}

          <h2 className="mt-8 mb-3 text-[22px] font-extrabold">{t("onb.modeTitle")}</h2>
          <div className="grid grid-cols-2 gap-3">
            {([["solo", Ghost, t("onb.solo"), t("onb.soloDesc")], ["crew", Users, t("onb.crewMode"), t("onb.crewDesc")]] as const).map(([m, I, l, d]) => (
              <button key={m} type="button" onClick={() => setMode(m)}
                className={cn("press min-h-[110px] rounded-[18px] p-3 text-start sticker-border shadow-hard", mode === m ? "bg-lime" : "bg-card")}>
                <I strokeWidth={2.5} className="size-6" /><div className="mt-2 text-[17px] font-extrabold">{l}</div>
                <div className="text-[13px] font-semibold text-muted-foreground">{d}</div>
              </button>
            ))}
          </div>
          {mode === "crew" && (
            <div className="mt-4 space-y-3">
              <Field label={t("onb.crewName")}><input value={crewName} maxLength={40} onChange={(e) => setCrewName(e.target.value)} className={inputCls} disabled={code.length > 0} /></Field>
              <Field label={t("onb.orCode")}>
                <input dir="ltr" value={code} maxLength={6} placeholder="ABC123" onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                  className={`${inputCls} num text-center tracking-[0.3em]`} />
              </Field>
            </div>
          )}
          <div className="mt-8 flex gap-3">
            <StickerButton variant="secondary" onClick={() => setStep(1)}>
              <ArrowRight strokeWidth={3} className="size-5 -scale-x-100 rtl:scale-x-100" /><span className="sr-only">{t("common.back")}</span>
            </StickerButton>
            <StickerButton block size="lg" disabled={busy || picks.length === 0 || (mode === "crew" && code.length !== 6 && !crewName.trim())} onClick={finish}>
              {t("common.cta")}
            </StickerButton>
          </div>
        </div>
      )}
    </div>
  );
}
