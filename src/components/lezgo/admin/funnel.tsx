import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { loc } from "@/lib/i18n";
import { funnelQuery, stepRate } from "@/lib/product-events";
import { Num } from "../ui";

/** Per-challenge funnel and day-7 retention, crew vs solo (admin_funnel is admin-checked). */
export function AdminFunnel() {
  const { t, i18n } = useTranslation();
  const seasons = useQuery({
    queryKey: ["adminFunnelSeasons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seasons")
        .select("id,name,starts_on,is_demo")
        .eq("is_demo", false)
        .order("starts_on", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data;
    },
  });
  const [picked, setPicked] = useState("");
  const seasonId = picked || seasons.data?.[0]?.id || "";
  const funnel = useQuery(funnelQuery(seasonId));
  const f = funnel.data;
  const steps = f
    ? ([
        ["visits", f.visits, f.visits],
        ["joined", f.joined, f.visits],
        ["first_log", f.first_log, f.joined],
        ["day7_log", f.day7_log, f.first_log],
      ] as const)
    : [];
  const top = Math.max(1, ...steps.map(([, n]) => n));
  return (
    <section className="admin-card space-y-4" aria-labelledby="funnel-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="funnel-title" className="text-lg font-extrabold">
          {t("funnel.title")}
        </h2>
        <select
          className="rounded-[12px] border-2 border-ink bg-card px-2 py-1 font-bold"
          value={seasonId}
          aria-label={t("funnel.challenge")}
          onChange={(e) => setPicked(e.target.value)}
        >
          {(seasons.data ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {loc(s.name, i18n.language)} · {s.starts_on}
            </option>
          ))}
        </select>
      </div>
      {funnel.isError ? (
        <p>{t("common.error")}</p>
      ) : !f ? (
        <p role="status">{t("common.loading")}</p>
      ) : (
        <>
          <ol className="space-y-2">
            {steps.map(([key, n, prev], i) => (
              <li key={key} className="space-y-1">
                <div className="flex justify-between text-[14px] font-bold">
                  <span>{t(`funnel.${key}`)}</span>
                  <Num>
                    {n}
                    {i > 0 && ` · ${stepRate(n, prev)}%`}
                  </Num>
                </div>
                <div className="h-3 rounded-full bg-muted" aria-hidden="true">
                  <div
                    className="h-3 rounded-full bg-lime"
                    style={{ width: `${(100 * n) / top}%` }}
                  />
                </div>
              </li>
            ))}
          </ol>
          <div className="grid grid-cols-2 gap-3">
            {(["crew", "solo"] as const).map((group) => (
              <div key={group} className="rounded-[14px] bg-card p-3 sticker-border">
                <p className="text-[13px] font-bold">{t(`funnel.${group}`)}</p>
                <Num className="text-[28px] font-extrabold">
                  {stepRate(f[group].day7, f[group].joined)}%
                </Num>
                <p className="text-[12px] font-semibold">
                  {t("funnel.retention", { day7: f[group].day7, joined: f[group].joined })}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
