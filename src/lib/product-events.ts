import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * First-party product analytics (migration 0085). Joins, first logs, day-7 logs and crew
 * changes are recorded by database triggers; the app only reports the start of a visit.
 */
type Rpc = (
  fn: string,
  params?: Record<string, unknown>,
) => Promise<{ data: unknown; error: Error | null }>;
const rpc = (...args: Parameters<Rpc>) => (supabase.rpc as unknown as Rpc)(...args);

export const VISIT_KEY = "lezgo_visit_tracked";

/** Once per browser session; the server also limits it to one per 30 minutes. */
export function trackVisitOnce(seasonId: string | null | undefined) {
  try {
    if (sessionStorage.getItem(VISIT_KEY)) return;
    sessionStorage.setItem(VISIT_KEY, "1");
  } catch {
    return;
  }
  void rpc("track_visit", { _season_id: seasonId ?? null }).catch(() => {});
}

export type Funnel = {
  visits: number;
  joined: number;
  first_log: number;
  day7_log: number;
  crew: { joined: number; day7: number };
  solo: { joined: number; day7: number };
  crew_changes: number;
};

export const funnelQuery = (seasonId: string) =>
  queryOptions({
    queryKey: ["adminFunnel", seasonId],
    enabled: !!seasonId,
    queryFn: async () => {
      const { data, error } = await rpc("admin_funnel", { _season_id: seasonId });
      if (error) throw error;
      return data as Funnel;
    },
  });

/** Share of a step relative to the previous one, as a whole percent (0 when nothing before). */
export function stepRate(part: number, whole: number) {
  return whole > 0 ? Math.round((100 * part) / whole) : 0;
}
