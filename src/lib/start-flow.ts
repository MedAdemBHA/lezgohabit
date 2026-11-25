import { supabase } from "@/integrations/supabase/client";

export const START_FLOW_KEY = "lezgo_start_flow";
const RESUME_TOKEN_KEY = "lezgo_start_resume_token";
const RESUME_FLOW_KEY = "lezgo_start_resume";
const RESUME_TTL_MS = 60 * 60 * 1000;
type ResumableFlow = { token: string; flow: StartFlow; expiresAt: number };

export const MAX_CHALLENGE_HABITS = 6;
type PersonalPick = { key: string; target: number };
export type StartFlow =
  | { challenge: { kind: "official"; seasonId: string }; play: { mode: "solo" | "find" | "create" } }
  | { challenge: { kind: "creator"; code: string }; play: { mode: "solo" | "find" | "create" } }
  | { challenge: { kind: "personal"; name: string; days: number; habits: PersonalPick[] }; play: { mode: "solo" } }
  | { challenge: { kind: "crew_invite"; code: string } }
  | { challenge: { kind: "creator"; code: string }; play: { mode: "code"; code: string } }
  | { challenge: { kind: "official"; seasonId: string }; play: { mode: "code"; code: string } };

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

export async function finishStartFlow() {
  const flow = readStartFlow();
  if (!flow) throw new Error("start_flow_missing");
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw authError ?? new Error("not_authenticated");
  const uid = auth.user.id;
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("handle,display_name,country_code,language,onboarded,is_demo")
    .eq("id", uid)
    .single();
  if (profileError) throw profileError;
  if (profile.is_demo || auth.user.email === "demo@lezgo.app") {
    clearStartFlow();
    return;
  }

  let handle = profile.handle;
  let displayName = profile.display_name.trim();
  const metadata = auth.user.user_metadata;
  const suppliedName = typeof metadata["full_name"] === "string"
    ? metadata["full_name"]
    : typeof metadata["name"] === "string"
      ? metadata["name"]
      : "";
  if (!profile.onboarded) displayName = suppliedName.trim() || displayName || auth.user.email?.split("@")[0] || "Lezgo player";

  if (!profile.onboarded) {
    const available = await supabase.rpc("handle_available", { _handle: handle });
    if (available.error) throw available.error;
    if (!available.data) {
      const seed = handle.replace(/[^a-z0-9_]/g, "").slice(0, 14) || "player";
      let found = false;
      for (let n = 2; n < 10000; n += 1) {
        const suffix = String(n);
        const candidate = `${seed.slice(0, 20 - suffix.length)}${suffix}`;
        const check = await supabase.rpc("handle_available", { _handle: candidate });
        if (check.error) throw check.error;
        if (check.data) {
          handle = candidate;
          found = true;
          break;
        }
      }
      if (!found) throw new Error("handle_unavailable");
    }
    const savedLanguage = typeof localStorage !== "undefined" ? localStorage.getItem("lezgo_lang") : null;
    const language = ["en", "fr", "ar", "aeb"].includes(savedLanguage ?? "") ? savedLanguage! : profile.language;
    const { error } = await supabase.from("profiles").update({
      display_name: displayName,
      handle,
      country_code: profile.country_code || "TN",
      language,
      onboarded: true,
    }).eq("id", uid);
    if (error) throw error;
  }

  if (!("play" in flow)) {
    const { error } = await supabase.rpc("join_crew", { _code: flow.challenge.code });
    if (error) throw error;
    clearStartFlow();
    return;
  }
  if (flow.play.mode === "code") {
    // A crew code resolves its own challenge, so never join the screen's
    // default selection first.
    const { error } = await supabase.rpc("join_crew", { _code: flow.play.code });
    if (error) throw error;
    clearStartFlow();
    return;
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
  if (mode === "find") {
    const { error } = await supabase.rpc("find_challenge_crew");
    if (error) throw new Error("crew_setup_pending", { cause: error });
  } else if (mode === "create") {
    const firstName = displayName.split(/\s+/)[0] || "My";
    const { error } = await supabase.rpc("create_crew", { _name: `${firstName}'s crew`, _kind: "squad", _max_members: 6 });
    if (error && !error.message.includes("already_in_crew")) throw new Error("crew_setup_pending", { cause: error });
  }

  clearStartFlow();
}
