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
import {
  clearStartFlow,
  finishStartFlow,
  readStartFlow,
  resumeStartFlow,
  startFlowResumeToken,
} from "@/lib/start-flow";
import { joinErrorKey, myActiveEventQuery } from "@/lib/event-data";
import { loc } from "@/lib/i18n";
import { errKey, useUser } from "@/lib/data";
import { guestDemoAvailable } from "@/lib/admin.functions";
import { selectLang } from "@/lib/i18n";
import {
  AFTER_SIGN_IN,
  LEGACY_WRAPPED_SIGN_IN,
  authReturnError,
  nextFromSearch,
  takeStoredNext,
} from "@/lib/safe-next";

const publicEmailSignIn = import.meta.env["VITE_PUBLIC_EMAIL_SIGNIN"] === "true";

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { next?: string } => {
    const next = nextFromSearch(search);
    return next ? { next } : {};
  },
  head: () => ({
    meta: [
      { title: "Sign in · lezgo" },
      { name: "description", content: "Sign in to start a challenge on lezgo." },
      { property: "og:title", content: "Sign in · lezgo" },
      { property: "og:description", content: "Start a challenge on lezgo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AuthPage,
});

function GoogleG() {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
    >
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
      />
    </svg>
  );
}

function AuthPage() {
  const { t, i18n } = useTranslation();
  const nav = useNavigate();
  const { next } = Route.useSearch();
  const toWrapped = next?.startsWith("/wrapped") ?? false;
  const toAdmin = next?.startsWith("/admin") ?? false;
  // Email links are off for players unless enabled; the admin sign-in always offers them.
  const emailEnabled = publicEmailSignIn || toAdmin;
  const [adult, setAdult] = useState(false);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [emailError, setEmailError] = useState<
    "auth.emailNotAllowed" | "auth.emailRateLimited" | "common.error" | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const demo = useQuery({
    queryKey: ["guest-demo-available"],
    queryFn: () => guestDemoAvailable(),
    enabled: !next,
    staleTime: 60_000,
  });
  const [flowError, setFlowError] = useState<string | null>(null);
  const [returnError, setReturnError] = useState<"cancelled" | "expired" | "failed" | null>(null);
  const user = useUser();
  const active = useQuery({
    ...myActiveEventQuery(user?.id ?? ""),
    enabled: !!user && flowError === "active_challenge_exists",
  });
  const activeName = loc(active.data?.seasons?.name, i18n.language);
  const completing = useRef(false);
  const leaving = useRef(false);
  const countries = useQuery({
    queryKey: ["participating-countries"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("participating_countries");
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });

  async function continueAfterAuth() {
    if (completing.current) return;
    completing.current = true;
    setBusy(true);
    setFlowError(null);
    try {
      await finishStartFlow();
      await nav({ to: "/today", replace: true });
    } catch (error) {
      const key = errKey(error);
      setFlowError(key);
      completing.current = false;
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromLink = params.get("code");
    const resume = params.get("resume");
    const missingFlow = !!resume && !resumeStartFlow(resume);
    if (fromLink && /^[A-Z0-9]{6}$/.test(fromLink))
      sessionStorage.setItem("lezgo_challenge_invite", fromLink);
    // Cancelled Google consent or an expired/used magic link come back as error params.
    const returned = authReturnError(window.location.search, window.location.hash);
    if (returned) {
      setReturnError(returned);
      if (returned === "expired") setEmailOpen(true);
      // Clear the error params but keep the destination, so a retry still lands in the right place.
      const carried = next ?? takeStoredNext();
      void nav({ to: "/auth", search: carried ? { next: carried } : {}, replace: true });
    }
    let active = true;
    const go = () => {
      if (!active || leaving.current) return;
      // Destination saved before sign-in (URL first, then the OAuth round-trip copy) wins.
      const stored = takeStoredNext();
      const destination = next ?? stored;
      if (destination) {
        leaving.current = true;
        window.location.replace(destination);
        return;
      }
      if (missingFlow && !fromLink) {
        void nav({ to: "/start", replace: true });
        return;
      }
      if (readStartFlow()) {
        void continueAfterAuth();
        return;
      }
      const code = sessionStorage.getItem("lezgo_challenge_invite");
      if (code && /^[A-Z0-9]{6}$/.test(code)) {
        void nav({ to: "/c/$code", params: { code }, replace: true });
      } else void nav({ to: "/today", replace: true });
    };
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) go();
    });
    let pending: number | undefined;
    const { data } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) {
        window.clearTimeout(pending);
        pending = window.setTimeout(go, 0);
      }
    });
    return () => {
      active = false;
      window.clearTimeout(pending);
      data.subscription.unsubscribe();
    };
  }, [nav, t, next]);

  function callbackUrl() {
    const url = new URL("/auth", window.location.origin);
    if (next) {
      url.searchParams.set("next", next);
      return url.href;
    }
    const resume = startFlowResumeToken();
    const code = sessionStorage.getItem("lezgo_challenge_invite");
    if (resume) url.searchParams.set("resume", resume);
    if (code) url.searchParams.set("code", code);
    return url.href;
  }

  async function google() {
    if (!adult || busy) return;
    setBusy(true);
    setReturnError(null);
    sessionStorage.removeItem(LEGACY_WRAPPED_SIGN_IN);
    if (next) sessionStorage.setItem(AFTER_SIGN_IN, next);
    else sessionStorage.removeItem(AFTER_SIGN_IN);
    // Keep the exact allowlisted callback; the destination travels in sessionStorage.
    const redirectTo = new URL("/auth", window.location.origin).href;
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (error) throw error;
    } catch {
      sessionStorage.removeItem(AFTER_SIGN_IN);
      toast(t("flows.signInFailed"));
      setBusy(false);
    }
  }
  async function magic(e: React.FormEvent) {
    e.preventDefault();
    const address = email.trim();
    if (!address || !adult || busy) return;
    setEmailError(null);
    setReturnError(null);
    setBusy(true);
    let error: { code?: string | undefined; status?: number | undefined } | null = null;
    try {
      ({ error } = await supabase.auth.signInWithOtp({
        email: address,
        options: { emailRedirectTo: callbackUrl() },
      }));
    } catch {
      error = {};
    } finally {
      setBusy(false);
    }
    if (error) {
      setEmailError(
        error.code === "email_address_not_authorized"
          ? "auth.emailNotAllowed"
          : error.status === 429
            ? "auth.emailRateLimited"
            : "common.error",
      );
      return;
    }
    setSent(true);
  }

  return (
    <div className="design-screen login-screen">
      <header className="flex h-10 shrink-0 items-center justify-between gap-2">
        <div className="login-brand flex items-center gap-2" dir="ltr">
          <Brand size={34} />
        </div>
        <DesignLanguage />
      </header>
      <h1 className="text-[36px] font-extrabold leading-tight">
        {t(toAdmin ? "auth.adminSignIn" : "auth.signIn")}
      </h1>
      <p className="text-[16px] font-semibold leading-[1.5] text-design-body">
        {t(
          toWrapped
            ? "wrapped.signIn"
            : toAdmin
              ? "auth.adminSignInHint"
              : next
                ? "flows.continueTo"
                : emailEnabled
                  ? "auth.existingEmail"
                  : "auth.googleSignInHint",
        )}
      </p>
      {returnError && !user && (
        <p role="alert" className="rounded-[14px] bg-card p-3 text-[14px] font-bold sticker-border">
          {t(
            returnError === "cancelled"
              ? "flows.oauthCancelled"
              : returnError === "expired"
                ? "flows.linkExpired"
                : "flows.signInFailed",
          )}
        </p>
      )}
      {user && flowError === null && (
        <p role="status" aria-live="polite" className="font-bold">
          {t("flows.signingIn")}
        </p>
      )}
      {flowError !== null && (
        <div
          role="alert"
          className="space-y-2 rounded-[14px] bg-card p-3 text-[14px] font-bold sticker-border"
        >
          <p>
            {flowError === "active_challenge_exists" && activeName
              ? t("events.current", { name: activeName })
              : t(joinErrorKey(flowError))}
          </p>
          {flowError === "active_challenge_exists" && <p>{t("events.keepPlaying")}</p>}
          <div className="flex flex-wrap gap-2">
            <Link to="/today" onClick={clearStartFlow}>
              <StickerButton size="sm" variant="lime">
                {t("events.goToday")}
              </StickerButton>
            </Link>
            {active.data && (
              <Link
                to="/challenges"
                search={{ season: active.data.season_id }}
                onClick={clearStartFlow}
              >
                <StickerButton size="sm" variant="secondary">
                  {t("events.viewEvent")}
                </StickerButton>
              </Link>
            )}
            {flowError === "crew_setup_pending" || !flowError ? (
              <StickerButton size="sm" variant="secondary" onClick={() => void continueAfterAuth()}>
                {t("common.retry")}
              </StickerButton>
            ) : (
              flowError !== "active_challenge_exists" && (
                <Link to="/start" onClick={clearStartFlow}>
                  <StickerButton size="sm" variant="secondary">
                    {t("challengeHistory.pickNext")}
                  </StickerButton>
                </Link>
              )
            )}
          </div>
        </div>
      )}
      {!user && !toAdmin && (
        <section className="login-welcome" aria-label={t("landing.how")}>
          <img
            src="/images/lezgo-track.webp"
            alt=""
            width={1122}
            height={1402}
            className="login-photo"
            decoding="async"
          />
          <ol className="login-steps">
            {([1, 2, 3] as const).map((n) => (
              <li key={n}>
                <span
                  className={`login-step-num num ${["bg-lime", "bg-yellow", "bg-blue"][n - 1]}`}
                >
                  {n}
                </span>
                <span>
                  <strong>{t(`landing.step${n}`)}</strong>
                  <small>{t(`landing.step${n}Detail`)}</small>
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}
      {(countries.data ?? 0) >= 2 && (
        <div className="flex items-center gap-3">
          <div className="flex shrink-0" aria-hidden="true">
            {(
              [
                ["bg-lime", "NR"],
                ["bg-pink", "SK"],
                ["bg-yellow", "YB"],
                ["bg-teal", "AK"],
              ] as const
            ).map(([color, initials], i) => (
              <span
                key={color}
                className={`grid size-[34px] place-items-center rounded-full text-[10px] font-extrabold sticker-border ${color} ${i ? "-ms-2" : ""}`}
              >
                {initials}
              </span>
            ))}
          </div>
          <p className="text-[13px] font-bold">{t("design.proof", { n: countries.data })}</p>
        </div>
      )}
      {!user && (
        <div className="login-actions">
          <label className="flex min-h-11 items-center gap-3 text-[14px] font-bold">
            <input
              type="checkbox"
              checked={adult}
              onChange={(e) => setAdult(e.target.checked)}
              className="size-5 accent-ink"
            />
            {t("batch9.adult")}
          </label>
          {!adult && (
            <p id="adult-hint" className="text-[13px] font-semibold text-design-muted">
              {t("flows.adultRequired")}
            </p>
          )}
          <StickerButton
            block
            variant="secondary"
            className="google-button"
            onClick={() => void google()}
            disabled={busy || !adult}
            aria-describedby={adult ? undefined : "adult-hint"}
          >
            <GoogleG />
            {t("auth.google")}
          </StickerButton>
          {emailEnabled && (
            <StickerButton
              block
              variant="ghost"
              className="email-button"
              onClick={() => setEmailOpen(true)}
              disabled={busy || !adult}
              aria-describedby={adult ? undefined : "adult-hint"}
            >
              <Mail size={20} strokeWidth={2.5} />
              {t("design.email")}
            </StickerButton>
          )}
          {toAdmin && (
            <Link to="/auth" className="min-h-11 self-center p-2 text-sm font-extrabold underline">
              {t("auth.playerSignIn")}
            </Link>
          )}
          {!next && demo.data && <ExploreAsGuest />}
          <div className="flex justify-center gap-4">
            {(["terms", "privacy"] as const).map((document) => (
              <Link
                key={document}
                to="/legal/$document"
                params={{ document }}
                search={{ lang: selectLang(i18n.language) }}
                className="inline-flex min-h-11 items-center px-2 text-sm font-extrabold underline"
              >
                {t(`design.${document}`)}
              </Link>
            ))}
          </div>
        </div>
      )}
      <BottomSheet open={emailOpen} onClose={() => setEmailOpen(false)} title={t("design.email")}>
        {sent ? (
          <div className="space-y-3">
            <p role="status" className="sticker bg-lime p-4 font-bold">
              {t("auth.linkSent")}
            </p>
            <p className="text-[14px] font-semibold">
              {t("flows.sentTo", { email: email.trim() })}
            </p>
            <StickerButton
              block
              variant="secondary"
              onClick={() => {
                setSent(false);
                setEmailError(null);
              }}
            >
              {t("flows.otherEmail")}
            </StickerButton>
          </div>
        ) : (
          <form onSubmit={magic} className="space-y-4">
            <Field label={t("auth.email")}>
              <input
                dir="ltr"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailError(null);
                }}
                placeholder={t("auth.emailPh")}
                className={inputCls}
              />
            </Field>
            {emailError && (
              <p role="alert" className="text-sm font-bold text-destructive">
                {t(emailError)}
              </p>
            )}
            <StickerButton block type="submit" disabled={busy || !adult}>
              {t(busy ? "common.loading" : "design.email")}
            </StickerButton>
          </form>
        )}
      </BottomSheet>
    </div>
  );
}
