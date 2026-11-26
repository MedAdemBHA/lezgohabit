import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { RoutePending } from "@/components/lezgo/launch/loading";
import { readAdminDashboard } from "@/lib/admin-data";
import { safeNext } from "@/lib/safe-next";
import { activeSeasonQuery, primeUser, profileQuery } from "@/lib/data";

// Onboarding only ever flips false -> true, so a confirmed "true" is safe to reuse for the session.
const onboardedUsers = new Set<string>();

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location, context }) => {
    // getSession reads the stored session (refreshing only when expired), so page-to-page
    // navigation no longer waits on a network round trip. Data access stays guarded by RLS.
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user) {
      // Keep where the player was headed (any signed-in screen, not just Wrapped) so a shared
      // link or an expired session lands them back on the same page after sign-in. Start
      // sign-in with a fresh document so the protected route can finish leaving hydration.
      const next = safeNext(location.href);
      throw redirect({ to: "/auth", search: next ? { next } : {}, reloadDocument: true });
    }
    primeUser(user);
    // Start the shared screen data now, in parallel with the guard: Today, Board, etc. read the
    // same cached queries, so the first screen doesn't wait on a second profile/season round trip.
    void context.queryClient.prefetchQuery(activeSeasonQuery(user.id));
    // The admin dashboard authorizes its own data and actions on the server.
    if (location.pathname === "/admin") return { user };
    if (location.pathname !== "/onboarding" && !onboardedUsers.has(user.id)) {
      // Reads the full profile into the shared cache (useBase reuses it). A cached "not onboarded"
      // is re-read once so a just-finished onboarding is never bounced back.
      // A failed read (offline, timeout) must not push an onboarded player back into onboarding:
      // it throws, so the error screen can offer a retry instead.
      const qc = context.queryClient;
      const read = (fresh: boolean) =>
        (fresh
          ? qc.fetchQuery({ ...profileQuery(user.id), staleTime: 0 })
          : qc.ensureQueryData(profileQuery(user.id))
        )
          // No profile row yet (PGRST116) means "not onboarded", exactly like before.
          .catch((e: { code?: string }) => {
            if (e?.code === "PGRST116") return null;
            throw e;
          });
      let p = await read(false);
      if (!p?.onboarded) p = await read(true);
      if (!p?.onboarded) {
        if (location.pathname === "/today") {
          // Ordinary sign-in lands on Today. Give admins who haven't set up a
          // player profile a way straight to their dashboard from there.
          const dashboard = await readAdminDashboard("demo").catch(() => null);
          if (dashboard?.me?.id === user.id) throw redirect({ to: "/admin" });
        }
        const next = location.pathname === "/today" && !location.searchStr && !location.hash
          ? undefined
          : safeNext(location.href);
        throw redirect({ to: "/onboarding", search: next ? { next } : {} });
      }
      onboardedUsers.add(user.id);
    }
    return { user };
  },
  pendingComponent: RoutePending,
  component: () => <Outlet />,
});
