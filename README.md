# Lezgohabit

Build "Lezgo", a mobile-first community habit challenge web app (PWA-ready). Use Lovable Cloud for the database and auth. Follow the PROJECT RULES at the end of this message for brand, design, languages, RTL and scoring — they are strict.

# PHASE 1 — Foundation + the daily loop

Build in this order. Make each step work end-to-end before moving on.

## 1. Design system + app shell
- Tailwind theme tokens for the Sticker system (colors, 2.5px ink borders, hard shadows, radii, fonts) and reusable components: StickerCard, StickerButton (primary = ink bg + lime text + orange hard shadow; secondary = white), Chip, Tile, BottomSheet, Toast, LezgoMark (SVG logo), Wordmark ("lez" ink + "go" orange).
- Mobile layout max-width 440px centered on desktop, cream background.
- Bottom tab bar with 3 tabs: Today · Ranks · Crew (custom SVG icons, active tab = lime pill). Avatar button top-end opens Profile.
- i18n setup with react-i18next: en, fr, ar, aeb (Darja). Language switcher. dir/lang on <html>. Load Alexandria for ar/aeb, Bricolage Grotesque for en/fr, Space Mono for numbers.

## 2. Database (Lovable Cloud / Supabase) with RLS on every table
Tables:
- profiles (id = auth user id, handle unique, display_name, avatar_url, country_code default 'TN', city, timezone default 'Africa/Tunis', language default 'en', units 'kg'|'lb', show_on_public_board bool default true, faith_public bool default false, is_admin bool default false, created_at)
- seasons (id, slug, name jsonb {en,fr,ar,aeb}, starts_on date, ends_on date, status 'upcoming'|'live'|'ended', theme_color)
- habit_templates (id, key, category, name jsonb, description jsonb, icon, kind 'check'|'count'|'salat'|'lift'|'detox', default_target numeric, unit, is_faith bool, sort)
- user_habits (id, user_id, season_id, template_id null, custom_name, kind, target, unit, position, active)
- checkins (id, user_id, user_habit_id, day date, value numeric, detail jsonb, created_at; unique(user_habit_id, day))
- daily_scores (user_id, season_id, day, habit_points, stack_points, multiplier, total, completion, perfect bool, streak int, shield_used bool, comeback bool; unique(user_id, season_id, day))
- season_entries (user_id, season_id, mode 'solo'|'crew'|'creator', joined_at, comeback_used bool)
- crews (id, season_id, name, code unique 6 chars, owner_id, kind 'duo'|'squad'|'club'|'company'|'creator', max_members, is_public, created_at)
- crew_members (crew_id, user_id, role 'owner'|'member', joined_at; primary key both)
- nudges (from_user, to_user, crew_id, day; unique per pair per day)
Seed: Season 1 "Winter Arc" (2026-11-22 → 2026-12-31, live) with names in 4 languages, and habit templates: Train (any workout), Steps 8k, Read 10 pages, Sleep before midnight, Water 2L, No-sugar coffee, Scroll detox (under 1h social media), Salat on time (kind salat, is_faith), Quran 1 page (is_faith), Morning/evening dhikr (is_faith), Learn something 20 min, Custom. All names/descriptions in en, fr, ar, aeb.
Server functions (SECURITY DEFINER, check auth.uid()):
- checkin_upsert(user_habit_id, value, detail) → validates day window (today in user tz, or yesterday until 03:00), saves, then calls recompute_day.
- recompute_day(user_id, season_id, day) → implements the scoring rules exactly and writes daily_scores, then updates the streak for following days if needed.
- join_season(season_id, mode), create_crew(name, kind, max_members) → returns code, join_crew(code), send_nudge(to_user) (once per day per pair).
- leaderboard(season_id, scope 'country'|'world'|'crews', period 'today'|'week'|'season', country_code) → top 100 + my rank.

## 3. Join screen (public landing, route "/")
- LezgoMark + wordmark, language button.
- Hero: "Show up.\nLezgo." (AR: "كل يوم،\nيلّا." Darja: "كل نهار،\nيلّا نبداو.")
- Subtitle: "A 40-day season with friends or solo. Small habits, checked in under a minute a day."
- Dark season card: "Winter Arc · Season 1", LIVE pill, live countdown to Dec 31 23:59 (days/hrs/min/sec in Space Mono).
- 3 numbered rows: Pick 1 to 3 habits · Check in under a minute · Play solo, with friends, or all of Tunisia.
- Primary button "Lezgo" → sign in. Secondary "I have a crew code".
- Footer: "Free · any equipment · EN · FR · عربي · تونسي".

## 4. Sign in
- Continue with Google (primary), email magic link (secondary). Language switcher on top. Short privacy line.
- After first sign-in create the profile automatically (trigger).

## 5. Onboarding — 2 steps only, skippable details
- Step 1 "You": display name, handle (live availability check, LTR), country (prefilled TN), language.
- Step 2 "Your habits": grid of habit template tiles; pick 1–3 (counter "2 of 3"); faith habits shown in their own section with a note "private by default"; "Custom" opens a sheet for name + target. Then choose mode: Solo (race your ghost) or Crew (create one or enter a code). Button "Lezgo" → Today.

## 6. Today (main screen)
- Header: "Day 9 / 40" + season name, today's score (count-up animation), go streak flame with number, multiplier chip "×1.35".
- Habit tiles (2-column grid, 92px tall, no text overflow — ellipsis): tap = complete/undo with a pop animation; count habits show value/target and +/− steppers; Salat tile opens a bottom sheet with the 5 prayers (Fajr, Dhuhr, Asr, Maghrib, Isha) each with On time / Late / Missed.
- "Bonus stacks" row showing Perfect +20, Proof +10, Chaos +10, Crew sync +10, Lift PR +5 with done/not-done state.
- Daily chaos card: one random fun micro-task per day (e.g. "20 push-ups before breakfast", "call your mom", "no phone for the first hour") with a Done button.
- Streak-at-risk banner after 20:00 if completion < 60%, with the missing habits listed and tappable.
- Perfect day → confetti + share prompt.
- All points come from the server (daily_scores) — optimistic UI then reconcile.

## 7. Ranks
- Segmented tabs: Tunisia · World · Crews. Period chips: Today · Week · Season.
- Rows 64px: rank, avatar, name, flag, streak, points (Space Mono). Top 3 styled as stickers (gold/silver/bronze tilt). My row pinned at the bottom when I'm outside the visible list.
- Tap a row → mini profile sheet.

## 8. Crew
- If no crew: two big cards "Create a crew" (name, type duo/squad/club/company, size) and "Join with code" (6-char code input, LTR). After creating: share sheet with code + link https://joinlezgo.com/c/CODE.
- Crew today screen: title "Crew today", crew name + member count, rank chip. Big card "3 of 4 done" with flame, line "1 more and everyone gets +10" (or "+10 crew bonus for everyone" when all done), a segmented bar with one segment per member in their color (dashed if not done), this week's all-in days as 7 squares, and a live countdown to midnight "Day closes in 02:14:30".
- "Who's done" list: 64px rows, avatar, name, "Done · 5 of 5" in green + today's points, or for members not done an orange dashed row "2 left · Isha, lift" with a yellow "Nudge" button (once per day → "Nudged", toast "Lina got a push: 'Your crew is waiting.'").
- "Crew activity": latest check-in events with a "Respect" toggle.

## 9. Profile + Settings
- Profile: avatar, name, @handle, flag, season score, rank, best streak, a 40-square season trail (done = lime, missed = dashed, today = outlined), badges placeholder.
- Settings: language (en/fr/ar/aeb with live preview), units kg/lb, show me on public boards, show faith habits publicly (off by default), notifications toggles, edit habits, sign out, delete account.

## 10. Admin bootstrap
- /admin route visible only when profiles.is_admin = true (checked server-side). For now: simple overview cards (users, active today, check-ins today, crews) and a seasons table. Full admin comes in Phase 3.

When done, give me a short summary of what works, what is placeholder, and the SQL to make my account admin (email: med.adem.1999@gmail.com).

---
PROJECT RULES (strict):

# LEZGO — project rules (always follow)

## Product
Lezgo is a mobile-first community habit challenge app. People join 40-day SEASONS (Season 1 "Winter Arc": Nov 22 – Dec 31, 2026; later: New Year Reset, Ramadan, Summer Body, Comeback). They pick 1–3 daily habits (max 8 later), check in every day, earn points, and compete on public leaderboards (Tunisia, World, Crews). They can play SOLO (racing a "ghost" of their own best), with a CREW (2–50 people, joined by a 6-character code), or in a CREATOR challenge (an influencer hosts a challenge for fans). Tagline: "Show up. Lezgo."

## Brand
- Name is always written "lezgo" in Latin letters, lowercase in the logo, with "go" in orange #FF7A2F. Keep Latin letters even inside Arabic screens.
- Logo icon: rounded square (radius 24%) lime #C8F560 with 2.5px ink border and two ink chevrons ">>". Build it as an inline SVG component <LezgoMark/>.
- The main call-to-action button says "Lezgo" (EN/FR), "يلّا نبدأ" (AR), "يلّا نبداو" (Darja).
- Vocabulary: a check-in = "a go"; streak = "go streak"; group = "crew".

## Design system — "Sticker" neo-brutalist, LIGHT ONLY (no dark mode)
- Colors: cream bg #FFF6E5, ink #111111, white cards #FFFFFF, lime #C8F560, orange #FF7A2F, yellow #FFD43B, pink #FF8FC7, blue #7FB2FF, purple #C3A6FF, teal #5EE6C8, success text #2E7D32, warning text #C2410C, muted text #5B5566.
- Cards: white, 2.5px solid ink border, radius 16–22px, hard shadow 4px 4px 0 #111 (no blur). Pressed state: translate 2px 2px and shadow 2px 2px.
- Fonts (Google Fonts): "Bricolage Grotesque" 500–800 for Latin UI, "Alexandria" 500–800 for Arabic/Darja, "Space Mono" 400/700 for numbers, codes, timers.
- Type: body 14–18px, titles 24–32px, hero up to 56px. Never smaller than 12px.
- Touch: every tap target ≥ 44px; list rows 62–72px; one primary action per screen.
- Motion: small and fun (tile pop on check, score count-up, confetti on perfect day). Respect prefers-reduced-motion.
- Use shadcn/ui primitives restyled to this system. No gradients except the flame icon. No emoji as icons — use our SVG icons (lucide is OK as fallback, stroke 2.5).

## Languages and RTL
- 4 languages: English (en), French (fr), Arabic (ar), Tunisian Darja (aeb). Use react-i18next. Fallback chain: aeb → ar → en; fr → en.
- ar and aeb are right-to-left: set <html dir="rtl" lang="ar|aeb">. Use Tailwind logical utilities (ms-, me-, ps-, pe-, start-, end-, text-start). Never hard-code left/right.
- In RTL: flip directional arrows/chevrons (rtl:-scale-x-100); do NOT flip check marks, play, clock, logo. Mirror hard shadows (-4px 4px 0).
- Arabic font Alexandria, letter-spacing 0, line-height ≥ 1.25.
- Numbers, @handles, crew codes, times stay LTR (wrap in <bdi dir="ltr">). Use Western digits 0-9.
- Dates via Intl.DateTimeFormat with the user's locale; for ar-TN/aeb use Maghreb month names (جانفي، فيفري، مارس، أفريل، ماي، جوان، جويلية، أوت، سبتمبر، أكتوبر، نوفمبر، ديسمبر).
- Darja tone: friendly, short, a bit funny, never mocking faith. Use words Tunisians use: برك، بلاش، يلّا، الجمعة (week)، صحاب، جماعة.
- Every user-facing string goes through i18n keys. Add all 4 languages for every new key.

## Scoring (computed ONLY on the server, in Postgres functions — never trust the client)
- Day boundary: user's timezone (profiles.timezone, default "Africa/Tunis"). Check-ins allowed for today only, plus a grace period until 03:00 for yesterday.
- habit_points (max 100): each active habit is worth 100 / number_of_habits. A habit gives its share × completion (0–1). Count habits: value/target capped at 1. Salat habit: 5 prayers, on time = 1, late = 0.5, missed = 0 → completion = sum/5.
- stack_points: Perfect day (all habits 100%) +20; Proof photo posted today +10; Daily chaos task done +10; Crew sync (every member of your crew had a perfect day) +10; Lift PR (beat previous best weight×reps on an exercise) +5 each, max +15. Max stacks = 65.
- streak: consecutive days with habit completion ≥ 60%. multiplier = min(1 + 0.05 × streak, 1.5).
- daily_total = floor((habit_points + stack_points) × multiplier). Max 247.
- Shield: 1 per calendar week, auto-used on a missed day so the streak does not reset.
- Comeback Day: once per season, the day after a miss, habit_points count ×2 (cap 200).
- Season score = sum of daily_total. Leaderboards rank by season score; tie-break by longer streak, then earlier join.

## Product rules
- 3 bottom tabs only: Today · Ranks · Crew. Profile opens from the avatar (top end). Admin is a separate /admin area.
- Faith habits (Salat on time, Quran, Dhikr, Dua) are optional, private by default, and never shown on public posts unless the user chooses.
- Every screen ends with ONE clear next step.
- Supabase Row Level Security on every table. Users can only write their own rows. Scores are written only by SECURITY DEFINER functions.
- Super admin = profiles.is_admin = true. Admin routes and admin RPCs must check it on the server.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://lezgohabit.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/0dad2404-9c86-4c0a-a8d3-28d08fd1c00c).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
