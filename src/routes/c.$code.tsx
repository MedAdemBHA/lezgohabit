import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/c/$code")({
  ssr: false,
  head: () => ({ meta: [{ title: "Join my crew on lezgo" }, { name: "description", content: "You're invited to a lezgo crew." },
    { property: "og:title", content: "Join my crew on lezgo" }, { property: "og:description", content: "Show up. Lezgo." }] }),
  beforeLoad: ({ params }) => {
    const c = params.code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    if (c.length === 6) sessionStorage.setItem("lezgo_pending_code", c);
    throw redirect({ to: "/auth" });
  },
});
