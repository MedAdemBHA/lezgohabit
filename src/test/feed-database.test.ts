/** Run only with agent-created fixtures: LEZGO_TEST_SESSION_DIR contains player1..4.json.
 * Sessions never appear in output; all created posts are deleted by their author.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadEnv } from "vite";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import type { Database } from "@/integrations/supabase/types";
const directory = process.env["LEZGO_TEST_SESSION_DIR"];
const sid = process.env["LEZGO_TEST_SEASON"];
const clients: SupabaseClient<Database>[] = [];
const ids: string[] = [];
const posts: string[] = [];
function player(i: number) {
  const c = clients[i];
  if (!c) throw Error("missing fixture");
  return c;
}
async function create(
  i: number,
  type: string,
  body: string,
  extra: { _visibility?: string; _habit_key?: string } = {},
) {
  if (!sid) throw Error("missing season");
  const r = await player(i).rpc("create_post", {
    _season_id: sid,
    _type: type,
    _body: body,
    ...extra,
  });
  if (r.error) throw Error(r.error.message);
  if (!r.data) throw Error("missing post");
  posts.push(r.data);
  return r.data;
}
async function feed(i: number) {
  if (!sid) throw Error("missing season");
  const r = await player(i).rpc("proof_feed", { _season_id: sid });
  if (r.error) throw Error(r.error.message);
  return r.data as { id: string; hidden: boolean; habit_key: string | null; stats: object }[];
}
describe.skipIf(!directory || !sid)("proof feed server rules", () => {
  beforeAll(() => {
    const env = loadEnv("test", process.cwd(), "");
    const url = env["VITE_SUPABASE_URL"];
    const key = env["VITE_SUPABASE_PUBLISHABLE_KEY"] ?? env["VITE_SUPABASE_ANON_KEY"];
    if (!directory || !url || !key) throw Error("missing fixture settings");
    for (let n = 1; n <= 4; n++) {
      const saved = JSON.parse(readFileSync(join(directory, `player${n}.json`), "utf8")) as {
        session: { access_token: string; user: { id: string } };
      };
      ids.push(saved.session.user.id);
      clients.push(
        createClient<Database>(url, key, {
          auth: { persistSession: false, autoRefreshToken: false, storageKey: `fixture-${n}` },
          global: { headers: { Authorization: `Bearer ${saved.session.access_token}` } },
        }),
      );
    }
  });
  afterAll(async () => {
    for (const id of posts)
      for (let i = 0; i < 4; i++)
        await player(i).rpc("post_action", { _post_id: id, _action: "delete" });
  });
  it("uses floor for the exact 154-point example", async () => {
    const r = await player(0).rpc("scoring_preview", {
      _picked: 5,
      _done: 4,
      _streak: 8,
      _proof: true,
      _chaos: true,
      _crew: true,
      _lift: 0,
    });
    expect(r.error).toBeNull();
    expect(r.data).toMatchObject({ habits: 80, stacks: 30, multiplier: 1.4, total: 154 });
  });
  it("65 bonus points and capped multiplier floor to 247, not 248", async () => {
    const r = await player(0).rpc("scoring_preview", {
      _picked: 8,
      _done: 8,
      _streak: 40,
      _proof: true,
      _chaos: true,
      _crew: true,
      _lift: 3,
    });
    expect(r.data).toMatchObject({
      habits: 100,
      stacks: 65,
      multiplier: 1.5,
      total: 247,
      max: 247,
    });
  });
  it("rejects more than 8 habits", async () => {
    const r = await player(0).rpc("scoring_preview", {
      _picked: 9,
      _done: 1,
      _streak: 0,
      _proof: false,
      _chaos: false,
      _crew: false,
      _lift: 0,
    });
    expect(r.error?.message).toContain("invalid_input");
  });
  it("rejects more than 3 lift beats", async () => {
    const r = await player(0).rpc("scoring_preview", {
      _picked: 1,
      _done: 1,
      _streak: 0,
      _proof: false,
      _chaos: false,
      _crew: false,
      _lift: 4,
    });
    expect(r.error?.message).toContain("invalid_input");
  });
  it("rejects more completed habits than selected", async () => {
    const r = await player(0).rpc("scoring_preview", {
      _picked: 2,
      _done: 3,
      _streak: 0,
      _proof: false,
      _chaos: false,
      _crew: false,
      _lift: 0,
    });
    expect(r.error?.message).toContain("invalid_input");
  });
  it("does not repeat the proof bonus and Thoughts never add points", async () => {
    await create(0, "proof", "Prime current recomputation");
    const before = await player(0)
      .from("daily_scores")
      .select("stack_points,total")
      .eq("user_id", ids[0] ?? "")
      .eq("season_id", sid ?? "")
      .order("day", { ascending: false })
      .limit(1)
      .single();
    expect(before.error).toBeNull();
    await create(0, "proof", "Regression proof one");
    await create(0, "proof", "Regression proof two");
    await create(0, "thought", "Regression thought");
    const after = await player(0)
      .from("daily_scores")
      .select("stack_points,total")
      .eq("user_id", ids[0] ?? "")
      .eq("season_id", sid ?? "")
      .order("day", { ascending: false })
      .limit(1)
      .single();
    expect(after.data).toEqual(before.data);
  });
  it("limits body to 280 Unicode characters", async () => {
    await create(0, "thought", "🙂".repeat(280));
    const r = await player(0).rpc("create_post", {
      _season_id: sid ?? "",
      _type: "thought",
      _body: "x".repeat(281),
    });
    expect(r.error?.message).toContain("invalid_post");
  });
  it("one reaction per user per post; changing kind replaces it", async () => {
    const id = await create(0, "thought", "Reaction regression");
    expect(
      (await player(1).rpc("react_post", { _post_id: id, _kind: "respect" })).error,
    ).toBeNull();
    expect((await player(1).rpc("react_post", { _post_id: id, _kind: "legend" })).error).toBeNull();
    const r = await player(1).from("post_reactions").select("kind").eq("post_id", id);
    expect(r.data).toEqual([{ kind: "legend" }]);
  });
  it("only three distinct reports hide a post; the author can still read it", async () => {
    const id = await create(0, "thought", "Moderation regression");
    for (const i of [1, 1, 2])
      expect(
        (
          await player(i).rpc("post_action", {
            _post_id: id,
            _action: "report",
            _reason: "Test report",
          })
        ).error,
      ).toBeNull();
    expect((await feed(3)).find((p) => p.id === id)?.hidden).toBe(false);
    expect(
      (
        await player(3).rpc("post_action", {
          _post_id: id,
          _action: "report",
          _reason: "Third distinct report",
        })
      ).error,
    ).toBeNull();
    expect((await feed(1)).some((p) => p.id === id)).toBe(false);
    expect((await feed(0)).find((p) => p.id === id)?.hidden).toBe(true);
  });
  it("crew-only posts are visible to crewmates, not outsiders", async () => {
    const id = await create(0, "thought", "Crew privacy regression", { _visibility: "crew" });
    expect((await feed(1)).some((p) => p.id === id)).toBe(true);
    expect((await feed(2)).some((p) => p.id === id)).toBe(false);
    expect(
      (await player(2).rpc("react_post", { _post_id: id, _kind: "respect" })).error?.message,
    ).toContain("forbidden");
  });
  it("non-owners cannot delete a post", async () => {
    const id = await create(0, "thought", "Ownership regression");
    expect(
      (await player(1).rpc("post_action", { _post_id: id, _action: "delete" })).error?.message,
    ).toContain("forbidden");
  });
  it("raw private faith stats and direct post mutation remain inaccessible", async () => {
    const r = await player(1).from("posts").select("stats").limit(1);
    expect(r.error).not.toBeNull();
    const w = await player(1)
      .from("posts")
      .insert({
        season_id: sid ?? "",
        user_id: ids[1] ?? "",
        day: "2026-11-23",
        type: "thought",
        body: "Direct write must fail",
      });
    expect(w.error).not.toBeNull();
  });
  it("equipment and reminder preferences are owner-only", async () => {
    const uid = ids[0] ?? "";
    const r = await player(1).from("user_preferences").select("*").eq("user_id", uid);
    expect(r.data).toEqual([]);
    const w = await player(1)
      .from("user_preferences")
      .upsert({ user_id: uid, distance_unit: "km" });
    expect(w.error).not.toBeNull();
  });
  it("the first proof adds exactly 10 stack points", async () => {
    const uid = ids[2] ?? "";
    const before = await player(2)
      .from("daily_scores")
      .select("stack_points")
      .eq("user_id", uid)
      .eq("season_id", sid ?? "")
      .order("day", { ascending: false })
      .limit(1)
      .maybeSingle();
    expect(before.error).toBeNull();
    const id = await create(2, "proof", "First proof award regression");
    const post = await player(2).from("posts").select("day").eq("id", id).single();
    const after = await player(2)
      .from("daily_scores")
      .select("stack_points")
      .eq("user_id", uid)
      .eq("season_id", sid ?? "")
      .eq("day", post.data?.day ?? "")
      .single();
    expect(after.error).toBeNull();
    expect(Number(after.data?.stack_points) - Number(before.data?.stack_points ?? 0)).toBe(10);
  });
  it("faith habit tags and stats are private until explicit public consent", async () => {
    const id = await create(0, "thought", "Faith privacy regression", { _habit_key: "salat" });
    expect((await feed(0)).find((p) => p.id === id)?.habit_key).toBe("salat");
    const other = (await feed(1)).find((p) => p.id === id);
    expect(other?.habit_key).toBeNull();
    expect(other?.stats).toEqual({});
    const changed = await player(0)
      .from("profiles")
      .update({ faith_public: true })
      .eq("id", ids[0] ?? "");
    expect(changed.error).toBeNull();
    expect((await feed(1)).find((p) => p.id === id)?.habit_key).toBe("salat");
    expect(
      (
        await player(0)
          .from("profiles")
          .update({ faith_public: false })
          .eq("id", ids[0] ?? "")
      ).error,
    ).toBeNull();
  });
  it("average/day divides by elapsed participation days including misses", async () => {
    const uid = ids[0] ?? "";
    const scores = await player(0)
      .from("daily_scores")
      .select("total")
      .eq("user_id", uid)
      .eq("season_id", sid ?? "");
    const entry = await player(0)
      .from("season_entries")
      .select("joined_at")
      .eq("user_id", uid)
      .eq("season_id", sid ?? "")
      .single();
    expect(entry.error).toBeNull();
    const days = Number(process.env["LEZGO_TEST_ELAPSED_DAYS"]);
    expect(days).toBe(2);
    const r = await player(0).rpc("scoreboard_v4", {
      _season_id: sid ?? "",
      _scope: "world",
      _period: "season",
      _metric: "average",
    });
    expect(r.error).toBeNull();
    const result = r.data as { me: { points: number } };
    const sum = (scores.data ?? []).reduce((n, s) => n + s.total, 0);
    expect(result.me.points).toBe(Math.round((sum / days) * 100) / 100);
  });
});
