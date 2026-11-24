import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ExploreAsGuest } from "@/components/lezgo/guest";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { FitHeading } from "@/components/lezgo/fit-heading";
import { isRtl } from "@/lib/i18n";
import { Brand } from "@/components/lezgo/brand";
import { DesignLanguage } from "@/components/lezgo/design-language";
import { useQuery } from "@tanstack/react-query";
import { Mail } from "lucide-react";
import { BottomSheet, Field, StickerButton, inputCls } from "@/components/lezgo/ui";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({ meta: [{ title: "Sign in — lezgo" }, { name: "description", content: "Sign in to lezgo with Google or a magic link." },
    { property: "og:title", content: "Sign in — lezgo" }, { property: "og:description", content: "Start your 40-day season." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: AuthPage,
});

function GoogleG() {
  return (
    <svg aria-hidden="true" width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>
  );
}

function AuthPage() {
  const { t, i18n } = useTranslation();
  const nav = useNavigate();
  const [adult, setAdult] = useState(false);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [legal, setLegal] = useState<"terms" | "privacy" | null>(null);
  const countries = useQuery({ queryKey: ["participating-countries"], queryFn: async () => { const { data, error } = await supabase.rpc("participating_countries"); if (error) throw error; return data; }, staleTime: 60_000 });

  useEffect(() => {
    const fromLink=new URLSearchParams(window.location.search).get("code");
    if(fromLink&&/^[A-Z0-9]{6}$/.test(fromLink))sessionStorage.setItem("lezgo_challenge_invite",fromLink);
    const go=()=>{const code=sessionStorage.getItem('lezgo_challenge_invite');if(code&&/^[A-Z0-9]{6}$/.test(code)){void nav({to:'/c/$code',params:{code},replace:true});}else void nav({to:'/today',replace:true});};
    void supabase.auth.getUser().then(({ data }) => { if (data.user) go(); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => { if (s) go(); });
    return () => data.subscription.unsubscribe();
  }, [nav]);

  async function google() {
    if (!adult) return;
    setBusy(true);
    // Supabase redirects to Google and back to /auth; the auth listener above then routes to Today or the invite.
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin + "/auth" } });
    if (error) { toast(t("common.error")); setBusy(false); }
  }
  async function magic(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !adult) return;
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin + "/auth" + (sessionStorage.getItem("lezgo_challenge_invite") ? "?code=" + encodeURIComponent(sessionStorage.getItem("lezgo_challenge_invite") ?? "") : "") } });
    setBusy(false);
    if (error) { toast(t("common.error")); return; }
    setSent(true);
  }

  return (
    <div className="design-screen login-screen">
      <header className="flex h-10 shrink-0 items-center justify-between gap-2"><div className="login-brand flex items-center gap-2" dir="ltr"><Brand size={34} /></div><DesignLanguage segmented /></header>
      <span className="login-season">{t("design.loginSeason")}</span>
      <FitHeading className="login-hero" text={t("design.hero")} requestedSize={isRtl(i18n.language) ? 60 : 64} />
      <p className="text-[16px] font-semibold leading-[1.5] text-design-body">{t("design.sub")}</p>
      <div className="flex items-center gap-3"><div className="flex shrink-0" aria-hidden="true">{([ ["bg-lime", "NR"], ["bg-pink", "SK"], ["bg-yellow", "YB"], ["bg-teal", "AK"] ] as const).map(([color, initials],i) => <span key={color} className={`grid size-[34px] place-items-center rounded-full text-[11px] font-extrabold sticker-border ${color} ${i ? "-ms-2.5" : ""}`}>{initials}</span>)}</div><p className="text-[13px] font-bold">{countries.data !== undefined ? t("design.proof", { n: countries.data }) : t("common.loading")}</p></div>
      <div className="login-actions">
        <label className="flex min-h-11 items-center gap-3 text-[14px] font-bold"><input type="checkbox" checked={adult} onChange={e=>setAdult(e.target.checked)} className="size-5 accent-ink"/>{t("batch9.adult")}</label>
        <StickerButton block variant="secondary" className="google-button" onClick={google} disabled={busy || !adult}><GoogleG />{t("auth.google")}</StickerButton>
        <StickerButton block variant="ghost" className="email-button" onClick={() => setEmailOpen(true)} disabled={busy || !adult}><Mail size={20} strokeWidth={2.5} />{t("design.email")}</StickerButton>
        <ExploreAsGuest />
        <p className="text-center text-[12px] font-semibold leading-[1.5] text-design-muted">{t("design.legal")} <StickerButton variant="ghost" className="legal-link" onClick={() => setLegal("terms")}>{t("design.terms")}</StickerButton> {t("design.andWord")} <StickerButton variant="ghost" className="legal-link" onClick={() => setLegal("privacy")}>{t("design.privacy")}</StickerButton></p>
      </div>
      <BottomSheet open={emailOpen} onClose={() => setEmailOpen(false)} title={t("design.email")}>{sent ? <p className="sticker bg-lime p-4 font-bold">{t("auth.linkSent")}</p> : <form onSubmit={magic} className="space-y-4"><Field label={t("auth.email")}><input dir="ltr" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder={t("auth.emailPh")} className={inputCls} /></Field><StickerButton block type="submit" disabled={busy}>{t("design.email")}</StickerButton></form>}</BottomSheet>
      <BottomSheet open={legal !== null} onClose={() => setLegal(null)} title={legal ? t(`design.${legal}`) : ""}><p>{t("design.soon")}</p></BottomSheet>
    </div>
  );
}
