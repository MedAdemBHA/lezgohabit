# "Nouveau départ" — 1 January 2027 (P4.3)

Owner decision (2026-11-28): **30 days, 3 habits**. Enter this in **Admin → Seasons → New event**,
save as a draft, check the `/start` card in all four languages, then publish.

Official events give every player the **same prescribed habits** (the editor takes 1–6). Players
can't pick their own 3 from the library in an official event. To let players choose, run it as a
personal-challenge template instead. The habits below are a proposal; change them before
publishing.

| Field | Value |
|---|---|
| Dates | 2027-01-01 → 2027-01-30 (30 days) |
| Scoring | v2 (automatic for seasons created after migration 0083) |
| Colour | lime |
| Habits (proposal) | `train` (any workout, target 1) · `read` (10 pages) · `sleep7` (7 h) |

| Language | Name | Goal |
|---|---|---|
| en | New Start | 30 days, 3 habits, one fresh start. Bring your crew. |
| fr | Nouveau départ | 30 jours, 3 habitudes, un vrai nouveau départ. Ramène ton équipe. |
| ar | بداية جديدة | 30 يومًا، 3 عادات، وبداية جديدة حقًا. أحضِر فريقك. |
| aeb | بداية جديدة | 30 نهار، 3 عادات، وبداية جديدة بالحق. جيب فرقتك. |

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
