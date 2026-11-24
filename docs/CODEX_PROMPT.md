# Lezgo — global enhancement (prompt for Codex)

You are working on **Lezgo**, a mobile-first habit-challenge web app: TanStack Start + React + Tailwind,
Supabase (Postgres + Auth + Storage), i18n in en / fr / ar / aeb (aeb = Tunisian Darja, Arabic script, RTL).
Read `AGENTS.md` and `DEPLOY.md` first and follow every rule in them.

Start from branch `own-hosting`, create branch `lezgo-v2`. Commit after each phase. Do not push.
Work phase by phase. **Stop after each phase** and show me a short summary + what to test before continuing.

---

## North star — read this before every decision

The goal is **not more features**. The goal is an app that is **easier, cleaner and fair for everyone**:
a student, a mom who wants to pray on time, a gym guy, a 55-year-old who just wants to walk 8k steps.

Before you ship any screen, check it against these 6 rules. If it fails one, simplify it:
1. **Understood in 5 seconds.** A new user knows what to do on every screen without reading help text.
2. **One main action per screen.** Everything else is secondary or hidden until needed.
3. **No typing to start.** Taps only from landing to first check-in.
4. **Fair by design.** You are only ranked against people doing the same habits.
5. **Nobody alone.** Solo players are always one tap away from a crew.
6. **Show less, reveal later.** New features appear when they become useful (day 2, 3…), not on day 1.

If something can be explained in one sentence to a non-technical Tunisian user, it is right.
If it needs a paragraph, it is too complicated — cut it or hide it.

---

## Why we are doing this

Lezgo has many good features, but the logic is hard to understand and new users see everything at once.
Facts from the current code (verify them yourself before changing anything):

- Daily habit points are always 100 split equally over the user's active habits
  (`today_habit_points`: share = 100 / count, ×2 on a comeback day). So 1 easy habit earns the same
  max as 3 hard ones, and everyone is ranked together on one country board. **That is unfair.**
- The "max 3 habits" rule is only a trigger (`validate_user_habit`, limit 3, 8 for demo profiles).
- Creator challenges already exist in the database (`create_challenge`, `join_challenge`, `challenge_preview`,
  `featured_creator_challenges`, `challenge_squads`, `assign_sub_squad`, `seasons.challenge_owned`,
  creator role in `user_roles`, route `/create-challenge`, invite route `/c/$code`), but they are hidden.
- Solo players have no group to belong to.
- The app says 16+. Under Tunisian law (organic law 2004-63, art. 28) anyone under 18 is a child and needs
  guardian consent + family judge authorization. **Accounts must be 18+ for now.**

## The new model: 3 simple ideas

1. **Challenge = what you do, for how long.** Every ranked activity is a challenge with a **fixed habit list**
   (1–6 habits, chosen by whoever creates the challenge). Everyone in a challenge does the same habits,
   so its scoreboard is fair.
   - **Official challenges** by Lezgo (the existing seasons: Winter Arc, New Year Reset, Ramadan, …).
   - **Creator challenges** by approved creators (influencers, coaches, clubs). Shared by link/code.
   - **Personal mode**: free habit pick (1–6), streaks, trail, ghost — **no public ranking**.
2. **Crew = who you do it with.** Small groups (4–8) **inside a challenge**. Friends create one with a code;
   solo players can tap "Find me a crew" and get auto-grouped with other solo players of the same challenge.
3. **Habit = check in.** Unchanged: locks after 10 min, day final at 03:00, `mark_prayer` for salat, proof photos.

Defaults I chose (keep them unless the code makes them impossible, then tell me):
- Only users with the creator role can create public challenges. Admins grant the role (already exists).
- A challenge scoreboard ranks by points (fair because habits are identical); also show **consistency %**
  (days completed ÷ days elapsed) on every row.
- Country/world boards only include official challenges.

---

## Hard rules

- Scoring stays in Postgres SECURITY DEFINER functions. Never compute points in the browser
  (only the optimistic mirror in `src/lib/habits.ts`).
- Keep guest mode read-only (`src/lib/guest.ts` + `_guest_guard()` in every write RPC — add it to new RPCs and
  add new write RPCs to `WRITE_RPCS`).
- Keep integrity: 10-minute undo locks, final days, frozen season results, point reviews, demo isolation.
- DB changes: new numbered files in `drizzle/migrations/` starting at `0063_…`, idempotent where possible.
  **Do not apply them** — I apply them to Supabase. After each migration, update
  `src/integrations/supabase/types.ts` by hand to match (it is regenerated later).
- Every new string in `src/lib/i18n/en.ts` + same keys in fr, ar, aeb. Check RTL.
- Reuse the sticker design system (`src/styles.css`, StickerButton, BottomSheet, Field, HabitIcon). No new UI libs.
- Touch targets ≥ 44 px, works at 360 px width.
- Privacy: faith stats stay private unless the user opted in (existing `faith_public`).

---

## Phase 0 — Read and plan (no code)

Read the schema (`drizzle/migrations/`, `types.ts`), `src/routes/**`, `src/lib/**`.
Write `PLAN.md`: tables/functions you will change, new RPCs with signatures, routes/components to touch,
risks. Stop and wait for my OK.

## Phase 1 — 18+ (quick)

- Change the age line on `/auth` (`batch9.adult` key) to "I'm 18 or older" in all 4 languages; legal text same.
- Buddy matching is already adult-only; make sure nothing else says 16.
- Add a short note in `roadmap.md`: "Teen mode (12–17) later: parent-approved accounts, no photos, no public
  feed, invite-only crews — only after legal advice (INPDP / lawyer)."

## Phase 2 — Challenge model (database)

- Each challenge (= season row) gets its **habit list**: reuse `seasons.featured_habits` or add a
  `challenge_habits(season_id, template_id, target, position)` table — choose and justify in PLAN.md.
  Seed the official live season (Winter Arc) with a sensible list (e.g. train, read, sleep) and make
  that list editable by admins.
- Joining a challenge creates the user's `user_habits` from that list (no free pick). Habit limit becomes
  "the challenge's list size" (1–6); personal mode allows 1–6 free picks.
- Add `mode` to the user's entry: `challenge` vs `personal`. Personal entries never appear on public boards.
- Scoreboards: per challenge; country/world boards only from official challenges.
- Consistency %: return it from the scoreboard RPCs (computed in SQL).
- Keep existing data working (current users keep their habits; migrate them into "personal" if their habits
  don't match the challenge list — explain in PLAN.md).

## Phase 3 — Creators and crews

- `/create-challenge`: clean 3-step form for creators — name + dates, pick 1–6 habits with targets,
  cover color → share link `/c/CODE`. Non-creators see "Apply to be a creator" (writes a request admins see).
- `/c/$code` landing: challenge card (creator, habits, dates, people joined) + one "Join" button that works
  for signed-out users (store the code, finish after sign-in).
- Crews inside a challenge: create (name → code), join by code, **"Find me a crew"** (RPC that places solo
  players of the same challenge into open crews of max 6, or creates one). Reuse `challenge_squads` /
  `assign_sub_squad` / `crews` where possible.
- Creator dashboard on `/profile` for creators: participants, today's check-in %, invite link.

## Phase 4 — Onboarding (≤ 4 screens, no typing)

1. **Pick a challenge** (public route `/start`): featured official challenge first, then featured creator
   challenges, then "Personal mode (no ranking)". If they came from `/c/CODE`, that challenge is preselected.
2. Personal mode only: pick 1–6 habits.
3. **How to play**: "With my crew (code)", "Create a crew", "Find me a crew", "Solo".
4. **Sign in**: one primary button "I'm 18+ · Continue with Google"; email link + "Explore as guest" secondary.
After auth, finish automatically from sessionStorage: display name from Google metadata (else email prefix),
handle auto-generated and checked with `handle_available` (add digits until free), country `TN`, language =
current. Then join + crew action, then **straight to /today** (no /capsule on first run).
Returning users / empty sessionStorage → existing onboarding as fallback. City is asked only on the Salat card.

## Phase 5 — Today (split `today.tsx` into components under `src/components/lezgo/today/`)

Top to bottom: challenge name + day X/N + score (tap for breakdown) → habit cards (main content, one colour
per habit) → salat card → one collapsed **Bonus** section (daily dare, proof photo, moments, small wins;
open state in localStorage) → compact weekly boss card → crew strip (members' check-ins, nudge).
Progressive reveal: day 1 = habits + salat only; ghost, streak info, boss, capsule appear from day 2–3 as
dismissible "New" cards. Don't change the write queue, offline queue, locks or `mark_prayer` flow.

## Phase 6 — Navigation

Tabs 5 → 4: **Today · Board · Crew · Me**.
- Board = the user's challenge board (tabs: my crew / challenge / Tunisia for official).
- Crew = crew members + crew activity + community feed (`/community` stays as a route).
- Me = `/profile` with links to settings, lift, seasons/challenges, trail, wrapped, creator dashboard.
- Lift opens from the Train habit and from Me; Boss from the Today card. Update every old link.

## Phase 7 — Visual calm

Max 2 text sizes per card; rotated stickers only for celebrations; spacing scale 8/12/16/24;
remove helper text that repeats a title; one obvious primary action per screen.

## Phase 8 — Done means

- `bun run build` and `npx tsc --noEmit -p .` pass; `bunx vitest run` has no new failures
  (`src/test/app-routing.test.tsx` already fails on main: `virtual:pwa-register`).
- Add tests for: challenge habit list → user habits, personal mode not on boards, find-me-a-crew grouping,
  onboarding auto-finish (unit level where possible).
- New user: landing → challenge → how to play → Google → Today in ≤ 4 screens, no typing.
- Invite link `/c/CODE` works signed-out → sign-in → joined.
- All 4 languages complete, ar/aeb mirrored.
- `CHANGES.md`: what moved where, list of migrations to apply in order, and anything I must do by hand.
