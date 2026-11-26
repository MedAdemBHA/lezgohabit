import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { RoutePending } from "@/components/lezgo/launch/loading";
import { safeNext } from "@/lib/safe-next";

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
      // Keep where the player was headed (any signed-in screen, not just Wrapped) so a shared
      // link or an expired session lands them back on the same page after sign-in.
      const next = safeNext(location.href);
      throw redirect({ to: "/auth", search: next ? { next } : {}, reloadDocument: location.pathname === "/wrapped" });
    }
    if (location.pathname !== "/onboarding" && !onboardedUsers.has(user.id)) {
      const { data: p, error } = await supabase
        .from("profiles")
        .select("onboarded")
        .eq("id", user.id)
        .maybeSingle();
      // A failed read (offline, timeout) must not push an onboarded player back into onboarding:
      // surface it so the error screen can offer a retry instead.
      if (error) throw error;
      if (!p?.onboarded) throw redirect({ to: "/onboarding" });
      onboardedUsers.add(user.id);
    }
    return { user };
  },
  pendingComponent: RoutePending,
  component: () => <Outlet />,
});
