// Guest mode: the shared sample account is read-only (enforced by Postgres _guest_guard).
// In the browser we short-circuit known write requests so the guest sees the
// "create an account" sheet instantly instead of waiting for the server refusal.
const WRITE_RPCS = new Set([
  "activate_challenge","assign_sub_squad","boss_action","hit_boss","reset_boss","buddy_action","checkin_upsert",
  "close_my_day","create_boss_lesson","create_challenge","create_crew","create_post","create_sub_squad",
  "cancel_habit_timer","complete_habit_timer","create_creator_challenge","create_personal_challenge","delete_my_account","demo_reset_day","detox_action","detox_duel_action","find_challenge_crew","habit_timer_heartbeat","join_challenge","join_crew","join_season",
  "leave_crew","mark_prayer","log_lift","log_lift_session","log_screen_time","post_action","post_daily_proof","post_small_wins",
  "react_post","recompute_day","register_proof_fingerprint","register_push","report_buddy","request_creator","review_creator_request","seal_capsule","surrender_challenge","toggle_challenge_respect","admin_set_challenge_habits",
  "send_nudge","set_chaos_done","set_season_reminder","spin_daily_chaos","start_habit_timer","toggle_respect",
]);
// Read receipts are harmless bookkeeping on the sample account's own inbox.
const PASS_TABLES = new Set(["announcement_receipts", "notifications"]);

let guest = false;
const listeners = new Set<() => void>();
export const isGuestMode = () => guest;
export function setGuestMode(v: boolean) { guest = v; }
export function openGuestSheet() { listeners.forEach((l) => l()); }
export function onGuestSheet(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }

export function isGuestWrite(url: string, method: string): boolean {
  const m = method.toUpperCase();
  if (m === "GET" || m === "HEAD" || m === "OPTIONS") return false;
  let path: string;
  try { path = new URL(url, "http://x").pathname; } catch { return false; }
  if (path.includes("/storage/v1/object")) return true;
  const rest = path.split("/rest/v1/")[1];
  if (rest === undefined) return false;
  if (rest.startsWith("rpc/")) return WRITE_RPCS.has(rest.slice(4));
  return !PASS_TABLES.has(rest.split("/")[0] ?? "");
}

let installed = false;
export function installGuestFetch() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const orig = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (guest) {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const method = init?.method ?? (input instanceof Request ? input.method : "GET");
      if (/\/rest\/v1\/rpc\/(claim_moment|remind_moment)/.test(url)) {
        // Moments are claimed automatically; quietly skip them for guests (server refuses anyway).
        return Promise.resolve(new Response(url.includes("claim_moment") ? "false" : "null", { status: 200, headers: { "content-type": "application/json" } }));
      }
      if (isGuestWrite(url, method)) {
        openGuestSheet();
        return Promise.resolve(new Response(JSON.stringify({ code: "P0001", message: "guest_read_only", details: null, hint: null }), { status: 400, headers: { "content-type": "application/json" } }));
      }
    }
    return orig(input, init);
  };
}
