import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Brand } from "@/components/lezgo/brand";
import { LangSwitcher } from "@/components/lezgo/lang-switcher";
import { Field, StickerButton, inputCls } from "@/components/lezgo/ui";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({ meta: [{ title: "Sign in — lezgo" }, { name: "description", content: "Sign in to lezgo with Google or a magic link." },
    { property: "og:title", content: "Sign in — lezgo" }, { property: "og:description", content: "Start your 40-day season." }] }),
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
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => { if (data.session) void nav({ to: "/today", replace: true }); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => { if (s) void nav({ to: "/today", replace: true }); });
    return () => data.subscription.unsubscribe();
  }, [nav]);

  async function google() {
    setBusy(true);
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (r.error) { toast(t("common.error")); setBusy(false); return; }
    if (r.redirected) return;
    void nav({ to: "/today", replace: true });
  }
  async function magic(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin + "/auth" } });
    setBusy(false);
    if (error) { toast(error.message); return; }
    setSent(true);
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[440px] flex-col px-5 pb-8 pt-4">
      <header className="flex items-center justify-between"><Brand /><LangSwitcher /></header>
      <h1 className="mt-10 text-[30px] font-extrabold leading-tight">{t("auth.title")}</h1>
      <div className="mt-8 space-y-4">
        <button type="button" onClick={google} disabled={busy}
          className="press flex min-h-[52px] w-full items-center justify-center gap-[10px] rounded-[16px] border border-[#747775] bg-[#FFFFFF] px-3 text-[14px] font-medium leading-5 text-[#1F1F1F] shadow-hard [font-family:'Google_Sans',var(--font-sans)]">
          <GoogleG />{t("auth.google")}
        </button>
        <div className="flex items-center gap-3 text-[14px] font-bold text-muted-foreground"><span className="h-px flex-1 bg-ink/20" />{t("auth.or")}<span className="h-px flex-1 bg-ink/20" /></div>
        {sent ? (
          <p className="sticker bg-lime p-4 text-[16px] font-bold">{t("auth.linkSent")}</p>
        ) : (
          <form onSubmit={magic} className="space-y-3">
            <Field label={t("auth.email")}>
              <input dir="ltr" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("auth.emailPh")} className={inputCls} />
            </Field>
            <StickerButton type="submit" block variant="secondary" disabled={busy}>{t("auth.sendLink")}</StickerButton>
          </form>
        )}
      </div>
      <p className="mt-auto pt-10 text-center text-[13px] text-muted-foreground">{t("auth.privacy")}</p>
    </div>
  );
}
