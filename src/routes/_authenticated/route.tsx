import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { RoutePending } from "@/components/lezgo/launch/loading";

// Onboarding only ever flips false -> true, so a confirmed "true" is safe to reuse for the session.
const onboardedUsers = new Set<string>();

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    // getSession reads the stored session (refreshing only when expired), so page-to-page
    // navigation no longer waits on a network round trip. Data access stays guarded by RLS.
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user) {
      if (location.pathname === "/wrapped") {
        const season = new URLSearchParams(location.searchStr).get("season") ?? "";
        throw redirect({ to: "/auth", search: { next: "/wrapped", season }, reloadDocument: true });
      }
      throw redirect({ to: "/auth" });
    }
    if (location.pathname !== "/onboarding" && !onboardedUsers.has(user.id)) {
      const { data: p } = await supabase
        .from("profiles")
        .select("onboarded")
        .eq("id", user.id)
        .maybeSingle();
      if (!p?.onboarded) throw redirect({ to: "/onboarding" });
      onboardedUsers.add(user.id);
    }
    return { user };
  },
  pendingComponent: RoutePending,
  component: () => <Outlet />,
});
