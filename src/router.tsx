import { createAppQueryClient } from "@/lib/query-resilience";
import { createRouter } from "@tanstack/react-router";
import { RoutePending } from "@/components/lezgo/launch/loading";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  // One client per request: a module-level QueryClient leaks cached data between SSR requests.
  const queryClient = createAppQueryClient(async () => {
    if (typeof window === "undefined") return;
    const { supabase } = await import("@/integrations/supabase/client");
    await supabase.auth.refreshSession();
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPendingComponent: RoutePending,
    // Wait a beat before showing a skeleton, and keep it up long enough not to flicker.
    defaultPendingMs: 400,
    defaultPendingMinMs: 300,
    // Lets Query own freshness; set caching defaults on the QueryClient, not the router.
    defaultPreloadStaleTime: 0,
  });

  return router;
};
