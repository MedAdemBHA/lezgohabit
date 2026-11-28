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
  CREW_RETRY_KEY,
  crewRetryMessage,
  finishStartFlow,
  readCrewRetry,
  readStartFlow,
  resumeStartFlow,
  startFlowResumeToken,
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
    expect(toggleStartHabit(six, "read")).toEqual([
      "train",
      "sleep7",
      "steps",
      "water",
      "meditation",
    ]);
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

  it("recovers the selected event when email opens the callback in another tab", () => {
    const flow: StartFlow = { challenge: { kind: "crew_invite", code: "ABC123" } };
    saveStartFlow(flow);
    const token = startFlowResumeToken();
    expect(token).toBeTruthy();
    sessionStorage.clear();
    expect(resumeStartFlow("different-invite")).toBe(false);
    expect(readStartFlow()).toBeNull();
    expect(resumeStartFlow(token!)).toBe(true);
    expect(readStartFlow()).toEqual(flow);
  });

  it("uses an invite crew code without joining the default challenge first", async () => {
    saveStartFlow({ challenge: { kind: "crew_invite", code: "ABC123" } });

    await finishStartFlow();

    expect(api.rpc.mock.calls).toEqual([["join_crew", { _code: "ABC123" }]]);
    expect(sessionStorage.getItem(START_FLOW_KEY)).toBeNull();
  });

  it("keeps the pending challenge for a new player to resume after profile setup", async () => {
    api.from().single.mockResolvedValue({
      data: { display_name: "New Player", onboarded: false, is_demo: false },
      error: null,
    });
    const flow: StartFlow = { challenge: { kind: "crew_invite", code: "ABC123" } };
    saveStartFlow(flow);

    await expect(finishStartFlow()).rejects.toThrow("profile_setup_required");
    expect(readStartFlow()).toEqual(flow);
    expect(api.rpc).not.toHaveBeenCalled();
  });

  it("reports a read-only guest join attempt without pretending it succeeded", async () => {
    api.getUser.mockResolvedValue({
      data: { user: { id: "sample-user", email: "demo@lezgo.app" } },
      error: null,
    });
    saveStartFlow({ challenge: { kind: "crew_invite", code: "ABC123" } });

    await expect(finishStartFlow()).rejects.toThrow("guest_read_only");
    expect(api.rpc).not.toHaveBeenCalled();
  });

  describe("join flow recovers from crew failures", () => {
    const official = { kind: "official" as const, seasonId: "season-id" };
    for (const [label, reason, message] of [
      ["full crew", "crew_full", "events.crewFull"],
      ["invalid code", "crew_not_found", "events.invalidCode"],
      ["closed crew", "challenge_ended", "events.closed"],
    ] as const) {
      it(`${label}: joins the chosen challenge, then Today offers one retry`, async () => {
        api.rpc.mockImplementation(async (fn: string) =>
          fn === "join_crew" ? { error: { message: reason } } : { error: null },
        );
        saveStartFlow({ challenge: official, play: { mode: "code", code: "ABC123" } });

        const result = await finishStartFlow();

        expect(api.rpc.mock.calls).toEqual([
          ["join_crew", { _code: "ABC123" }],
          ["join_season", { _season_id: "season-id", _mode: "solo" }],
        ]);
        expect(result.crewFailed).toEqual({ reason, action: { kind: "code" } });
        expect(readCrewRetry()).toEqual(result.crewFailed);
        expect(crewRetryMessage(reason)).toBe(message);
        expect(sessionStorage.getItem(START_FLOW_KEY)).toBeNull();
      });
    }

    it("find-a-crew failure keeps the join and offers to find again", async () => {
      api.rpc.mockImplementation(async (fn: string) =>
        fn === "find_challenge_crew" ? { error: { message: "crew_full" } } : { error: null },
      );
      saveStartFlow({ challenge: official, play: { mode: "find" } });

      const result = await finishStartFlow();

      expect(result.crewFailed).toEqual({ reason: "crew_full", action: { kind: "find" } });
      expect(sessionStorage.getItem(CREW_RETRY_KEY)).not.toBeNull();
      expect(sessionStorage.getItem(START_FLOW_KEY)).toBeNull();
    });

    it("an unrelated join error is still reported, not hidden behind a banner", async () => {
      api.rpc.mockResolvedValue({ error: { message: "active_challenge_exists" } });
      saveStartFlow({ challenge: official, play: { mode: "code", code: "ABC123" } });
      await expect(finishStartFlow()).rejects.toMatchObject({ message: "active_challenge_exists" });
      expect(readCrewRetry()).toBeNull();
    });
  });
});
