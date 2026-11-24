import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet, Link, createRootRouteWithContext, useRouter, useRouterState, HeadContent, Scripts, type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import { Toaster } from "sonner";

import { StickerButton } from "@/components/lezgo/ui";
import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import i18n, { applyLang, isRtl, LANG_KEY } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="num text-7xl font-bold text-foreground">404</h1>
        <p className="mt-4 text-lg font-bold">{i18n.t("batch9.notFound")}</p>
        <div className="mt-6">
          <Link to="/" className="inline-flex min-h-[48px] items-center rounded-[16px] bg-ink px-5 font-extrabold text-lime sticker-border shadow-hard-orange">
            lezgo
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => { reportLovableError(error, { boundary: "tanstack_root_error_component" }); }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{i18n.t("common.error")}</h1>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <StickerButton aria-label={i18n.t("batch9.retry")} onClick={() => { router.invalidate(); reset(); }}
            className="inline-flex min-h-[48px] items-center rounded-[16px] bg-ink px-5 font-extrabold text-lime sticker-border">↻</StickerButton>
          <a href="/" className="inline-flex min-h-[48px] items-center rounded-[16px] bg-card px-5 font-extrabold sticker-border">lezgo</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#FFF6E5" },
      { title: "lezgo — Show up. Lezgo." },
      { name: "description", content: "A 40-day habit season with friends or solo. Check in under a minute a day." },
      { property: "og:title", content: "lezgo — Show up. Lezgo." },
      { property: "og:description", content: "A 40-day habit season with friends or solo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Alexandria:wght@500;600;700;800&family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600;12..96,700;12..96,800&family=Space+Mono:wght@400;700&display=swap" },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/icons/icon-192.png", type: "image/png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icons/icon-192.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  const search = useRouterState({ select: (state) => state.location.searchStr });
  const requestedLang = new URLSearchParams(search).get("lang");
  const lang = requestedLang === "fr" || requestedLang === "ar" ? requestedLang : "en";
  return (
    <html lang={lang} dir={isRtl(lang) ? "rtl" : "ltr"}>
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  useEffect(() => {
    try {
      const requested = new URLSearchParams(window.location.search).get("lang");
      const stored = localStorage.getItem(LANG_KEY);
      const lang = requested && ["en", "fr", "ar"].includes(requested) ? requested : stored;
      if (lang) applyLang(lang);
    } catch { /* ignore */ }
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      void router.invalidate();
      if (event !== "SIGNED_OUT") void queryClient.invalidateQueries();
    });
    return () => data.subscription.unsubscribe();
  }, [router, queryClient]);
  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <Outlet />
        <Toaster position="top-center" toastOptions={{ unstyled: true, classNames: {
          toast: "flex w-full max-w-[400px] items-center gap-3 rounded-[16px] bg-ink px-4 py-3 text-[15px] font-bold text-lime sticker-border shadow-hard-orange",
        } }} />
      </I18nextProvider>
    </QueryClientProvider>
  );
}
