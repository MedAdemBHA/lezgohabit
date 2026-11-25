# Deploying Lezgo without Lovable

The app runs as a **Cloudflare Worker** on top of your own **Supabase** project `lezgo`
(`https://yjkniwjneqmtatwozcpv.supabase.co`). The database is already set up: all 62
migrations (0000–0062), season content, the 15-minute day-lock job and the notifications job.

## 1. Cloudflare (about 10 min)

1. https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Import a repository** → GitHub → `lezgohabit`.
2. Project name **`lezgo`** (must match `wrangler.jsonc`).
   - Build command: `bun run build`
   - Deploy command: `npx wrangler deploy`
   - Production branch: `own-hosting`
3. **Settings → Variables and Secrets** (runtime), then redeploy:

| Name | Type | Value |
|---|---|---|
| `APP_URL` | Text | Your public app origin, e.g. `https://lezgo.<you>.workers.dev` (no trailing slash) |
| `APP_URL` | Text | your public address, e.g. `https://lezgo.vercel.app` (link previews need absolute image URLs) |
| `SUPABASE_URL` | Text | `https://yjkniwjneqmtatwozcpv.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | Text | `sb_publishable_6RNKjzRWhGs6un9RGDXXZg_dgIqZpJV` |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret | Supabase → Project Settings → API Keys → `service_role` / secret key |
| `DEMO_PASSWORD` | Secret | any long random password (guest mode signs in with it) |
| `DEVICE_HASH_SECRET` | Secret | any long random string |
| `LOVABLE_CRON_SECRET` | Secret | run in Supabase SQL editor: `select decrypted_secret from vault.decrypted_secrets where name = 'lezgo_cron_secret';` |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Secret | only when you turn push on: `npx web-push generate-vapid-keys`; subject `mailto:you@…` |

The browser build reads `VITE_SUPABASE_*` from the committed `.env` (public values only).
For local SEO checks, run `APP_URL=http://localhost:5173 bun run dev` (adjust the port if Vite selects another one). Production canonical, hreflang and sitemap URLs use the Worker runtime variable above; browser invite links use the active app origin.

## Option B: Vercel (instead of Cloudflare)

Tested: the app builds for Vercel with `NITRO_PRESET=vercel` (Node 22 function + static assets in `.vercel/output`).

1. https://vercel.com/new → import `lezgohabit` from GitHub and set `main` as the production branch.
   - `vercel.json` selects the **TanStack Start** framework and runs `NITRO_PRESET=vercel bun run build`.
     Leave Output Directory empty; Nitro writes the Vercel Build Output API files to `.vercel/output`.
2. **Settings → Environment Variables** (Production + Preview):
   `APP_URL=https://<name>.vercel.app`, plus every variable from the Cloudflare table above
   (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DEMO_PASSWORD`, `DEVICE_HASH_SECRET`,
   `LOVABLE_CRON_SECRET`, and VAPID keys when push is on).
3. **Settings → Functions → Region: Paris (cdg1)** — next to the Supabase project (eu-west-3, Paris).
4. Supabase → Authentication → URL Configuration: Site URL and Redirect URL = your Vercel address (`https://<name>.vercel.app/**`).
5. Store the app URL for the notifications job: `select vault.create_secret('https://<name>.vercel.app', 'lezgo_app_url');`

Note: Vercel's free Hobby plan is for non-commercial personal use only; once Lezgo earns money (sponsors, paid creators, ads), move to Pro.

## 2. Supabase login settings

Supabase → **Authentication**:
- **URL Configuration**: Site URL = your Worker URL (e.g. `https://lezgo.<you>.workers.dev`); add `https://lezgo.<you>.workers.dev/**` to Redirect URLs.
- **Sign In / Providers → Google**: create an OAuth client (type *Web*) in Google Cloud Console with redirect URI
  `https://yjkniwjneqmtatwozcpv.supabase.co/auth/v1/callback`, then paste its Client ID and Secret here.
- **Emails**: Supabase's built-in mailer delivers to project team addresses. Configure and test custom SMTP under **Authentication → Emails → SMTP** before setting the frontend build variable `VITE_PUBLIC_EMAIL_SIGNIN=true`. Google is the public sign-in option until that flag is enabled. The admin sign-in screen still offers email for team testing.

## 3. After the first deploy

1. Store the app URL so the notifications job starts calling it:
   `select vault.create_secret('https://lezgo.<you>.workers.dev', 'lezgo_app_url');`
2. Provision the three demo secrets in the hosting environment, redeploy, and sign in with `med.adem.1999@gmail.com` (becomes admin automatically). Go to **Admin → Demo data → Seed demo**. The guest button appears after the sample account is ready.
3. Accounts from the old Lovable app are not moved; people sign up again.

## Changing the database from now on

Add a new numbered file in `drizzle/migrations/` and apply it to the Supabase project
(Supabase SQL editor or `supabase db push`). Then regenerate `src/integrations/supabase/types.ts`
(`npx supabase gen types typescript --project-id yjkniwjneqmtatwozcpv`).
