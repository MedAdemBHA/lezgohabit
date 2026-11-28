import { supabase } from "@/integrations/supabase/client";

export const START_FLOW_KEY = "lezgo_start_flow";
export const PROFILE_SETUP_REQUIRED = "profile_setup_required";
const RESUME_TOKEN_KEY = "lezgo_start_resume_token";
const RESUME_FLOW_KEY = "lezgo_start_resume";
const RESUME_TTL_MS = 60 * 60 * 1000;
type ResumableFlow = { token: string; flow: StartFlow; expiresAt: number };

export const MAX_CHALLENGE_HABITS = 6;
type PersonalPick = { key: string; target: number };
export type StartFlow =
  | {
      challenge: { kind: "official"; seasonId: string } | { kind: "creator"; code: string };
      play: { mode: "solo" | "find" | "create" } | { mode: "code"; code: string };
    }
  | { challenge: { kind: "personal"; name: string; days: number; habits: PersonalPick[] }; play: { mode: "solo" } }
  | { challenge: { kind: "crew_invite"; code: string } };

export function toggleStartHabit(current: string[], key: string): string[] {
  if (current.includes(key)) return current.filter((item) => item !== key);
  if (current.length >= MAX_CHALLENGE_HABITS) return current;
  return [...current, key];
}

export function saveStartFlow(flow: StartFlow) {
  sessionStorage.setItem(START_FLOW_KEY, JSON.stringify(flow));
  try {
    const token = crypto.randomUUID();
    sessionStorage.setItem(RESUME_TOKEN_KEY, token);
    localStorage.setItem(RESUME_FLOW_KEY, JSON.stringify({ token, flow, expiresAt: Date.now() + RESUME_TTL_MS }));
  } catch { /* Same-tab sign-in still works when persistent storage is unavailable. */ }
}

export function startFlowResumeToken() {
  return sessionStorage.getItem(RESUME_TOKEN_KEY);
}

export function resumeStartFlow(token: string) {
  if (token === startFlowResumeToken() && readStartFlow()) return true;
  sessionStorage.removeItem(START_FLOW_KEY);
  sessionStorage.removeItem(RESUME_TOKEN_KEY);
  try {
    const saved = JSON.parse(localStorage.getItem(RESUME_FLOW_KEY) ?? "null") as ResumableFlow | null;
    if (!saved || saved.token !== token || saved.expiresAt <= Date.now()) return false;
    sessionStorage.setItem(START_FLOW_KEY, JSON.stringify(saved.flow));
    sessionStorage.setItem(RESUME_TOKEN_KEY, token);
    return true;
  } catch {
    return false;
  }
}

export function clearStartFlow() {
  const token = startFlowResumeToken();
  sessionStorage.removeItem(START_FLOW_KEY);
  sessionStorage.removeItem(RESUME_TOKEN_KEY);
  sessionStorage.removeItem("lezgo_pending_code");
  sessionStorage.removeItem("lezgo_challenge_invite");
  try {
    const saved = JSON.parse(localStorage.getItem(RESUME_FLOW_KEY) ?? "null") as ResumableFlow | null;
    if (saved?.token === token) localStorage.removeItem(RESUME_FLOW_KEY);
  } catch { /* The session has already been cleared. */ }
}

export function readStartFlow(): StartFlow | null {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(START_FLOW_KEY) ?? "null");
    if (!value || typeof value !== "object") return null;
    return value as StartFlow;
  } catch {
    return null;
  }
}

/** The crew step failed after the challenge was joined: Today shows a banner with one retry. */
export type CrewRetry = {
  /** Server error key (crew_full, crew_not_found, challenge_ended, ...). */
  reason: string;
  action: { kind: "find" } | { kind: "create"; name: string } | { kind: "code" };
};
export const CREW_RETRY_KEY = "lezgo_crew_retry";

function errorKey(error: unknown) {
  return (error as { message?: string } | null)?.message ?? "";
}

export function saveCrewRetry(retry: CrewRetry) {
  try {
    sessionStorage.setItem(CREW_RETRY_KEY, JSON.stringify(retry));
  } catch {
    /* the banner is a convenience; the join itself already succeeded */
  }
}

export function readCrewRetry(): CrewRetry | null {
  try {
    return JSON.parse(sessionStorage.getItem(CREW_RETRY_KEY) ?? "null") as CrewRetry | null;
  } catch {
    return null;
  }
}

export function clearCrewRetry() {
  try {
    sessionStorage.removeItem(CREW_RETRY_KEY);
  } catch {
    /* nothing to clear */
  }
}

/** Banner copy for a failed crew step. */
export function crewRetryMessage(reason: string) {
  if (reason.includes("crew_full")) return "events.crewFull";
  if (reason.includes("crew_not_found") || reason.includes("invalid_code")) return "events.invalidCode";
  if (reason.includes("challenge_ended") || reason.includes("crew_closed") || reason.includes("closed"))
    return "events.closed";
  return "events.crewSetup";
}

/** Crew failures that leave the selected challenge joinable on its own. */
const RECOVERABLE_CREW = ["crew_full", "crew_not_found", "invalid_code", "crew_closed", "challenge_ended"];

export async function finishStartFlow(): Promise<{ crewFailed: CrewRetry | null }> {
  const flow = readStartFlow();
  if (!flow) throw new Error("start_flow_missing");
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw authError ?? new Error("not_authenticated");
  const uid = auth.user.id;
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("display_name,onboarded,is_demo")
    .eq("id", uid)
    .single();
  if (profileError) throw profileError;
  if (profile.is_demo || auth.user.email === "demo@lezgo.app") {
    throw new Error("guest_read_only");
  }
  if (!profile.onboarded) throw new Error(PROFILE_SETUP_REQUIRED);

  if (!("play" in flow)) {
    // From an invite link there is no other challenge to fall back to: report the error there.
    const { error } = await supabase.rpc("join_crew", { _code: flow.challenge.code });
    if (error) throw error;
    clearStartFlow();
    return { crewFailed: null };
  }
  if (flow.play.mode === "code") {
    // A crew code resolves its own challenge, so never join the screen's
    // default selection first.
    const { error } = await supabase.rpc("join_crew", { _code: flow.play.code });
    if (!error) {
      clearStartFlow();
      return { crewFailed: null };
    }
    const reason = errorKey(error);
    if (!RECOVERABLE_CREW.some((key) => reason.includes(key)) || flow.challenge.kind === "personal")
      throw error;
    // The crew can't be joined (full, unknown or closed): join the chosen challenge alone,
    // then let Today offer one retry.
    await joinSelected(flow.challenge, "solo");
    const crewFailed: CrewRetry = { reason, action: { kind: "code" } };
    saveCrewRetry(crewFailed);
    clearStartFlow();
    return { crewFailed };
  } else if (flow.challenge.kind === "official") {
    const { error } = await supabase.rpc("join_season", { _season_id: flow.challenge.seasonId, _mode: flow.play.mode === "solo" ? "solo" : "crew" });
    if (error) throw error;
  } else if (flow.challenge.kind === "creator") {
    const { error } = await supabase.rpc("join_challenge", { _code: flow.challenge.code, _mode: flow.play.mode === "solo" ? "solo" : "crew" });
    if (error) throw error;
  } else {
    const { error } = await supabase.rpc("create_personal_challenge", {
      _name: flow.challenge.name,
      _days: flow.challenge.days,
      _habits: flow.challenge.habits,
    });
    if (error) throw error;
  }

  const mode = flow.play.mode;
  let crewFailed: CrewRetry | null = null;
  if (mode === "find") {
    const { error } = await supabase.rpc("find_challenge_crew");
    if (error) crewFailed = { reason: errorKey(error), action: { kind: "find" } };
  } else if (mode === "create") {
    const firstName = profile.display_name.trim().split(/\s+/)[0] || "My";
    const name = `${firstName}'s crew`;
    const { error } = await supabase.rpc("create_crew", { _name: name, _kind: "squad", _max_members: 6 });
    if (error && !error.message.includes("already_in_crew"))
      crewFailed = { reason: errorKey(error), action: { kind: "create", name } };
  }

  if (crewFailed) saveCrewRetry(crewFailed);
  clearStartFlow();
  return { crewFailed };
}

async function joinSelected(
  challenge: { kind: "official"; seasonId: string } | { kind: "creator"; code: string },
  mode: "solo" | "crew",
) {
  const { error } =
    challenge.kind === "official"
      ? await supabase.rpc("join_season", { _season_id: challenge.seasonId, _mode: mode })
      : await supabase.rpc("join_challenge", { _code: challenge.code, _mode: mode });
  if (error) throw error;
}
