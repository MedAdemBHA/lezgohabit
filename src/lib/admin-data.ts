import { supabase } from "@/integrations/supabase/client";
import { queryOptions } from "@tanstack/react-query";
import type { Json } from "@/integrations/supabase/types";
import type { AdminSection } from "./admin-rules";
export type AdminRow = Record<string, unknown>;
export type AdminDashboard = {
  me: { id: string; display_name: string; avatar_url: string | null };
  sample: boolean;
  open_reports: number;
  day: string;
  season: { id: string; name: Record<string, string>; starts_on: string; ends_on: string } | null;
  demo_counts: { profiles: number; posts: number; crews: number; checkins: number };
  rows: AdminRow[];
  total: number;
  page: number;
  kpis: Record<string, number>;
  chart: { day: string; value: number }[];
  countries: { name: string; value: number }[];
  activity: { day: string; dau: number; wau: number }[];
  signups: { day: string; value: number }[];
  histogram: { label: string; value: number }[];
  retention: { day: number; eligible: number; value: number }[];
  bosses?: AdminRow[];
  filters?: AdminRow[];
  flags?: Record<string, boolean>;
  challenges?: AdminRow[];
  members?: AdminRow[];
  sponsored?: number;
  boss_count?: number;
};
export const adminQuery = (
  section: AdminSection,
  search = "",
  page = 0,
  target: string | null = null,
  demo = false,
) =>
  queryOptions({
    queryKey: ["admin", section, search, page, target, demo],
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_dashboard", {
        _section: section,
        _search: search,
        _page: page,
        _demo: demo,
        ...(target ? { _target: target } : {}),
      });
      if (error) throw error;
      return data as unknown as AdminDashboard;
    },
  });
export async function adminWrite(
  action: string,
  target: string | null = null,
  payload: AdminRow = {},
) {
  const { data, error } = await supabase.rpc("admin_action", {
    _action: action,
    ...(target ? { _target: target } : {}),
    _payload: payload as Json,
  });
  if (error) throw error;
  return data;
}
export const featureFlagsQuery = queryOptions({
  queryKey: ["featureFlags"],
  queryFn: async () => {
    const { data, error } = await supabase.rpc("app_feature_flags");
    if (error) throw error;
    return data as Record<string, boolean>;
  },
  staleTime: 30_000,
});
