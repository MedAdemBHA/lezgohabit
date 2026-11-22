import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/lezgo/app-shell";
import { Num, StickerButton, StickerCard } from "@/components/lezgo/ui";
import { loc } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — lezgo" }, { name: "description", content: "Lezgo admin overview." }, { name: "robots", content: "noindex" }] }),
  component: AdminPage,
});

type Overview = { users: number; active_today: number; checkins_today: number; crews: number;
  seasons: { id: string; slug: string; name: Record<string, string>; starts_on: string; ends_on: string; status: string; entries: number }[] };

function AdminPage() {
  const { t, i18n } = useTranslation();
  // Access is decided on the server: admin_overview raises 'forbidden' unless profiles.is_admin.
  const q = useQuery({ queryKey: ["adminOverview"], retry: false, queryFn: async () => {
    const { data, error } = await supabase.rpc("admin_overview"); if (error) throw error; return data as unknown as Overview; } });
  if (q.isLoading) return <AppShell hideTabs><p className="py-10 text-center">{t("common.loading")}</p></AppShell>;
  if (q.error || !q.data) return (
    <AppShell hideTabs>
      <StickerCard className="mt-6 text-center"><p className="text-[18px] font-extrabold">{t("admin.forbidden")}</p></StickerCard>
      <Link to="/today" className="mt-4 block"><StickerButton block>{t("profile.next")}</StickerButton></Link>
    </AppShell>
  );
  const o = q.data;
  return (
    <AppShell hideTabs>
      <h1 className="mb-4 text-[30px] font-extrabold">{t("admin.title")}</h1>
      <div className="grid grid-cols-2 gap-3">
        {([["users", o.users, "bg-lime"], ["activeToday", o.active_today, "bg-yellow"], ["checkinsToday", o.checkins_today, "bg-pink"], ["crews", o.crews, "bg-blue"]] as const).map(([k, v, c]) => (
          <StickerCard key={k} className={c}><p className="text-[13px] font-extrabold uppercase">{t(`admin.${k}`)}</p><Num className="text-[32px] font-bold">{v}</Num></StickerCard>
        ))}
      </div>
      <h2 className="mt-6 mb-2 text-[20px] font-extrabold">{t("admin.seasons")}</h2>
      <StickerCard className="overflow-x-auto p-0">
        <table className="w-full text-[14px]">
          <thead><tr className="border-b-2 border-ink text-start">
            <th className="p-3 text-start">{t("admin.seasons")}</th><th className="p-3 text-start">{t("admin.dates")}</th>
            <th className="p-3 text-start">{t("admin.status")}</th><th className="p-3 text-end">{t("admin.entries")}</th></tr></thead>
          <tbody>{o.seasons.map((s) => (
            <tr key={s.id} className="border-b border-ink/10 last:border-0">
              <td className="p-3 font-bold">{loc(s.name, i18n.language)}</td>
              <td className="p-3"><Num className="text-[12px]">{s.starts_on} → {s.ends_on}</Num></td>
              <td className="p-3"><span className="rounded-full bg-lime px-2 py-0.5 text-[12px] font-bold sticker-border [border-width:1.5px]">{s.status}</span></td>
              <td className="p-3 text-end"><Num>{s.entries}</Num></td>
            </tr>))}</tbody>
        </table>
      </StickerCard>
      <Link to="/today" className="mt-6 block"><StickerButton block>{t("profile.next")}</StickerButton></Link>
    </AppShell>
  );
}
