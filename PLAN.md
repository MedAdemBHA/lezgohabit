# Lezgo v2 implementation plan

## Phase 0 findings

- The checkout started clean on `own-hosting`; this work is on the new local branch `lezgo-v2`.
- `DEPLOY.md` describes the self-hosted Supabase/Cloudflare setup. The owner confirmed `0062_own_hosting_cron.sql` was applied and is now recorded; new local schema work starts at `0063`.
- The current database already has `seasons`, `season_entries`, `user_habits`, `habit_templates`, `challenges`, `crews`, `crew_members`, `challenge_squads`, frozen `season_results`/`crew_results`, and audited admin RPCs. Creator roles, creator challenge approval/featuring, invite codes, and `/create-challenge` and `/c/$code` already exist.
- The model is still season-centric. `season_entries` has one row per user/season but no status or kind; `user_preferences.active_challenge_id` can be switched, so one-active-challenge is not enforced. `create_challenge` accepts 1–3 template keys, copies default targets, and creates a season and (for non-solo audiences) one crew.
- Habit allocation and scoring are server-owned: `today_habit_points` allocates 100 points across active habits, `recompute_day` computes scores, and `mark_prayer` validates salat. The current habit kinds are `check`, `count`, `salat`, `lift`, and `detox`; the client mirror is in `src/lib/habits.ts`. Habit selection and its trigger limit are 1–3 (demo trigger limit 8).
- Frozen season results are currently inserted at whole-season freeze and protected from later edits. `integrity_tick` finalizes days and freezes seasons. Surrender therefore needs a deliberate per-participant snapshot path, and the season-wide ranking/freeze must exclude surrendered and personal entries.
- Duration-specific code includes the 30-of-40 trophy threshold (`_freeze_season`), 40-day copy and defaults, trail milestones at days 20/40, `snakeDays`, wrapped/capsule copy, and the boss/week generation and totals. Today and Seasons already derive the day count from dates in most places.
- Onboarding currently takes profile details, then 1–3 habits, then a solo/crew sheet and ends at the capsule. Auth has an 18+ self-attestation checkbox (`batch9.adult`); `/c/$code` stores an invite through sign-in. The app shell has five tabs. The current feed scopes are everyone/crew/country and Compose requires a thought or proof.
- Today is partly componentized already (`habit-tile`, `count-card`, `salat-card`, `proof-compose`); keep its serialized check-in queue, offline queue, optimistic mirror, locks, and `mark_prayer` flow intact.

## Proposed data and scoring model

1. **Canonical challenge habits:** add `challenge_habits` keyed by season, with ordered template reference, target, kind/unit snapshot, and localized one-line rule. Do not use `seasons.featured_habits` as the specification: it is a `text[]` for featured keys and cannot represent targets or ordering. Keep `challenges.habit_keys` as a compatibility mirror only during rollout, then make the new table authoritative. Extend the snapshot for custom/rule settings as the new habit kinds are added.
2. **Participation lifecycle:** extend `season_entries` with `kind` (`official`/`creator`/`personal`), `status` (`active`/`completed`/`surrendered`), `ended_at`, and `end_reason`; add a partial unique index for one `active` row per user. `season_entries` is the right anchor because every existing check-in, score, crew, badge, and result already keys through `season_id`.
3. **History and surrender:** keep the existing immutable `season_results` snapshot and extend it with participation status, consistency, and challenge rank; allow ranks to be null for personal/surrendered rows. `surrender_challenge(_season_id uuid) returns jsonb` inserts the surrendered snapshot, sets the participation end fields, removes live crew membership, and records one calm event. A centralized SQL eligibility check must gate every season-scoped write RPC after surrender, including `checkin_upsert`, `mark_prayer`, bonuses, proof posts, and habit swaps. Preserve `_guest_guard()` in every new or redefined write RPC and add new RPC names to `src/lib/guest.ts`.
4. **History read:** `my_challenge_history() returns jsonb` returns active first and then all historical entries, with challenge/creator, habits, dates/length, completed days, SQL-computed consistency, points, optional rank, crew, status, and trail data. Add a season search parameter to `/trail` so history can reuse the existing day grid.
5. **Join/create:** retain `join_challenge(_code text) returns uuid` but validate one active participation, copy the locked challenge list and targets into `user_habits`, and reject rejoin after surrender. Add `create_personal_challenge(_name text, _days integer, _habits jsonb) returns uuid`; personal entries are private and never enter public rankings. Rework `create_challenge` to accept 1–6 habit specs/targets, enforce creator role and start-date locks, and avoid treating the old one-crew-per-challenge field as the crew model.
6. **Crews and boards:** reuse `crews`/`crew_members` scoped by `season_id`; allow several 4–8-person crews per challenge. Add `find_challenge_crew() returns jsonb`, using row locks so concurrent requests group a user once and enforcing the requested max of six for auto-created crews. Extend `scoreboard_v4` (or add an equivalent typed RPC) to return SQL-computed challenge rank and consistency. Country/world scopes return official participants only; personal entries are always excluded. Use challenge points as the rank metric and keep faith data filtered in SQL.
7. **Official list and migration:** add an audited admin action/RPC to edit official `challenge_habits`; seed the live Winter Arc from existing keys (proposed: `train`, `read`, `sleep7`). Backfill existing season entries without deleting or rewriting their check-ins. Existing official-season entries whose habits do not match its new list become private `personal` legacy entries so their chosen habits and points remain intact.

## Phases and files

### Phase 1 — age gate and roadmap

- Change `batch9.adult` in `src/lib/i18n/batch9.ts` to “I'm 18 or older” for EN/FR/AR/AEB; keep the existing legal copy unchanged.
- Check the repository for any other 16+ copy. Add the teen-mode note to `roadmap.md`.
- Files: `src/lib/i18n/batch9.ts`, `roadmap.md`.

### Phase 2 — challenge database model

- Add `drizzle/migrations/0063_challenge_model.sql`. Extend participation, challenge-habit, result, and crew-ranking data; update `active_season`, `activate_challenge`, `join_season`, `join_challenge`, `challenge_preview`, `validate_user_habit`, `_rank_rows`, and `_freeze_season`.
- Add `surrender_challenge`, `my_challenge_history`, and the personal-challenge creation RPC. Keep SQL SECURITY DEFINER access checks, fixed `search_path`, explicit grants, RLS, demo isolation, point review handling, frozen-result guards, and 03:00/15-minute finalization behavior.
- Update `src/integrations/supabase/types.ts` by hand after the migration is authored; do not apply the migration. Migrate habit mismatches into private legacy personal entries. Preserve check-in rows and scores.
- Files: migration `0063`, `src/integrations/supabase/types.ts`, `src/lib/guest.ts`, and later the related query contracts in `src/lib/data.ts` / `src/lib/batch6-data.ts`.

### Phase 3 — creator challenges and crews

- Turn `/create-challenge` into the creator-only 3-step flow (name/start/length, 1–6 library habits and targets, cover color); for others show an application action. Add a private creator request table/RPC and admin review using existing `user_roles` and audited `admin_action` patterns.
- Enrich the public `/c/$code` preview with creator, habit rules, dates, and participant count. Keep the existing signed-out invite handoff through auth; after onboarding, complete the join and go to Today.
- Reuse season-scoped `crews` for code-based groups. Add `find_challenge_crew` with max-six grouping and preserve crew membership checks in buddy/nudge/details RPCs. Add a creator dashboard to Profile with participant totals, today's check-in rate, surrenders, and invite link from an aggregate RPC, never broad profile reads.
- Files: `src/routes/_authenticated/create-challenge.tsx`, `src/routes/c.$code.tsx`, `src/routes/_authenticated/profile.tsx`, `src/routes/_authenticated/admin.tsx`, relevant `src/lib/*data.ts`/server functions, and matching i18n dictionaries.

### Phase 3a — habit library and validation

- Expand `habit_templates` and its kind constraint for `time_window`, `quit`, and optional `timer`; add localized “what counts” copy and validated rule settings. Seed the requested library with sensible caps. Keep self-reported health/screen values clearly labeled and add the integration note to `roadmap.md`.
- Enforce time windows, quit slips, timer heartbeats, count caps, challenge targets, the 1–6 list limit, and the same undo/final-day/review rules in Postgres. Update `_habit_completion`, check-in RPCs, `recompute_day`, trigger guards, `src/lib/habits.ts`, habit cards, `HabitIcon` mappings, challenge preview, and all four locale dictionaries.
- Keep proof optional unless a future challenge-level proof rule is explicitly chosen. Faith remains opt-in/private.

### Phase 3b — history and surrender UI

- Add “My challenges” to Profile with active-first history cards and a detail view. Reuse `/trail` with a selected season. Add surrender only to challenge detail and the Today challenge menu, with a calm `BottomSheet` describing frozen history/points/badges and ended check-ins/board/crew.
- After completion or surrender, Today offers the next challenge.
- Files: `src/routes/_authenticated/profile.tsx`, `src/routes/_authenticated/today.tsx`, `/trail`, a new challenge-history/detail component or route, and translations.

### Phase 3c — challenge pulse feed

- Scope feed to the active challenge with Crew/Challenge tabs, a daily check-in pulse and crew avatars, and one-tap nudges. Add deduplicated server-created moments for perfect days, streak milestones, boss wins, all-crew check-ins, and challenge completion; enforce challenge membership, guest isolation, demo isolation, and faith privacy in SQL. Use the existing post reaction/report/hide and JPEG proof-upload path, with Respect as the one-tap reaction. Add one authorized pinned creator/official post.
- Remove the global scopes and habit chips from the primary feed view; keep moderation and compose. Empty challenges still show the pulse and generated moments.
- Files: `src/routes/_authenticated/community.tsx`, `src/components/lezgo/community/*`, feed RPCs/types, and translations.

### Phase 4 — no-typing start flow

- Add public `/start` with official, short, creator, and private-personal choices, plus crew setup. Extend personal selection to 1–6. Carry `/c/CODE` through sign-in and finish from `sessionStorage`; route returning users through existing onboarding as needed. Land new users at `/today`, not `/capsule`.
- Files: `src/routes/index.tsx`, new `src/routes/start.tsx`, `src/routes/auth.tsx`, `src/routes/_authenticated/onboarding.tsx`, `src/lib/habit-selection.ts`, habit picker components, and translations.

### Phase 5 — Today

- Add challenge name, day X/N, score breakdown, habits, salat, collapsed Bonus, progressive-reveal cards, compact boss, and crew strip in the requested order. Extract remaining page regions into `src/components/lezgo/today/` without changing the write queue, offline queue, locks, or prayer flow.
- Remove remaining 40-day assumptions in Today/trail/wrapped/boss/capsule consumers and keep every score value sourced from RPCs.

### Phase 6 — navigation

- Change `AppShell` to Today/Board/Crew/Me. Board uses the active challenge scoreboard and Tunisia only for official challenges. Crew hosts member actions and pulse. Me links to settings, lift, seasons/challenges, trail, wrapped, and creator dashboard. Update all old links and route metadata.
- Files: `src/components/lezgo/app-shell.tsx`, tab icons, `ranks.tsx`, `crew.tsx`, `profile.tsx`, and route links.

### Phase 7 — visual calm

- Apply the existing sticker tokens, 8/12/16/24 spacing, 44px minimum targets, measured heading behavior, and RTL shadow rules. Keep cards to two text sizes and remove repeated helper copy.
- Files: touched route/component styles in `src/styles.css`; no new UI library.

### Phase 8 — verification and handoff

- Add the requested tests for windows/time zones, quit slips, timer minimum, deduplicated/privacy-safe moments, challenge habit copying, the one-active rule, surrender/history, 7-day completion, personal-board exclusion, crew grouping, and onboarding auto-finish.
- Run `bun run build`, `npx tsc --noEmit -p .`, and `bunx vitest run`; note the existing `virtual:pwa-register` routing failure separately. Finish `CHANGES.md` with migration order and manual steps. Do not apply or push migrations.

## Decisions confirmed

- `0062_own_hosting_cron` is now recorded in Supabase; the next migration is `0063`. Migrations remain unapplied by Codex for the user to apply.
- The current project has no user accounts or `season_entries`. Keep the proposed legacy-overlap fallback in the migration (selected `active_challenge_id`, else the official season selected by `active_season()`, else the most recently joined eligible season); no preflight pause is needed.
- A completed consistency day is `daily_scores.completion >= 0.6`. The denominator is local elapsed participation days from `max(challenge start, joined date)` through today or the challenge end. Return `completion = 1` perfect days separately.
- Award trophies at `ceil(75% of challenge length)` days with completion >= 0.6 for every challenge kind. Personal-challenge trophies remain private.
- Proof remains optional for every habit. Seed Winter Arc with `train`, `read`, and `sleep7`.
