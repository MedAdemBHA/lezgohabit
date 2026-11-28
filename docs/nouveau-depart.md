# "Nouveau départ" — 1 January 2027 (P4.3)

Owner decision (2026-11-28): **30 days, 3 habits**. The event already exists as
`new-year-reset-2027` ("New Year Reset" / "Nouveau départ"), published, 1 Jan → 7 Feb.
Migration `0086_better_official_challenges.sql` updates it (only while nobody has joined):

| Field | Value |
|---|---|
| Dates | 2027-01-01 → 2027-01-30 (30 days) |
| Scoring | v2 (0083 moves seasons that haven't started to v2) |
| Habits | `train` (any workout) · `read` (10 pages) · `no_phone_first_hour` (no phone 09:00–10:00) |

| Language | Goal |
|---|---|
| en | 30 days, 3 habits, one clean start: move, read, and keep your phone away for the first hour. |
| fr | 30 jours, 3 habitudes, un vrai nouveau départ : bouge, lis, et pas de téléphone la première heure. |
| ar | 30 يومًا، 3 عادات، وبداية نظيفة: تحرّك، اقرأ، وابتعد عن الهاتف في الساعة الأولى. |
| aeb | 30 نهار، 3 عادات، بداية نظيفة: تحرّك، اقرا، وبلاش تليفون في أول ساعة. |

Official events give every player the same habits; players can't pick their own 3 in an
official event.

## Before publishing

- [ ] Migrations 0081–0085 applied (flags, scoring v2, Small Wins, analytics).
- [ ] Draft card on `/start` checked in en, fr, ar, aeb (RTL layout, dates).
- [ ] Reminder: players who tap "Remind me" on `/start` get the season reminder.
- [ ] Admin → Overview funnel picks the new challenge (0 events before 1 January is expected).

## Legal (P4.4)

The privacy policy should mention first-party usage events (visits, joins, first log, day-7
log, crew size changes), stored in our own database for product decisions and never shared.
Proposed sentence for the reviewer:

> We record a few product events (when you open the app, join a challenge, log your first
> habit, log on day 7, or your crew changes size) in our own database to improve Lezgo. We
> don't share them or use third-party analytics.

Have a qualified person review the privacy policy and terms before public launch, then update
`src/routes/legal.$document.tsx`.
