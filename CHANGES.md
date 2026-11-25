# Lezgo v2 changes

## What changed

- Added challenge participation kinds and statuses, locked per-challenge habit snapshots, one-active-challenge enforcement, surrender snapshots, private personal challenges, local consistency, perfect-day counts, and 75% trophy eligibility.
- Added creator requests and creator challenges, six-person automatic crews, public challenge catalog, challenge pulse events and privacy filtering, and deduplicated moments.
- Added the `/start` no-typing challenge flow with automatic auth completion, 1–6 personal habit selection, challenge history and surrender UI, and the revised Today layout.
- Reworked the app shell to Today · Board · Crew · Me. The board scopes to the active challenge, the viewer's crew, and Tunisia for official challenges. Personal boards remain private.
- Calmed the new challenge surfaces, normalized the high-traffic card typography, removed decorative tilt from progress labels, and raised the touched controls to 44px targets.
- Added unit coverage for six-habit selection and post-auth auto-join, plus the transaction-only database verifier at `scripts/verify_v2.sql`.
- Refreshed the homepage and Start on mobile and desktop. The homepage features a challenge from the live catalog. Start renders open and upcoming dates on the server, explains the crew choices, and takes personal challenges straight from habit selection to sign-in.
- Reworked the public design around a photo-led homepage and detailed challenge cards. The cards show each habit and what counts before players choose a mode. Upcoming challenges show their opening date and duration as information.
- Kept the homepage and Start in one phone-width column at every screen size. Both show the How it works link on mobile, and the homepage preserves that section when the language changes.
- Added an admin sign-in path from the homepage and `/admin`. The dashboard uses its existing server authorization and can open before an admin completes a player profile. Player profile setup is a single form.
- Matched Today’s workout rule to the saved challenge habit and kept the creator dashboard available before and between challenges.
- Added public Terms and Privacy pages, kept email sign-in available for team testing, and made the guest button depend on the deployed demo configuration and seeded account.

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

1. The Vercel production deployment uses `APP_URL=https://lezgohabit.vercel.app` for share links and public metadata. Update it when the custom domain goes live.
2. Complete a fresh Google sign-in on production to check the callback and onboarding with a real account.
3. Set `SUPABASE_SERVICE_ROLE_KEY`, `DEMO_PASSWORD`, and `DEVICE_HASH_SECRET` in the Vercel production environment, redeploy, then run **Admin → Demo data → Seed demo** to enable the guest walkthrough.
4. Add the operator name and privacy contact to the published Terms and Privacy pages. Configure and test custom SMTP before enabling public email sign-in.

## Verification

- `bun run build`: passed. Existing warnings remain for deprecated `inputValidator`, chunk size, and the PWA glob that finds no files in `dist`.
- `npx tsc --noEmit -p .`: passed.
- Vitest passed 56 tests and skipped 109 database-dependent tests. Routing coverage isolates the service worker and checks the admin sign-in destination and challenge date boundaries.
- Browser checks covered the desktop and mobile public screens, Arabic right-to-left layout, 7-day personal and official crew sign-in handoffs, and admin versus player routing with mocked Supabase sessions.
- `scripts/verify_v2.sql` ran against the migrated Supabase project. It reported `ALL V2 CHECKS PASS`; all fixture users and rows were rolled back. A local alias typo in the personal-checkin fixture was corrected before the successful run.
- The deployed build reached Google OAuth and the admin sign-in form. A browser run with mocked Supabase responses covered profile setup, starting a 7-day personal challenge, checking in, surrendering, and seeing the result in history. The creator dashboard opened with and without an active event.

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

## Free event dashboard and community moderation

- Admin → Seasons now includes an event editor with drafts, publish scheduling, translated names and goals, canonical habit targets, a player preview, and participation counts. Public cards and the homepage use the schedule. Official joins enforce the start date on the server, and the integrity job activates scheduled events.
- The player flow explains active-event conflicts and gives routes back to Today and event history. The picker keeps future official events in the calendar, shows date and free entry on live cards, and keeps Continue within reach. Invite previews distinguish missing, upcoming, ended, and full invites. An email callback can resume the selected event from another tab in the same browser.
- Creator dashboards and Crew Details now expose scoped moderation. Event creators and crew owners can review posts and member reports, hide and restore content, mute posting, and ban within their scope. Crews support ownership transfer and invite rotation. Creators can pin an announcement from their dashboard.
- Crew removal preserves event progress. Event removal closes that participation and preserves its history. Lifting an event ban clears the restriction while leaving the ended entry intact. Players receive private notices and can appeal to Lezgo admins. Platform account suspension remains in the admin dashboard.
- Migration order: `0072_official_event_dashboard.sql`, `0073_scoped_moderation.sql`, `0074_moderation_reports_and_appeals.sql`. Apply in order to a test Supabase project, then run `scripts/verify_v2.sql` and `scripts/verify_event_controls.sql`. Both scripts roll back their fixtures. Apply the schema before releasing the frontend.
- For hosted acceptance, sign in with a real admin, creator, crew owner, and member. Check that an invite opens in the intended browser, complete a check-in, exercise both moderation scopes, then reply to a player appeal. Production sign-in and guest seeding remain separate setup tasks.
- Local verification passed both production builds, TypeScript, 54 Vitest tests, and 53 SQL checks in a temporary PGlite database. The local SQL run omits the hosted Vault/cron setup, and seven hosted test suites remained skipped. The public browser smoke check covered the event picker at 390 px and the crew sign-in handoff.

The event release keeps the production phone-width pages and protected admin sign-in. The public catalog includes scheduled event goals, invite checks distinguish missing, early, full and closed events, and a signed-in player can return to their active challenge. Verify the email redirect allowlist in the hosted project before enabling email.
