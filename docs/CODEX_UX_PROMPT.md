# Codex prompt — make Lezgo easy to use (UX pass after the live walkthrough)

Paste everything below the line into Codex, running locally in this repo on branch `lezgo-v2`.

---

You are working on **Lezgo**, a habit-challenge web app (TanStack Start + React, Supabase, i18n en/fr/ar/aeb).
Read `AGENTS.md` first and follow every rule in it (scoring only in Postgres, RPC-only writes, i18n for every string,
`{en,fr,ar,aeb}` must match `en`'s shape, RTL-safe, no rewriting pushed git history, new numbered migrations only).

A real walkthrough of the live app (lezgohabit.vercel.app, a new player joining Winter Arc on day 5 of 40, then
crew, feed, board, profile, surrender, rejoin, create) found the problems below. The product rule for this pass:

> **A new player understands what to do in 5 seconds and logs a habit in 1 tap. Everything else waits.**

Work through the findings **in order** (P0 first). One commit per finding, message starting with its ID
(e.g. `UX-01: Train is a one-tap check`). Each finding lists the evidence, the fix, and how to know it's done.
Do not invent new features; simplify and fix what exists.

## P0 — breaks the first minutes

### UX-01 · "Train — Any workout counts" opens a weight-lifting log
- Evidence: tapping the Train tile on Today navigates to `/lift` ("LIFT LOG", push-ups/lunges sets, kg/lb).
  The bottom nav then highlights **Me**, and there is no way back except the browser. A runner or footballer can't
  just say "I trained". Code: `tap()` in `src/routes/_authenticated/today.tsx` → `if (h.template?.key === "train") navigate("/lift")`.
- Fix: Train is a normal one-tap done/undone check like any boolean habit. Inside the habit sheet (UX-02) add an
  optional link "Log sets (optional)" that opens Lift. Lift gets a proper back button and the Today tab stays active.
- Done when: one tap on Train marks it done with the usual pop animation and points; a second tap undoes it.

### UX-02 · Count habits need many taps, and the real control is hidden
- Evidence: one tap on **Sleep 7 h** saved `value=1` (1 hour of 7) → tile shows "+4.76"; **Read 10 pages** goes
  1/10 per tap. A player must tap 7 or 10 times. The number stepper exists but only opens on a hidden long-press
  (`habit-tile.tsx` `held` ref → `onStepper`). Points show decimals ("+4.76", "+3.33", "habits 8.1") while the
  header says "8 pts".
- Fix:
  - Tap on a **count** habit opens a small bottom sheet (reuse the existing stepper sheet) with one big primary
    button "Done — {target} {unit}" plus the − / + stepper for partial amounts. Long-press stays as a shortcut.
  - **Sleep** becomes a yes/no "Slept {target}h or more" check that refers to *last night* (copy: "Last night").
    Keep the server rules; if the kind must stay `count`, the sheet's primary button saves the target.
  - Show whole points everywhere in the UI (round for display only; never compute scores in the browser).
- Done when: Read 10 pages and Sleep are each completed with 2 taps max (open sheet → Done); no decimals visible.

### UX-03 · Signed-in players join with no confirmation, under a "sign in" label
- Evidence: on `/start` a signed-in, onboarded player picks a mode, taps **"Continue to sign in"** (hint below:
  "Next: confirm you're 18+ and sign in") and is instantly joined — no summary, no confirm.
- Fix: when a session exists, the button reads **"Join {challenge}"** and opens a confirm sheet: start/end, "You're
  joining on day {n} of {total} — {left} days left", what counts as a good day (60% of habits), the trophy rule
  (`ceil(75%)` of days) and whether it's still reachable, the chosen mode, and "You can only have one active challenge".
  Confirm → join → Today with a welcome card (UX-07). Only signed-out visitors see the sign-in wording.
- Done when: a signed-in player can't join by accident and always sees the summary first.

### UX-04 · A left challenge is still offered, and rejoining dumps you on the Sign-in page
- Evidence: after surrendering Winter Arc, "Pick your next challenge" lists Winter Arc with "Choose how to play".
  Trying it calls `join_season` → `400 challenge_surrendered`, then the app routes a **signed-in** player to `/auth`,
  shows "Something went wrong", the **18+ checkbox** and "Continue with Google" (disabled).
  (The raw `common.retry` label and the generic message are already fixed on this branch; `challenge_surrendered`
  now maps to `events.leftBefore`.)
- Fix:
  - The catalog knows the viewer's status per challenge (active / completed / left / banned). Add it to
    `public_challenge_catalog` for signed-in callers (new migration; keep anon output unchanged) or fetch
    `my_challenge_history` and merge client-side. Left/banned cards show a muted "You left this one" badge and no join button.
  - Join errors for signed-in players stay on `/start` (inline alert with `joinErrorKey`), never `/auth`.
- Done when: no signed-in player ever sees the sign-in screen after choosing a challenge.

### UX-05 · Signed-in players on /start see the public site
- Evidence: `/start` for a signed-in player shows the marketing header with **"Sign in"** and no bottom nav.
- Fix: when signed in, show the avatar/"Back to Today" instead of "Sign in" and keep the app's bottom nav.
- Done when: the header never offers "Sign in" to someone already signed in.

## P1 — first week clarity

### UX-06 · Today shows every feature on day 1
- Evidence: day 1 Today has the score card ("habits 0 · stacks 0 · ×1.00", three unlabeled bars), habits, a Bonus row
  with "Daily chaos / Spin", then four **NEW** cards: "Your streak and multiplier", "BOSS FIGHT — The Hundred · BOSS HP 0/60",
  "A note for your future self — TIME CAPSULE", "CREW SYNC". Words like *stacks*, *×1.00*, *Boss HP* mean nothing yet.
- Fix: progressive disclosure, driven by days played in this challenge:
  - Day 1: welcome card (UX-07) + habits + crew strip only.
  - Day 2: streak. Day 3: bonus/daily dare. Day 5+: boss. Time capsule: after the first perfect day.
  - Rename for humans: "stacks" → "bonus", "×1.00" → "Streak bonus ×1", "BOSS HP" → "Team goal".
  - The score card's three bars get labels, or are replaced by "{done} of {total} habits today".
- Done when: a first-day Today fits on one phone screen without scrolling past the habits.

### UX-07 · No welcome or plan for late joiners
- Evidence: joining Winter Arc on day 5/40, nothing says how many days are left, what a good day is, or whether
  the trophy is still possible; History later shows "0 / 40 days" though only 36 are possible.
- Fix: dismissible welcome card on the first day: "Welcome to {challenge}. {left} days left. A good day = {x} of {y}
  habits. Trophy at {need} good days — you can still make it." History shows "{done} / {possible} days" and the trophy target.

### UX-08 · "Find me a crew" leaves you alone with a broken prompt
- Evidence: matched into "Crew B50 · 1 members"; Crew tab says "0 of 1 done" and "Send this to your people:" followed by
  an empty dashed box; Crew sync card says "0 of 1 checked in".
- Fix:
  - Alone-in-crew state: "You're first in this crew. We add players who join Winter Arc — or invite friends:" +
    the crew code + Share button (Web Share API, copy fallback).
  - Pluralise with i18next `count` ("1 member").
  - Generated names: "{Challenge} Crew {n}" or a friendly word list, not random codes like "B50".
  - Hide Crew sync until the crew has 2+ members.

### UX-09 · Crew activity logs every tap
- Evidence: two "+1" taps produced two activity rows ("Read 10 pages", "Sleep 7 hours") while neither was done.
- Fix: activity rows only for a habit reaching its target, a perfect day, a streak milestone, a joined member.

### UX-10 · The feed is buried and "Crew" appears three times
- Evidence: bottom nav is Today / Board / **Crew** / Me; inside Crew: **Pulse / Crew / Buddies**; inside Pulse:
  **Crew / Challenge**. The Pulse screen also drops the Pulse/Crew/Buddies header.
- Fix: bottom nav **Today / Pulse / Board / Me**. Pulse has one segmented control **Challenge / My crew**; crew details
  and invites live in "My crew". Buddies moves to Me (or is hidden when unused). Keep one header style.

### UX-11 · Board looks broken with one player
- Evidence: crown + "#1" podium for a single player; row shows "0% · 0 / 1 days" next to 8 points; profile says "#1 in Tunisia".
- Fix: under 3 players show "You're early — the board fills up as players join" + invite button instead of a podium;
  hide country rank until 10+ players. Use one progress metric everywhere (good days / days played).

### UX-12 · Profile is a pile of features
- Evidence: Me shows stats, trail, "My challenges", a cryptic **"Lights out."** button, badges including
  **"Sugar-free week"** (not a Winter Arc habit), then Lift, Boss, Create a challenge, Small wins, Lezgo Wrapped, Admin.
  "First check-in" was earned by logging 1 hour of sleep.
- Fix: sections in order — Current challenge (progress + "Close my day", renamed from "Lights out.") · History ·
  Badges (only those achievable in the current challenge + earned ones) · More (Create, Wrapped, Small wins, Admin).
  "First check-in" requires a habit reaching its target (database change via a new migration; badges are awarded by DB logic).

### UX-13 · After surrender: no recap
- Evidence: "Your challenge has ended" + two buttons; nothing about what was achieved.
- Fix: show the frozen result (`surrender_challenge` already returns points, completed/perfect days, consistency) as a
  calm recap card, then "Pick your next challenge".

### UX-14 · Create a challenge dead-ends
- Evidence: admin account opens Create → "1 / 1 · Apply to be a creator". Admins can't create; no explanation of what
  happens after applying; no alternative.
- Fix: admins (server-checked) can create directly. Others see what the review is, how long it takes, and a
  secondary "Start a private challenge for yourself" action. Remove the meaningless "1 / 1" chip.

### UX-15 · Upcoming challenges are dead text
- Evidence: New Year Reset / Summer Body / Comeback rows have no action.
- Fix: tap → detail (habits, dates) with "Remind me" (reuse `set_season_reminder`; sign-in required).

## P2 — landing and polish

- **UX-16 Landing**: "View challenge" lands on the list scrolled to an anchor; make it a real challenge detail page
  (habits, dates, players joined, "Join"). Add a real Today screenshot and a short trust line ("Free · no ads · leave
  anytime"). Move "Admin sign-in" out of the public footer (keep `/auth` reachable).
- **UX-17 Visual consistency**: one type scale; stop mixing mono uppercase labels with grotesk headings on the same card;
  habit grid must not leave a lone tile (full-width last tile when the count is odd).
- **UX-18 Copy**: every number formatted with `Intl` per locale; every new string in en/fr/ar/aeb; check RTL on each changed screen.

## Release note for the owner (not code)
Vercel production builds **`main`**, but this work lives on **`lezgo-v2`**. After this pass, open a PR `lezgo-v2 → main`
(no force-push, no rebase of pushed commits) so the live site gets it.

## Definition of done
- `bunx tsc --noEmit` and `bunx vitest run --exclude "**/*database*"` pass. The repo already has many Prettier
  errors; don't reformat untouched files, but files you change must not gain new lint errors (`bunx eslint <files>`).
- New migrations are numbered after the latest file in `drizzle/migrations/`, and `scripts/verify_v2.sql` plus
  `scripts/verify_event_controls.sql` still pass when run against a test database.
- Walk these journeys on a 390×844 viewport in en and ar, and describe each in the final report:
  1. Signed-out visitor → challenge detail → sign in → confirm → Today → complete all habits in ≤ 6 taps.
  2. Day-2 return → streak shows → Pulse → My crew.
  3. "Find me a crew" alone → invite share works.
  4. Surrender → recap → picker shows "You left this one" → join a different challenge.
