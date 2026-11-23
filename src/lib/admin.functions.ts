import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { DEMO_PEOPLE } from "./admin-rules";
import type { Json } from "@/integrations/supabase/types";

export const adminDemo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z.object({ action: z.enum(["seed", "clear", "reseed"]) }).parse(v),
  )
  .handler(async ({ data, context }) => {
    const { data: allowed, error: accessError } = await context.supabase.rpc("admin_authorized");
    if (accessError || allowed !== true) throw new Error("forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.action === "seed") {
      const { data: existing, error } = await supabaseAdmin.from("seasons").select("id").eq("slug", "demo-winter-arc").eq("is_demo", true).maybeSingle();
      if (error) throw new Error("demo_unavailable");
      if (existing) {
        const { error: auditError } = await context.supabase.rpc("admin_action", { _action: "seed_demo_existing" });
        if (auditError) throw new Error("demo_unavailable");
        return { ok: true };
      }
    }
    if (data.action === "clear") {
      const { data: result, error } = await context.supabase.rpc("admin_clear_demo");
      if (error) throw new Error(error.message);
      const ids = (result as unknown as { auth_ids: string[] }).auth_ids;
      let failed = 0;
      for (const id of ids) {
        const { error: e } = await supabaseAdmin.auth.admin.deleteUser(id);
        if (e) failed++;
      }
      if (failed) throw new Error("demo_cleanup_incomplete");
      return { ok: true };
    }
    const password = process.env["DEMO_PASSWORD"];
    if (!password) throw new Error("demo_not_configured");
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (listError) throw new Error("demo_unavailable");
    const people: Json[] = [];
    const created: string[] = [];
    try {
      for (const [index, person] of DEMO_PEOPLE.entries()) {
        const email = index === 0 ? "demo@lezgo.app" : `player${index}@demo.lezgo.invalid`;
        let user = users.users.find((u) => u.email === email);
        if (!user) {
          const { data: newUser, error } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: person[0] },
          });
          if (error || !newUser.user) throw new Error("demo_provision_failed");
          user = newUser.user;
          created.push(user.id);
        }
        if (index === 0) {
          const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, { password });
          if (error) throw new Error("demo_provision_failed");
        }
        people.push({
          id: user.id,
          name: person[0],
          handle: person[1],
          city: person[2],
          country: person[3],
          email,
        });
      }
      const { error } = await context.supabase.rpc("admin_seed_demo", {
        _people: people,
        _replace: data.action === "reseed",
      });
      if (error) throw new Error(error.message);
      return { ok: true };
    } catch (e) {
      for (const id of created) await supabaseAdmin.auth.admin.deleteUser(id);
      throw e;
    }
  });

async function digest(value: string) {
  const secret = process.env["DEVICE_HASH_SECRET"];
  if (!secret) throw new Error("security_not_configured");
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const bytes = await crypto.subtle.sign("HMAC", key, enc.encode(value));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}
export const enterDemo = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const key = await digest(getRequestHeader("cf-connecting-ip") ?? "shared");
  const { data: allowed, error: rateError } = await supabaseAdmin.rpc("claim_demo_login", {
    _key: key,
  });
  if (rateError || !allowed) throw new Error("demo_rate_limit");
  const { data: ready } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("is_demo", true)
    .eq("handle", "demo_you")
    .eq("onboarded", true)
    .maybeSingle();
  if (!ready) throw new Error("demo_not_ready");
  const url = process.env["SUPABASE_URL"];
  const publicKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
  const password = process.env["DEMO_PASSWORD"];
  if (!url || !publicKey || !password) throw new Error("demo_not_configured");
  const auth = createClient(url, publicKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (publicKey.startsWith("sb_") && h.get("Authorization") === `Bearer ${publicKey}`)
          h.delete("Authorization");
        h.set("apikey", publicKey);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
  const { data, error } = await auth.auth.signInWithPassword({ email: "demo@lezgo.app", password });
  if (error || !data.session || data.user?.id !== ready.id) throw new Error("demo_unavailable");
  return { access_token: data.session.access_token, refresh_token: data.session.refresh_token };
});
export const recordPresence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ device: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const device = await digest(`device:${data.device}`);
    const network = await digest(
      `network:${getRequestHeader("cf-connecting-ip") ?? context.userId}`,
    );
    const { error } = await context.supabase.rpc("admin_security_presence", {
      _device: device,
      _network: network,
    });
    if (error) throw new Error("presence_unavailable");
    return { ok: true };
  });
export const fingerprintProof = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ path: z.string().max(300) }).parse(v))
  .handler(async ({ data, context }) => {
    if (!data.path.startsWith(`${context.userId}/`)) throw new Error("forbidden");
    const { data: blob, error } = await context.supabase.storage.from("proofs").download(data.path);
    if (error || !blob || blob.size > 10_000_000) throw new Error("proof_unavailable");
    const hash = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
    const fingerprint = Array.from(new Uint8Array(hash), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: writeError } = await supabaseAdmin.rpc("register_saved_proof", {
      _path: data.path,
      _fingerprint: fingerprint,
      _user: context.userId,
    });
    if (writeError) throw new Error("proof_unavailable");
    return { ok: true };
  });

export const adminAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z.object({ action: z.enum(["ban", "unban", "delete_user"]), user: z.string().uuid() }).parse(v),
  )
  .handler(async ({ data, context }) => {
    const { data: allowed, error } = await context.supabase.rpc("admin_authorized");
    if (error || allowed !== true) throw new Error("forbidden");
    const mutation =
      data.action === "delete_user"
        ? await context.supabase.rpc("admin_cleanup_account", { _user: data.user })
        : await context.supabase.rpc("admin_action", { _action: data.action, _target: data.user });
    if (mutation.error) throw new Error("user_protected");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const result =
      data.action === "delete_user"
        ? await supabaseAdmin.auth.admin.deleteUser(data.user)
        : await supabaseAdmin.auth.admin.updateUserById(data.user, {
            ban_duration: data.action === "ban" ? "876000h" : "none",
          });
    if (result.error) throw new Error("account_update_incomplete");
    return { ok: true };
  });

export const adminProofPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ post: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { data: allowed, error: access } = await context.supabase.rpc("admin_authorized");
    if (access || allowed !== true) throw new Error("forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: post, error } = await supabaseAdmin
      .from("posts")
      .select("image_url")
      .eq("id", data.post)
      .single();
    if (error || !post?.image_url) return { url: null };
    const { data: signed, error: signedError } = await supabaseAdmin.storage
      .from("proofs")
      .createSignedUrl(post.image_url, 180);
    if (signedError || !signed) return { url: null };
    const browserUrl = process.env["VITE_SUPABASE_URL"];
    const serverUrl = process.env["SUPABASE_URL"];
    return {
      url:
        browserUrl && serverUrl
          ? signed.signedUrl.replace(serverUrl, browserUrl)
          : signed.signedUrl,
    };
  });
