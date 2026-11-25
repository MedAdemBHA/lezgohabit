import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Brand } from "@/components/lezgo/brand";
import { LangGrid } from "@/components/lezgo/lang-switcher";
import { Field, StickerButton, inputCls } from "@/components/lezgo/ui";
import { errKey, profileQuery } from "@/lib/data";
import { pageHead } from "@/lib/page-head";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => pageHead("Finish your profile — lezgo", "Add the details on your lezgo profile."),
  component: Onboarding,
});

const COUNTRIES = ["TN", "DZ", "MA", "LY", "EG", "FR", "BE", "CA", "DE", "IT", "US", "GB", "SA", "AE", "QA"];

function Onboarding() {
  const { t, i18n } = useTranslation();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { user } = Route.useRouteContext();
  const profile = useQuery(profileQuery(user.id));
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [country, setCountry] = useState("TN");
  const [handleState, setHandleState] = useState<"ok" | "taken" | "bad" | "idle">("idle");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profile.data) return;
    if (profile.data.onboarded) {
      void nav({ to: "/today", replace: true });
      return;
    }
    setName(profile.data.display_name);
    setHandle(profile.data.handle);
    setCountry(profile.data.country_code);
  }, [profile.data, nav]);

  useEffect(() => {
    if (!profile.data) return;
    if (!/^[a-z0-9_]{3,20}$/.test(handle)) {
      setHandleState("bad");
      return;
    }
    if (handle === profile.data.handle) {
      setHandleState("ok");
      return;
    }
    let active = true;
    const timer = setTimeout(async () => {
      const { data, error } = await supabase.rpc("handle_available", { _handle: handle });
      if (active) setHandleState(error ? "idle" : data ? "ok" : "taken");
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [handle, profile.data]);

  async function finish(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile.data || busy || handleState !== "ok") return;
    setBusy(true);
    try {
      const { error } = await supabase.from("profiles").update({
        display_name: name.trim() || profile.data.display_name,
        handle,
        country_code: country,
        language: i18n.language,
        onboarded: true,
      }).eq("id", user.id);
      if (error) throw error;

      const pendingCode = sessionStorage.getItem("lezgo_pending_code");
      if (pendingCode?.length === 6) await supabase.rpc("join_crew", { _code: pendingCode }).throwOnError();
      sessionStorage.removeItem("lezgo_pending_code");
      await qc.invalidateQueries();
      await nav({ to: "/today", replace: true });
    } catch (error) {
      const key = errKey(error);
      toast(key ? t(`crew.err_${key}`, { defaultValue: t("common.error") }) : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-[440px] px-5 pb-8 pt-4">
      <Link to="/" className="inline-flex" aria-label={t("landing.home")}><Brand size={32} /></Link>
      <h1 className="mt-6 text-[32px] font-extrabold">{t("onb.profileTitle")}</h1>
      {profile.isLoading ? <p role="status">{t("common.loading")}</p> : profile.isError ? (
        <div className="mt-4 space-y-2"><p role="alert">{t("common.error")}</p><StickerButton onClick={() => void profile.refetch()}>{t("common.retry")}</StickerButton></div>
      ) : (
        <form className="mt-5 space-y-5" onSubmit={finish}>
          <Field label={t("onb.displayName")}><input autoComplete="nickname" value={name} maxLength={40} onChange={(event) => setName(event.target.value)} className={inputCls} /></Field>
          <Field label={t("onb.handle")} hint={<span className={cn("font-bold", handleState === "ok" ? "text-success" : handleState === "idle" ? "" : "text-warning")}>
            {handleState === "ok" ? t("onb.handleOk") : handleState === "taken" ? t("onb.handleTaken") : handleState === "bad" ? t("onb.handleBad") : ""}</span>}>
            <div dir="ltr" className="relative">
              <span aria-hidden="true" className="num absolute start-4 top-1/2 -translate-y-1/2 text-[17px] font-bold text-muted-foreground">@</span>
              <input value={handle} maxLength={20} autoComplete="username" onChange={(event) => {
                setHandleState("idle");
                setHandle(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""));
              }} className={`${inputCls} num ps-9`} />
            </div>
          </Field>
          <Field label={t("onb.country")}>
            <select value={country} onChange={(event) => setCountry(event.target.value)} className={inputCls}>
              {COUNTRIES.map((code) => <option key={code} value={code}>{code}</option>)}
            </select>
          </Field>
          <div><span className="mb-1.5 block text-[14px] font-extrabold">{t("common.language")}</span><LangGrid /></div>
          <StickerButton block size="lg" type="submit" disabled={handleState !== "ok" || busy}>
            {t("startFlow.finishSetup")} <ArrowRight className="size-5 rtl:rotate-180" aria-hidden="true" />
          </StickerButton>
        </form>
      )}
    </main>
  );
}
