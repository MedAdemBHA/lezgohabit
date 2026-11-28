import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@/lib/i18n";

const seeded = vi.hoisted(() => ({
  visits: 40,
  joined: 20,
  first_log: 15,
  day7_log: 9,
  crew: { joined: 10, day7: 7 },
  solo: { joined: 10, day7: 2 },
  crew_changes: 12,
}));
const rpc = vi.hoisted(() => vi.fn(async () => ({ data: seeded, error: null })));
vi.mock("@/integrations/supabase/client", () => {
  const q = {
    select: () => q,
    eq: () => q,
    order: () => q,
    limit: async () => ({
      data: [{ id: "s1", name: { en: "Nouveau départ" }, starts_on: "2027-01-01", is_demo: false }],
      error: null,
    }),
  };
  return { supabase: { from: () => q, rpc } };
});

import { AdminFunnel } from "@/components/lezgo/admin/funnel";
import { stepRate } from "@/lib/product-events";

const sql = readFileSync("drizzle/migrations/0085_product_events.sql", "utf8");

describe("product analytics", () => {
  it("records exactly the five planned events", () => {
    expect(sql).toContain(
      "CHECK (event IN ('visit_start','challenge_joined','first_log','day7_log','crew_size_changed'))",
    );
  });
  it("players cannot read or write events; demo data is skipped; the funnel is admin-only", () => {
    expect(sql).toContain("REVOKE ALL ON public.product_events FROM PUBLIC, anon, authenticated;");
    expect(sql).toMatch(/is_demo\) THEN RETURN/);
    expect(sql).toMatch(/admin_funnel[\s\S]*PERFORM public\._require_admin\(\);/);
  });
  it("step rates", () => {
    expect(stepRate(9, 15)).toBe(60);
    expect(stepRate(1, 0)).toBe(0);
  });
  it("the admin overview shows the funnel for a seeded challenge", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AdminFunnel />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getByText("Logged on day 7")).toBeInTheDocument());
    expect(rpc).toHaveBeenCalledWith("admin_funnel", { _season_id: "s1" });
    expect(screen.getByText("9 · 60%")).toBeInTheDocument();
    expect(screen.getByText("70%")).toBeInTheDocument(); // crew day-7 retention
    expect(screen.getByText("20%")).toBeInTheDocument(); // solo day-7 retention
  });
});
