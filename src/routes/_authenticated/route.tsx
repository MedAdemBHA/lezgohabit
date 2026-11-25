import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { readAdminDashboard } from "@/lib/admin-data";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      if (location.pathname === "/admin") throw redirect({ to: "/auth", search: { next: "/admin" } });
      throw redirect({ to: "/auth" });
    }
    // The admin dashboard authorizes its own data and actions on the server.
    if (location.pathname === "/admin") return { user: data.user };
    if (location.pathname !== "/onboarding") {
      const { data: p } = await supabase.from("profiles").select("onboarded").eq("id", data.user.id).maybeSingle();
      if (!p?.onboarded) {
        if (location.pathname === "/today") {
          // Ordinary sign-in lands on Today. Give admins who haven't set up a
          // player profile a way straight to their dashboard from there.
          const dashboard = await readAdminDashboard("demo").catch(() => null);
          if (dashboard?.me?.id === data.user.id) throw redirect({ to: "/admin" });
        }
        throw redirect({ to: "/onboarding" });
      }
    }
    return { user: data.user };
  },
  component: () => <Outlet />,
});
