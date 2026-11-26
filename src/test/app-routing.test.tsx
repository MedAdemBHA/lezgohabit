import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it, vi } from "vitest";

import { routeTree } from "@/routeTree.gen";
import { Route as authRoute } from "@/routes/auth";
import { groupCatalog, type CatalogCard } from "@/lib/challenge-catalog";

// Routing tests don't run Vite's PWA plugin or install a service worker.
vi.mock("@/lib/launch/offline", () => ({}));

vi.mock("@/lib/launch/offline", () => ({
  queueGo: vi.fn(), readQueue: () => [], syncGoes: vi.fn(), registerOffline: vi.fn(),
}));

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });

  it("keeps admin sign-in scoped to the admin dashboard", () => {
    const validate = authRoute.options.validateSearch;
    if (typeof validate !== "function") throw new Error("Auth search validator is missing");
    expect(validate({ next: "/admin" })).toEqual({ next: "/admin" });
    expect(validate({ next: "https://example.com" })).toEqual({});
  });

  it("only offers challenges within their published dates", () => {
    const official = {
      id: "current", season_id: "current", kind: "official", name: { en: "Winter Arc" },
      creator: "Lezgo", code: null, days: 40, starts_on: "2026-11-22", ends_on: "2026-12-31",
      members: 0, habits: [],
    } satisfies CatalogCard;
    const future = { ...official, id: "future", starts_on: "2027-02-08", ends_on: "2027-03-09" };
    const ended = { ...official, id: "ended", starts_on: "2026-10-01", ends_on: "2026-11-21" };

    expect(groupCatalog([future, official, ended], "2026-11-22")).toEqual({ open: [official], upcoming: [future] });
    expect(groupCatalog([future, official], "2027-02-08")).toEqual({ open: [future], upcoming: [] });
  });
});
