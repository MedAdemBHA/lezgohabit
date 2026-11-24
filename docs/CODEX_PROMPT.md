# Lezgo — global enhancement (prompt for Codex)

You are working on **Lezgo**, a mobile-first habit-challenge web app: TanStack Start + React + Tailwind,
Supabase (Postgres + Auth + Storage), i18n in en / fr / ar / aeb (aeb = Tunisian Darja, Arabic script, RTL).
Read `AGENTS.md` and `DEPLOY.md` first and follow every rule in them.

Start from branch `own-hosting`, create branch `lezgo-v2`. Commit after each phase. Do not push.
Work phase by phase. **Stop after each phase** and show me a short summary + what to test before continuing.

**This is a direction, not a fixed spec.** The goals and the rules of the game below matter; the exact tables,
names, screens and numbers are suggestions. If you see a simpler or better way, propose it in `PLAN.md`
with the trade-off, and ask me when a choice changes how the game feels. Reuse what already exists before
adding anything new.

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

1. **Challenge = what you do, for how long.** Every activity is a challenge with a **habit list** (1–6 habits,
   chosen by whoever creates it) and a **length** (from 7 days up to 90 — e.g. 7, 14, 21, 30, 40, 66, 90).
   Everyone in a challenge does the same habits, so its scoreboard is fair.
   - **Official challenges** by Lezgo (the existing seasons: Winter Arc, New Year Reset, …) and short ones
     (e.g. "7-day sugar reset", "14-day steps").
   - **Creator challenges** by approved creators (influencers, coaches, clubs). Shared by link/code.
   - **Personal challenge**: the user picks their own habits (1–6) and length; private, **no public ranking**.
2. **Crew = who you do it with.** Small groups (4–8) **inside a challenge**. Friends create one with a code;
   solo players can tap "Find me a crew" and get auto-grouped with other solo players of the same challenge.
3. **Habit = check in.** Unchanged: locks after 10 min, day final at 03:00, `mark_prayer` for salat, proof photos.

### Rules of the game (keep these)

- **One active challenge at a time.** A user is in exactly one challenge (official, creator or personal) at once.
  To start another, they finish or surrender the current one. Keeps focus and keeps boards honest.
- **Surrender.** A user can quit their active challenge at any time: a clear "Surrender" action with a calm
  confirmation sheet (shows what they keep and what ends). After surrender: no more check-ins in it, they leave
  its scoreboard and crew, their points so far stay frozen in their history, and they cannot rejoin that same
  challenge. Their crew sees "X surrendered" once (no shaming copy).
- **Every challenge ends with a status:** `completed` (reached the last day), `surrendered`, or `active`.
  Optionally `missed` if you find a fair rule (propose it, don't invent one silently).
- **History is forever.** Every challenge a user ever joined is logged: name, creator, habits, start/end dates,
  length, days completed, consistency %, final points, final rank (if ranked), crew, status, and the day-by-day
  trail. Nothing is deleted when a challenge ends or is surrendered (account deletion still deletes everything).
  Reuse frozen `season_results` / `crew_results` and the trail where possible.

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
- Challenge length: start/end dates with 7–90 days. Short challenges must work with everything that assumes
  40 days today (trophies "≥30 active days", bosses, wrapped, day counters "X/40" → "X/N"). List each place
  in PLAN.md and adapt it.
- Joining a challenge creates the user's `user_habits` from that list (no free pick). Habit limit becomes
  "the challenge's list size" (1–6); a personal challenge allows 1–6 free picks.
- Participation record per user per challenge (extend `season_entries` or add a table): `kind`
  (official / creator / personal), `status` (active / completed / surrendered), `joined_at`, `ended_at`,
  `end_reason`. Enforce **one active participation per user** in the database (unique partial index +
  checks in the join RPCs), not only in the UI.
- `surrender_challenge(_season_id)` RPC: guest-guarded, sets status, freezes this user's result row, removes
  them from boards and crew counts, logs an activity/audit event. Completion is set automatically by the
  existing integrity tick when the last day is final.
- `my_challenge_history()` RPC: all past and current participations with the summary fields above.
- Personal challenges never appear on public boards.
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
- Creator dashboard on `/profile` for creators: participants, today's check-in %, surrenders, invite link.
- Creators choose the length (7–90 days) and start date; a challenge can't change habits or length after it starts.

## Phase 3a — Habit library (more habits, each with a clear rule)

Today there are 21 templates (`habit_templates`) with kinds `check`, `count`, `detox`, `salat`. Challenges need a
richer, well-defined library so creators can build any challenge. Every habit must answer 4 questions:
**what counts as done, how it is measured, when it can be checked in, and how we keep it honest.**

**New habit kinds** (add to `_habit_completion`, `src/lib/habits.ts` mirror, and the Today cards):
- `check` — done / not done (exists).
- `count` — reach a number (exists): steps, pages, litres, minutes, reps, km.
- `time_window` — **NEW.** Valid only if checked in inside a time window in the user's local time, decided by
  the **server** (like `mark_prayer` does): e.g. "Wake up before 07:00" = check-in allowed 04:00–07:00 only;
  "Sleep before midnight" = check-in 21:00–00:00. Outside the window the button explains why.
- `quit` — **NEW.** A "clean day" habit (no smoking, no vape, no energy drinks, no fast food…): the user
  confirms the clean day in the evening window; a slip can be logged honestly and just makes that day 0
  (no shame copy, streak resets kindly).
- `timer` — **NEW (optional, propose design).** An in-app timer that must run for N minutes with the page
  visible (reuse the detox heartbeat approach): meditation, plank, deep work.
- `detox`, `salat` — keep as they are. Faith habits stay optional and private by default.

**Library to seed** (EN/FR/AR/Darja names + description; icon in the same style as `src/components/icons`;
category; kind; default target/unit; window if any). Starting list — refine it in PLAN.md:

| Category | Habit | Kind | Default |
|---|---|---|---|
| Body | Cold shower | check (+ optional proof) | 1 |
| Body | Wake up early | time_window | before 07:00 (creator can change) |
| Body | Sleep before midnight | time_window | 21:00–00:00 |
| Body | Sleep 7 h | count | 7 h (exists) |
| Body | Train / workout | check | 1 (exists) |
| Body | Steps | count | 8,000 (exists) — 10,000 variant |
| Body | Run or walk | count | 3 km (exists) |
| Body | Push-ups | count | 50 reps |
| Body | Plank | timer or count | 3 min |
| Body | Stretch / mobility | timer or check | 10 min |
| Body | Sunlight outside | check | 10 min in the morning |
| Fuel | Water | count | 2 L (exists) |
| Fuel | No sugar / no-sugar coffee | check / quit | (exist) |
| Fuel | No fast food | quit | (exists) |
| Fuel | Fruits & veggies | count | 5 portions |
| Fuel | Protein each meal | check | 1 |
| Fuel | No energy drinks | quit | — |
| Mind | Read | count | 10 pages (exists) |
| Mind | Learn / study | count | 15–20 min (exist) |
| Mind | Study focus blocks | count | 2 × 25 min |
| Mind | Language practice | count | 15 min |
| Mind | Journal | check | 1 (exists) |
| Mind | Meditation / breathing | timer | 10 min |
| Mind | Gratitude (3 things) | check | 1 |
| Digital | Scroll detox | detox | under 1 h social (exists) |
| Digital | No phone first hour | time_window | check-in after the first hour, before 10:00 |
| Digital | No social media till noon | detox | (exists) |
| Digital | Screen time limit | count (logged) | under 2 h |
| Life | Make your bed | time_window | before 10:00 |
| Life | Tidy 10 min | check | 1 |
| Life | No spending day / budget | check | 1 |
| Life | Call family or a friend | check | 1 |
| Quit | No smoking / no vape | quit | — |
| Faith (optional, private) | Salat on time, Quran page, dhikr, dua, tasbih | (exist) | — |
| Custom | Creator-defined habit | any kind above | creator sets name, kind, target, unit, window |

**Rules for every habit:**
- Server decides validity (windows, timers, limits); the browser only shows it.
- Same 10-minute undo lock and day-final rules as today; suspicious values go to `point_reviews` like now
  (add sensible caps for new count habits, e.g. push-ups > 1,000/day).
- Proof photo stays optional on every habit (bonus as today), never required — except when a creator marks a
  challenge "proof required" (propose how).
- Habits that need data we don't have (real step counts, screen time) stay honest self-report for now; note
  in `roadmap.md`: Health Connect / Apple Health / Screen Time integration later.
- Creators pick habits from the library or make a custom one; a challenge's habit list is locked once it starts.
- Each habit has a one-line "what counts" text shown on its card and in the challenge preview
  (e.g. "Cold shower: at least 30 seconds of cold water at the end").

## Phase 3b — History and surrender (UI)

- **Me → "My challenges"**: a timeline of every challenge (active on top), each as a card with status badge
  (Active / Completed / Surrendered), dates, length, days completed, consistency %, points, rank, crew.
  Tap → detail with the habit list and the day-by-day trail (reuse `/trail`).
- **Surrender** lives in the challenge detail and in Today's challenge header menu, never as a big button.
  Confirmation sheet: what you keep (history, points so far, badges) and what ends (check-ins, board, crew).
- When a challenge ends or is surrendered, Today shows one calm "Pick your next challenge" card.

## Phase 3c — Feed → "Challenge pulse"

Today's feed (`src/routes/_authenticated/community.tsx`, `src/components/lezgo/community/*`) feels like a
generic social network: 4 rows of buttons/filters before any content (switch, create challenge, detox, title,
habit chips, everyone/crew/Tunisia), text-heavy posts that need typing, and it is empty for new challenges.
Goal: a feed that is **alive without anyone typing**, about **your challenge**, and calm.

- **Scope = your active challenge.** Two tabs only: **Crew** and **Challenge**. Drop the global
  "everyone / Tunisia" scopes and the habit filter chips (a filter can live in a small menu if really needed).
- **Top: the pulse strip.** One compact card: "Today · 18 of 42 checked in" with a progress bar and the
  avatars of your crew (checked in / not yet). Tap a not-yet crew member → nudge (existing `send_nudge`).
- **Auto moments (no typing).** The database creates feed items from real events: perfect day, streak
  milestones (7, 14, 21, 30…), boss level beaten, crew all checked in, challenge completed. One line each,
  with one-tap **Respect**. Generated server-side from saved data (triggers or the integrity tick), never
  from the browser, deduplicated, demo-isolated, and they respect privacy (no faith data unless the user
  opted in with `faith_public`).
- **Proof posts in one tap.** After a check-in on Today, a small "Add proof" action opens the existing proof
  upload with the habit pre-tagged. Text is optional (1 line). Reuse `create_post`, the private proof bucket and
  JPEG re-encode path.
- **Creator / Lezgo pinned post.** In creator and official challenges, the creator (or admin) can pin one post
  at the top: today's tip or a daily question ("What made today hard?") with short replies.
- **Reactions:** one main reaction (Respect) on tap; long-press keeps the others. Show "Respect from 3 in your
  crew" instead of a bare number.
- **Clean header:** just the challenge name + Crew/Challenge tabs. Compose = one floating button. Move
  "Create challenge" to Me/creator and "Detox" to its habit card.
- **Posts look calmer:** avatar, name, habit tag, time, content, one reaction row. No coloured box per post;
  colour only on the habit tag. Faith-related posts only show for users who opted in.
- Keep everything that works: audience-checked RPCs, reports/hides/moderation, rate limits, guest read-only.
- Empty state for a new challenge shows the pulse + auto moments, so it never looks dead.

## Phase 4 — Onboarding (≤ 4 screens, no typing)

1. **Pick a challenge** (public route `/start`): featured official challenge first, then short ones (7–14 days),
   then featured creator challenges, then "Make my own (private)". Each card shows length and habits. If they came from `/c/CODE`, that challenge is preselected.
2. Personal challenge only: pick 1–6 habits and a length.
3. **How to play**: "With my crew (code)", "Create a crew", "Find me a crew", "Solo".
4. **Sign in**: one primary button "I'm 18+ · Continue with Google"; email link + "Explore as guest" secondary.
After auth, finish automatically from sessionStorage: display name from Google metadata (else email prefix),
handle auto-generated and checked with `handle_available` (add digits until free), country `TN`, language =
current. Then join + crew action, then **straight to /today** (no /capsule on first run).
Returning users / empty sessionStorage → existing onboarding as fallback. City is asked only on the Salat card.

## Phase 5 — Today (split `today.tsx` into components under `src/components/lezgo/today/`)

Top to bottom: challenge name + day X/N (N = its length) + score (tap for breakdown) → habit cards (main content, one colour
per habit) → salat card → one collapsed **Bonus** section (daily dare, proof photo, moments, small wins;
open state in localStorage) → compact weekly boss card → crew strip (members' check-ins, nudge).
Progressive reveal: day 1 = habits + salat only; ghost, streak info, boss, capsule appear from day 2–3 as
dismissible "New" cards. Don't change the write queue, offline queue, locks or `mark_prayer` flow.

## Phase 6 — Navigation

Tabs 5 → 4: **Today · Board · Crew · Me**.
- Board = the user's challenge board (tabs: my crew / challenge / Tunisia for official).
- Crew = crew members + the Challenge pulse feed (Phase 3c). `/community` stays as a route.
- Me = `/profile` with links to settings, lift, seasons/challenges, trail, wrapped, creator dashboard.
- Lift opens from the Train habit and from Me; Boss from the Today card. Update every old link.

## Phase 7 — Visual calm

Max 2 text sizes per card; rotated stickers only for celebrations; spacing scale 8/12/16/24;
remove helper text that repeats a title; one obvious primary action per screen.

## Phase 8 — Done means

- `bun run build` and `npx tsc --noEmit -p .` pass; `bunx vitest run` has no new failures
  (`src/test/app-routing.test.tsx` already fails on main: `virtual:pwa-register`).
- Add tests for: time_window validity (inside/outside, time zones), quit-day slips, timer minimum, auto feed moments (created once, privacy respected), challenge habit list → user habits, one-active-challenge rule, surrender, history, 7-day completion, personal challenges not on boards, find-me-a-crew grouping,
  onboarding auto-finish (unit level where possible).
- New user: landing → challenge → how to play → Google → Today in ≤ 4 screens, no typing.
- Invite link `/c/CODE` works signed-out → sign-in → joined.
- A user can't be in two active challenges (DB-enforced); surrender works and shows up in history;
  a 7-day challenge completes on day 7 and appears as Completed.
- All 4 languages complete, ar/aeb mirrored.
- `CHANGES.md`: what moved where, list of migrations to apply in order, and anything I must do by hand.
