<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules (Lezgo)
- Scoring lives only in Postgres SECURITY DEFINER functions (`recompute_day` recomputes the whole season for a user so streaks, shields and comeback stay consistent); the client only mirrors completion for optimistic UI (`src/lib/habits.ts`).
- Clients write check-ins, crews, nudges and chaos via RPCs (`checkin_upsert`, `create_crew`, `join_crew`, `send_nudge`, `set_chaos_done`); only `profiles` (whitelisted columns) and `user_habits` are written directly under RLS.
- Admin access is decided server-side by RPCs that check `profiles.is_admin`; the UI never trusts its own flag.
- Signed-in screens live under `src/routes/_authenticated/` (client-only, redirects to /auth and to /onboarding until `profiles.onboarded`).
- All UI strings go through react-i18next dictionaries in `src/lib/i18n/` (en is the typed source; fr/ar/aeb must match its shape). DB-localized fields are `{en,fr,ar,aeb}` jsonb read via `loc()`.
- Sticker design tokens and utilities (`sticker`, `shadow-hard`, `press`, `num`) live in `src/styles.css`; shadows use `--sx` so they mirror in RTL.

- Supplied habit artwork is represented by shared SVG components in `src/components/icons`; map template icons through HabitIcon so all screens reuse the same geometry.
- The onboarding design uses ordered template-key groups and a shared 1–3 selection guard; crew/solo selection stays in a sheet before the existing finish RPC flow.
- Locale-sensitive public Join content is gated by ClientOnly to prevent saved language changes racing lazy-route hydration; route metadata remains server-rendered.
- Public social proof uses a narrowly granted aggregate RPC over opted-in season participants, never broad profile reads.
- Designed headings preserve explicit line breaks and shrink only when measured text overflows, rather than scaling with viewport width.

- Today owns its designed header inside AppShell's todayLayout; shared navigation uses supplied monochrome tab SVGs and fixed safe-area geometry.
- Today mutations serialize check-in writes, mirror completion optimistically, and read point shares/earned values through today_habit_points; never compute scores in the browser.
- Daily spins and proof bonus writes use authenticated SECURITY DEFINER RPCs over day_extras; proof photos stay in an owner-only private bucket with validated uploaded paths.
- Prayer times use an authenticated server function that reads the caller's saved city and lets Aladhan derive its timezone; missing cities prompt setup, never fabricated timings.
- Protected server functions attach the bearer via attachAppBearer in start.ts; it complements existing request and CSRF middleware.
- Scoreboard movement and ghost windows are computed by authenticated database RPCs; private faith stats are filtered there, not by presentation code.
- Badges are persistent earned achievements awarded from saved check-ins and scores by database logic; the Boss badge remains locked until verified Boss results exist.
- Crew details and buddy actions use membership/participant-checked RPCs; buddy acceptance is mutual with serialized one-buddy enforcement.
- Shared community-data queries/types serve Scoreboard, Profile and Crew details so privacy-aware summaries have one client contract.
- Fixed-width stat labels keep their designed size unless measured words overflow, then shrink to the accessible minimum rather than splitting words.
- Community posts use audience-checked RPCs, private proof storage, one reaction per user/post and serialized distinct-report moderation; faith keys/stats are projected only for the owner or explicit public consent.
- Proof uploads re-encode browser pixels as JPEG at a maximum 1280px edge, stripping metadata before upload; Today and feed Compose share this path and the existing server proof bonus.
- Personal equipment, distance, prayer-method and reminder preferences live in owner-scoped user_preferences; reminder delivery is separate from saving preferences.
- Kit preferences mirror into owner-readable profile equipment fields through a database trigger so Settings and Lift cannot diverge.
- Lift sets use one editable exercise/day result against the previous saved day; recomputed distinct beats prevent repeated-save reward farming.
- Detox rewards require elapsed server time and fresh visible-page heartbeats; screen-time proof remains private and weekly savings use logged days only.
- Adult buddy discovery uses privacy-aware RPC matching and buddy_requests for consent, blocks, reports and duo membership; duo and crew sync share one bonus.
- Season reminders and earned trophies are owner-readable records; trophies are awarded only by saved-score triggers, never browser claims.
- Scoring playground results and average/day ranks are computed in Postgres; average divides by elapsed local participation days, including missed days, to avoid rewarding skipped check-ins.
- Boss progress and one-time level rewards are maintained by authenticated Postgres RPCs and saved-data triggers; season bonus rows remain separate from the daily cap and are included in season ranks.
- Challenges have isolated seasons and participant-validated active selection; creator access lives in protected user_roles, and shared habits are guarded on every write path.
- Small Wins and Wrapped use shared browser-only image exports with fixed 1080px output; private faith wins and summaries are removed before export or posting.
- Invite metadata uses a narrow unauthenticated server function, while joining and active-season writes require signed-in membership checks.
