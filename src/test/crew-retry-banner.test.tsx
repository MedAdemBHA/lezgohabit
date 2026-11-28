import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@/lib/i18n";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn() } }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

import { CrewRetryBanner } from "@/components/lezgo/today/crew-retry-banner";
import { saveCrewRetry } from "@/lib/start-flow";

const wrap = (ui: React.ReactNode) =>
  render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);

describe("Today banner after a failed crew step", () => {
  it("says the challenge was joined, why the crew failed, and offers one retry", () => {
    sessionStorage.clear();
    saveCrewRetry({ reason: "crew_full", action: { kind: "find" } });
    wrap(<CrewRetryBanner />);
    expect(screen.getByRole("status")).toHaveTextContent(/You're in the challenge/);
    expect(screen.getByRole("status")).toHaveTextContent(/This crew is full/);
    expect(screen.getAllByRole("button", { name: /Try the crew again/ })).toHaveLength(1);
  });
  it("shows nothing when there is no failed crew step", () => {
    sessionStorage.clear();
    const { container } = wrap(<CrewRetryBanner />);
    expect(container).toBeEmptyDOMElement();
  });
});
