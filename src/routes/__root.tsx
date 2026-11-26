import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { publicUrl } from "@/lib/public-url";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useHydrated,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { I18nextProvider, useTranslation } from "react-i18next";
import { Toaster } from "sonner";

import { StickerButton } from "@/components/lezgo/ui";
import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import i18n, { applyLang, isRtl, LANG_KEY, selectLang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="num text-7xl font-bold text-foreground">404</h1>
        <p className="mt-4 text-lg font-bold">{i18n.t("batch9.notFound")}</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex min-h-[48px] items-center rounded-[16px] bg-ink px-5 font-extrabold text-lime sticker-border shadow-hard-orange"
          >
            lezgo
          </Link>
        </div>
      </div>
    </div>
  );
}

const STALE_RELOAD_KEY = "lezgo_stale_reload";

/** A deploy replaced the hashed chunks this tab still points at. */
function isStaleBuild(error: unknown) {
  const message = String((error as { message?: string })?.message ?? error);
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported|Failed to fetch dynamically|ChunkLoadError|Unable to preload CSS/i.test(
    message,
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  const stale = isStaleBuild(error);
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  useEffect(() => {
    if (!stale) return;
    // Reload once to pick up the new build; a second failure stays on screen instead of looping.
    try {
      if (sessionStorage.getItem(STALE_RELOAD_KEY)) return;
      sessionStorage.setItem(STALE_RELOAD_KEY, "1");
      window.location.reload();
    } catch {
      /* storage blocked: let the player tap Reload */
    }
  }, [stale]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4" role="alert">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {i18n.t("common.error")}
        </h1>
        <p className="mt-3 text-[15px] font-semibold">
          {i18n.t(stale ? "flows.updated" : "flows.errorBody")}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <StickerButton
            onClick={() => {
              if (stale) {
                window.location.reload();
                return;
              }
              router.invalidate();
              reset();
            }}
            className="inline-flex min-h-[48px] items-center rounded-[16px] bg-ink px-5 font-extrabold text-lime sticker-border"
          >
            {i18n.t(stale ? "flows.reload" : "batch9.retry")}
          </StickerButton>
          <a
            href="/"
            className="inline-flex min-h-[48px] items-center rounded-[16px] bg-card px-5 font-extrabold sticker-border"
          >
            {i18n.t("batch9.backHome")}
          </a>
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
      { title: "lezgo · Small habits. Real progress." },
      {
        name: "description",
        content:
          "Free habit challenges. Check in each day and grow your streak, solo or with your crew.",
      },
      { property: "og:title", content: "lezgo · بالشوية بالشوية… توصل" },
      {
        property: "og:description",
        content: "دقيقة في النهار، وحدك ولا مع صحابك. بلاش.",
      },
      { property: "og:locale", content: "ar_TN" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "lezgo" },
      { property: "og:image", content: publicUrl("/og-home.jpg") },
      { property: "og:image:type", content: "image/jpeg" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: publicUrl("/og-home.jpg") },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Alexandria:wght@500;600;700;800&family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600;12..96,700;12..96,800&family=Space+Mono:wght@400;700&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      // Crisp at tab size: a vector favicon drawn for 16–32px, with PNG and ICO fallbacks.
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "icon", href: "/favicon-32.png", type: "image/png", sizes: "32x32" },
      { rel: "icon", href: "/favicon.ico", sizes: "16x16 32x32 48x48" },
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
  const { i18n: locale } = useTranslation();
  const search = useRouterState({ select: (state) => state.location.searchStr });
  const requestedLang = selectLang(new URLSearchParams(search).get("lang"));
  const hydrated = useHydrated();
  const lang = requestedLang ?? (hydrated ? selectLang(locale.language) : undefined) ?? "en";
  return (
    <html lang={lang} dir={isRtl(lang) ? "rtl" : "ltr"}>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
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
      const lang = selectLang(requested) ?? selectLang(stored);
      if (lang) applyLang(lang);
    } catch {
      /* ignore */
    }
    // auth-js re-emits SIGNED_IN every time the tab becomes visible again. Refetch everything only
    // when the signed-in account really changes, not on each return to the app.
    let lastUserId: string | null | undefined;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      const userId = session?.user?.id ?? null;
      const changed = lastUserId !== undefined && userId !== lastUserId;
      const first = lastUserId === undefined;
      lastUserId = userId;
      if (event === "INITIAL_SESSION") return;
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      if (event === "SIGNED_IN" && !changed && !first) return;
      void router.invalidate();
      if (event !== "SIGNED_OUT") void queryClient.invalidateQueries();
    });
    // The app has run for a while on this build: allow one stale-chunk reload again later.
    const settled = window.setTimeout(() => {
      try {
        sessionStorage.removeItem(STALE_RELOAD_KEY);
      } catch {
        /* ignore */
      }
    }, 15_000);
    return () => {
      window.clearTimeout(settled);
      data.subscription.unsubscribe();
    };
  }, [router, queryClient]);
  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <Outlet />
        <Toaster
          position="top-center"
          offset="calc(14px + env(safe-area-inset-top, 0px))"
          mobileOffset="calc(14px + env(safe-area-inset-top, 0px))"
          toastOptions={{
            unstyled: true,
            classNames: {
              toast:
                "flex w-full max-w-[400px] items-center gap-3 rounded-[16px] bg-ink px-4 py-3 text-[15px] font-bold text-lime sticker-border shadow-hard-orange",
            },
          }}
        />
      </I18nextProvider>
    </QueryClientProvider>
  );
}
