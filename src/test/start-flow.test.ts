import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: api.getUser },
    from: api.from,
    rpc: api.rpc,
  },
}));

import {
  finishStartFlow,
  readStartFlow,
  saveStartFlow,
  START_FLOW_KEY,
  toggleStartHabit,
  type StartFlow,
} from "@/lib/start-flow";

describe("challenge start flow", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.clearAllMocks();

    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      single: vi.fn(),
      update: vi.fn(),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.update.mockReturnValue(query);
    query.single.mockResolvedValue({
      data: {
        handle: "v2player",
        display_name: "V2 Player",
        country_code: "TN",
        language: "en",
        onboarded: true,
        is_demo: false,
      },
      error: null,
    });
    api.from.mockReturnValue(query);
    api.getUser.mockResolvedValue({
      data: { user: { id: "test-user", email: "v2@example.invalid", user_metadata: {} } },
      error: null,
    });
    api.rpc.mockResolvedValue({ data: null, error: null });
  });

  it("keeps six personal habit picks and toggles an existing pick off", () => {
    const six = ["train", "read", "sleep7", "steps", "water", "meditation"];
    expect(toggleStartHabit(six, "smoke_free")).toBe(six);
    expect(toggleStartHabit(six, "read")).toEqual(["train", "sleep7", "steps", "water", "meditation"]);
    expect(toggleStartHabit([], "train")).toEqual(["train"]);
  });

  it("restores the selected challenge after auth and auto-joins before finding a crew", async () => {
    const flow: StartFlow = {
      challenge: { kind: "official", seasonId: "season-id" },
      play: { mode: "find" },
    };
    saveStartFlow(flow);
    expect(readStartFlow()).toEqual(flow);

    await finishStartFlow();

    expect(api.rpc.mock.calls).toEqual([
      ["join_season", { _season_id: "season-id", _mode: "crew" }],
      ["find_challenge_crew"],
    ]);
    expect(sessionStorage.getItem(START_FLOW_KEY)).toBeNull();
  });

  it("uses an invite crew code without joining the default challenge first", async () => {
    saveStartFlow({ challenge: { kind: "crew_invite", code: "ABC123" } });

    await finishStartFlow();

    expect(api.rpc.mock.calls).toEqual([["join_crew", { _code: "ABC123" }]]);
    expect(sessionStorage.getItem(START_FLOW_KEY)).toBeNull();
  });
});
