# Lezgo v2 changes

## What changed

- Added challenge participation kinds and statuses, locked per-challenge habit snapshots, one-active-challenge enforcement, surrender snapshots, private personal challenges, local consistency, perfect-day counts, and 75% trophy eligibility.
- Added creator requests and creator challenges, six-person automatic crews, public challenge catalog, challenge pulse events and privacy filtering, and deduplicated moments.
- Added the `/start` no-typing challenge flow with automatic auth completion, 1–6 personal habit selection, challenge history and surrender UI, and the revised Today layout.
- Reworked the app shell to Today · Board · Crew · Me. The board scopes to the active challenge, the viewer's crew, and Tunisia for official challenges. Personal boards remain private.
- Calmed the new challenge surfaces, normalized the high-traffic card typography, removed decorative tilt from progress labels, and raised the touched controls to 44px targets.
- Added unit coverage for six-habit selection and post-auth auto-join, plus the transaction-only database verifier at `scripts/verify_v2.sql`.
- Refreshed the homepage and Start on mobile and desktop. The homepage features a challenge from the live catalog. Start renders open and upcoming dates on the server, explains the crew choices, and takes personal challenges straight from habit selection to sign-in.
- Added an admin sign-in path from the homepage and `/admin`. The dashboard uses its existing server authorization and can open before an admin completes a player profile. Player profile setup is a single form.

## Migration order

Apply these files in order after confirming `0062_own_hosting_cron` is recorded:

1. `drizzle/migrations/0063_challenge_model.sql`
2. `drizzle/migrations/0064_creators_and_crews.sql`
3. `drizzle/migrations/0065_habit_library_and_timers.sql`
4. `drizzle/migrations/0066_challenge_pulse.sql`
5. `drizzle/migrations/0067_public_challenge_catalog.sql`
6. `drizzle/migrations/0068_challenge_board_scopes.sql`
7. `drizzle/migrations/0069_local_participation_consistency.sql`
8. `drizzle/migrations/0070_winter_arc_sleep7_seed.sql`
9. `drizzle/migrations/0071_fix_freeze_season_alias.sql`

The Supabase migration history now confirms `0063`–`0071` are applied to `yjkniwjneqmtatwozcpv`. The legacy overlap fallback remains in `0063`; it preserves existing check-ins and classifies mismatched official entries as private personal history.

## Manual steps

1. Provide the real app base URL if `joinlezgo.com` is not owned/configured, so every invite link can use the deployed address.
2. Complete Google sign-in once with a throwaway/staging account to exercise the post-auth start and surrender screens end to end.
3. Deploy the frontend through the existing Cloudflare Workers flow.

## Verification

- `bun run build`: passed. Existing warnings remain for deprecated `inputValidator`, chunk size, and the PWA glob that finds no files in `dist`.
- `npx tsc --noEmit -p .`: passed.
- Vitest passed 55 tests and skipped 109 database-dependent tests. Routing coverage isolates the service worker and checks the admin sign-in destination and challenge date boundaries.
- Browser checks covered the desktop and mobile public screens, Arabic right-to-left layout, 7-day personal and official crew sign-in handoffs, and admin versus player routing with mocked Supabase sessions.
- `scripts/verify_v2.sql` ran against the migrated Supabase project. It reported `ALL V2 CHECKS PASS`; all fixture users and rows were rolled back. A local alias typo in the personal-checkin fixture was corrected before the successful run.
- Local UI smoke test: the 7-day personal picker and the official “Find me a crew” path both reach the sign-in handoff. Authenticated UI actions were not attempted without a staging account; the SQL verifier covers their database rules.

## Open items

- Personal challenges remain solo-only and use existing library templates. Custom-named personal habits and personal crews need a separate snapshot contract and game-rule decision.
- `roadmap.md` still marks `joinlezgo.com` as a domain-ownership/DNS task, `DEPLOY.md` gives only a Worker URL placeholder, and the domain did not resolve from this environment.

## Applied to Supabase (2026-11-24, by Claude)

All migrations 0062–0071 are applied to project `yjkniwjneqmtatwozcpv` and recorded in its migration history.
`scripts/verify_v2.sql`: **21/21 checks PASS** (run inside a rolled-back transaction).

Fixes made while applying (already in the files above):
- **0063**: the legacy `UPDATE public.user_habits … FROM … JOIN … ON … uh.user_id` referenced the update target inside a JOIN (Postgres error); moved that condition to `WHERE`.
- **0064**: `find_challenge_crew` used a variable named `code` that clashed with the `code` column (ambiguous-reference error at runtime); renamed to `v_code`.
- **0065**: `guard_habit_rule` read `NEW.rule`/`NEW.target`, which `habit_templates` doesn't have (it has `default_rule`/`default_target`), so every template edit would fail; now reads either. Added `fill_habit_rule_default` triggers so challenge and user habits inherit the template's time window (otherwise wake-up, make-bed and quit habits were rejected as `invalid_time_window` when creating challenges).
- **0071 (new)**: `_freeze_season` used `r` both as a record variable and as a CTE alias, so no challenge could ever be frozen/completed (and `integrity_tick` would fail at the end of every challenge).
- `src/integrations/supabase/types.ts` regenerated from the live database (hand-written version was missing two internal functions); type check and build pass.
