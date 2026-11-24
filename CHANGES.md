# Lezgo v2 changes

## What changed

- Added challenge participation kinds and statuses, locked per-challenge habit snapshots, one-active-challenge enforcement, surrender snapshots, private personal challenges, local consistency, perfect-day counts, and 75% trophy eligibility.
- Added creator requests and creator challenges, six-person automatic crews, public challenge catalog, challenge pulse events and privacy filtering, and deduplicated moments.
- Added the `/start` no-typing challenge flow with automatic auth completion, 1–6 personal habit selection, challenge history and surrender UI, and the revised Today layout.
- Reworked the app shell to Today · Board · Crew · Me. The board scopes to the active challenge, the viewer's crew, and Tunisia for official challenges. Personal boards remain private.
- Calmed the new challenge surfaces, normalized the high-traffic card typography, removed decorative tilt from progress labels, and raised the touched controls to 44px targets.
- Added unit coverage for six-habit selection and post-auth auto-join, plus the transaction-only database verifier at `scripts/verify_v2.sql`.

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

Codex did not apply these migrations or push the branch. The legacy overlap fallback remains in `0063`; it preserves existing check-ins and classifies mismatched official entries as private personal history.

## Manual steps

1. Apply migrations `0063` through `0070` sequentially to the own-hosting Supabase project.
2. After they are applied, run `scripts/verify_v2.sql` in a PostgreSQL session with permission to create throwaway `auth.users` rows. It sets `request.jwt.claims` for fixtures, prints PASS/FAIL rows, and ends with `ROLLBACK`.
3. Smoke-test Google sign-in and a signed-out `/c/CODE` invite through auth to Today; test a personal challenge, find-me-a-crew, a creator invite, surrender/history, and the official Tunisia board on a staging session.
4. Deploy the frontend through the existing Cloudflare Workers flow after the database migration is complete.

## Verification

- `bun run build`: passed. Existing warnings remain for deprecated `inputValidator`, chunk size, and the PWA glob that finds no files in `dist`.
- `npx tsc --noEmit -p .`: passed.
- `bunx vitest run`: 52 passed, 109 skipped, with one known failing suite: `src/test/app-routing.test.tsx` cannot resolve `virtual:pwa-register` in Vitest. The remaining tests pass.
- The SQL verifier was authored but not run because its target schema migrations are intentionally unapplied.

## Open items

- Personal challenges remain solo-only and use existing library templates. Custom-named personal habits and personal crews need a separate snapshot contract and game-rule decision.
- The existing `virtual:pwa-register` resolution issue remains in the Vitest routing suite.

## Applied to Supabase (2026-11-24, by Claude)

All migrations 0062–0071 are applied to project `yjkniwjneqmtatwozcpv` and recorded in its migration history.
`scripts/verify_v2.sql`: **21/21 checks PASS** (run inside a rolled-back transaction).

Fixes made while applying (already in the files above):
- **0063**: the legacy `UPDATE public.user_habits … FROM … JOIN … ON … uh.user_id` referenced the update target inside a JOIN (Postgres error); moved that condition to `WHERE`.
- **0064**: `find_challenge_crew` used a variable named `code` that clashed with the `code` column (ambiguous-reference error at runtime); renamed to `v_code`.
- **0065**: `guard_habit_rule` read `NEW.rule`/`NEW.target`, which `habit_templates` doesn't have (it has `default_rule`/`default_target`), so every template edit would fail; now reads either. Added `fill_habit_rule_default` triggers so challenge and user habits inherit the template's time window (otherwise wake-up, make-bed and quit habits were rejected as `invalid_time_window` when creating challenges).
- **0071 (new)**: `_freeze_season` used `r` both as a record variable and as a CTE alias, so no challenge could ever be frozen/completed (and `integrity_tick` would fail at the end of every challenge).
- `src/integrations/supabase/types.ts` regenerated from the live database (hand-written version was missing two internal functions); type check and build pass.
