import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ExploreAsGuest } from "@/components/lezgo/guest";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Brand } from "@/components/lezgo/brand";
import { DesignLanguage } from "@/components/lezgo/design-language";
import { useQuery } from "@tanstack/react-query";
import { Mail } from "lucide-react";
import { BottomSheet, Field, StickerButton, inputCls } from "@/components/lezgo/ui";
import { finishStartFlow, readStartFlow } from "@/lib/start-flow";
import { errKey } from "@/lib/data";

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { next?: "/admin" } =>
    search["next"] === "/admin" ? { next: "/admin" } : {},
  head: () => ({ meta: [{ title: "Sign in — lezgo" }, { name: "description", content: "Sign in to start a challenge on lezgo." },
    { property: "og:title", content: "Sign in — lezgo" }, { property: "og:description", content: "Start a challenge on lezgo." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: AuthPage,
});

function GoogleG() {
  return (
    <svg aria-hidden="true" width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>
  );
}

function AuthPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { next } = Route.useSearch();
  const [adult, setAdult] = useState(false);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [emailError, setEmailError] = useState<"auth.emailNotAllowed" | "auth.emailRateLimited" | "common.error" | null>(null);
  const [busy, setBusy] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [legal, setLegal] = useState<"terms" | "privacy" | null>(null);
  const [flowError, setFlowError] = useState("");
  const completing = useRef(false);
  const countries = useQuery({ queryKey: ["participating-countries"], queryFn: async () => { const { data, error } = await supabase.rpc("participating_countries"); if (error) throw error; return data; }, staleTime: 60_000 });

  async function continueAfterAuth() {
    if (completing.current) return;
    completing.current = true;
    setBusy(true);
    setFlowError("");
    try {
      await finishStartFlow();
      await nav({ to: "/today", replace: true });
    } catch (error) {
      const key = errKey(error);
      const message = key === "active_challenge_exists" ? t("batch6.activeChallengeExists") : t("common.error");
      setFlowError(message);
      toast(message);
      completing.current = false;
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const fromLink=new URLSearchParams(window.location.search).get("code");
    if(fromLink&&/^[A-Z0-9]{6}$/.test(fromLink))sessionStorage.setItem("lezgo_challenge_invite",fromLink);
    let active = true;
    let redirecting = false;
    let timer: ReturnType<typeof setTimeout>;
    const go = () => {
      if (!active || redirecting) return;
      redirecting = true;
      const adminSignIn = sessionStorage.getItem("lezgo_admin_signin") === "1";
      sessionStorage.removeItem("lezgo_admin_signin");
      if (next === "/admin" || (adminSignIn && !readStartFlow())) {
        void nav({ to: "/admin", replace: true });
        return;
      }
      if (readStartFlow()) { void continueAfterAuth(); return; }
      const code=sessionStorage.getItem('lezgo_challenge_invite');
      if(code&&/^[A-Z0-9]{6}$/.test(code)){void nav({to:'/c/$code',params:{code},replace:true});}
      else void nav({to:'/today',replace:true});
    };
    void supabase.auth.getUser().then(({ data }) => { if (data.user) go(); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s) {
        clearTimeout(timer);
        timer = setTimeout(go, 0);
      }
    });
    return () => {
      active = false;
      clearTimeout(timer);
      data.subscription.unsubscribe();
    };
  }, [nav, next, t]);

  function rememberAdminDestination() {
    if (next === "/admin") sessionStorage.setItem("lezgo_admin_signin", "1");
    else sessionStorage.removeItem("lezgo_admin_signin");
  }

  async function google() {
    if (!adult) return;
    rememberAdminDestination();
    setBusy(true);
    // Keep the exact allowlisted callback across sign-in destinations.
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin + "/auth" } });
    if (error) { toast(t("common.error")); setBusy(false); }
  }
  async function magic(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !adult) return;
    rememberAdminDestination();
    setEmailError(null);
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin + "/auth" + (sessionStorage.getItem("lezgo_challenge_invite") ? "?code=" + encodeURIComponent(sessionStorage.getItem("lezgo_challenge_invite") ?? "") : "") } });
    setBusy(false);
    if (error) {
      setEmailError(error.code === "email_address_not_authorized" ? "auth.emailNotAllowed"
        : error.status === 429 ? "auth.emailRateLimited" : "common.error");
      return;
    }
    setSent(true);
  }

  return (
    <div className="design-screen login-screen">
      <header className="flex h-10 shrink-0 items-center justify-between gap-2"><div className="login-brand flex items-center gap-2" dir="ltr"><Brand size={34} /></div><DesignLanguage segmented /></header>
      <h1 className="mt-4 text-[36px] font-extrabold leading-tight">{t(next ? "auth.adminSignIn" : "auth.signIn")}</h1>
      <p className="text-[16px] font-semibold leading-[1.5] text-design-body">{t(next ? "auth.adminSignInHint" : "auth.existingEmail")}</p>
      {flowError && <div role="alert" className="space-y-2 rounded-[14px] bg-card p-3 text-[14px] font-bold text-destructive sticker-border"><p>{flowError}</p><StickerButton block variant="secondary" onClick={() => void continueAfterAuth()}>{t("common.retry")}</StickerButton></div>}
      <div className="flex items-center gap-3"><div className="flex shrink-0" aria-hidden="true">{([ ["bg-lime", "NR"], ["bg-pink", "SK"], ["bg-yellow", "YB"], ["bg-teal", "AK"] ] as const).map(([color, initials],i) => <span key={color} className={`grid size-[34px] place-items-center rounded-full text-[11px] font-extrabold sticker-border ${color} ${i ? "-ms-2.5" : ""}`}>{initials}</span>)}</div><p className="text-[13px] font-bold">{countries.data !== undefined ? t("design.proof", { n: countries.data }) : t("common.loading")}</p></div>
      <div className="login-actions">
        <label className="flex min-h-11 items-center gap-3 text-[14px] font-bold"><input type="checkbox" checked={adult} onChange={e=>setAdult(e.target.checked)} className="size-5 accent-ink"/>{t("batch9.adult")}</label>
        <StickerButton block variant="secondary" className="google-button" onClick={google} disabled={busy || !adult}><GoogleG />{t("auth.google")}</StickerButton>
        <StickerButton block variant="ghost" className="email-button" onClick={() => setEmailOpen(true)} disabled={busy || !adult}><Mail size={20} strokeWidth={2.5} />{t("design.email")}</StickerButton>
        {next ? <Link to="/auth" className="min-h-11 self-center p-2 text-sm font-extrabold underline">{t("auth.playerSignIn")}</Link> : <ExploreAsGuest />}
        <p className="text-center text-[12px] font-semibold leading-[1.5] text-design-muted">{t("design.legal")} <StickerButton variant="ghost" className="legal-link" onClick={() => setLegal("terms")}>{t("design.terms")}</StickerButton> {t("design.andWord")} <StickerButton variant="ghost" className="legal-link" onClick={() => setLegal("privacy")}>{t("design.privacy")}</StickerButton></p>
      </div>
      <BottomSheet open={emailOpen} onClose={() => setEmailOpen(false)} title={t("design.email")}>
        {sent ? <p className="sticker bg-lime p-4 font-bold">{t("auth.linkSent")}</p> : (
          <form onSubmit={magic} className="space-y-4">
            <Field label={t("auth.email")}><input dir="ltr" type="email" autoComplete="email" required value={email} onChange={e => { setEmail(e.target.value); setEmailError(null); }} placeholder={t("auth.emailPh")} className={inputCls} /></Field>
            {emailError && <p role="alert" className="text-sm font-bold text-destructive">{t(emailError)}</p>}
            <StickerButton block type="submit" disabled={busy}>{t("design.email")}</StickerButton>
          </form>
        )}
      </BottomSheet>
      <BottomSheet open={legal !== null} onClose={() => setLegal(null)} title={legal ? t(`design.${legal}`) : ""}><p>{t("design.soon")}</p></BottomSheet>
    </div>
  );
}
