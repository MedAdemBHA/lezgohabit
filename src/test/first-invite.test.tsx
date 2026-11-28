import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@/lib/i18n";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({ single: async () => ({ data: { code: "K7Q2PX" }, error: null }) }),
      }),
    }),
  },
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

import { FirstInviteSheet, shouldOfferFirstInvite } from "@/components/lezgo/today/first-invite";

describe("invite step after the first log", () => {
  it("shows once, only in shared challenges, only after a real log", () => {
    expect(shouldOfferFirstInvite({ privateChallenge: false, alreadyShown: false, value: 1 })).toBe(
      true,
    );
    expect(shouldOfferFirstInvite({ privateChallenge: false, alreadyShown: true, value: 1 })).toBe(
      false,
    );
    expect(shouldOfferFirstInvite({ privateChallenge: true, alreadyShown: false, value: 1 })).toBe(
      false,
    );
    expect(shouldOfferFirstInvite({ privateChallenge: false, alreadyShown: false, value: 0 })).toBe(
      false,
    );
  });
  it("shares the crew's /c/<code> invite link", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <FirstInviteSheet open onClose={() => {}} crewId="crew-1" />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getByText("K7Q2PX")).toBeInTheDocument());
    expect(screen.getByText(/\/c\/K7Q2PX$/)).toBeInTheDocument();
    expect(screen.getByText("Maybe later")).toBeInTheDocument();
  });
});
