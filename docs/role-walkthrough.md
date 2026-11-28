# Role walkthrough (P4.1 / P4.2)

Run on the **deployed** app with one test account per role, on a phone at 375 px. Record
**Pass** or **Fail** in the Result column, and file every Fail as a new task (don't fix it in
this one). Rows come from the roles table in `docs/LEZGO_PRODUCT_MAP.md`.

Status: **not run yet**. These checks need real sign-ins on the production deployment.

## Before you start

- Apply migrations 0081–0085 (see the PR list in the plan report).
- Create test accounts named `test+<role>@…`. Never reuse a real player's account.
- Admin: Admin → Flags matches `docs/feature-flags.md` (Boss, duels, buddies, Lift, capsule
  audio and Daily Dare are **off**).

## P4.1 Creator path (target: invite link → first log in under 2 minutes on a phone)

| # | Step | Expected | Result | Time |
|---|---|---|---|---|
| 1 | New account: Me → Create challenge → Request access | "Request sent" state; no builder yet | | |
| 2 | Admin → Creators → approve the request | Request disappears; audit row written | | |
| 3 | Creator reloads Create challenge | Builder opens (name, dates, habits, cover) | | |
| 4 | Build a 7-day challenge with 3 habits; create | Confirmation with a 6-character code and invite link | | |
| 5 | Open `/c/<code>` signed out on a second phone | Preview shows name, dates and habits; link preview image renders when shared | | |
| 6 | Join from the preview → sign in with Google → finish profile | Lands on Today for that challenge (no extra screens) | | |
| 7 | Log one habit | Tile completes; "Bring two friends" invite sheet appears once | | start → here |
| 8 | Creator dashboard | Participant count and check-ins include the new player | | |

## P4.2 Permissions by role

| Role | Check | Expected | Enforced by | Result |
|---|---|---|---|---|
| Signed-out visitor | Open `/today` | Redirects to `/auth` | route guard (`_authenticated/route.tsx`) | |
| Signed-out visitor | Open `/c/<valid code>` | Public preview only (name, dates, habits) | `crew_invite_preview` / challenge preview server fn | |
| Guest (sample) | Tap a habit, post, react, join | Blocked with sign-up prompt; nothing saved | `_guest_guard()` + table triggers (0058/0059) | |
| Profile incomplete | Open any app route | Sent to `/onboarding`; 18+ confirmation required | route guard + profile RPC | |
| No active challenge | Today / Board / Feed | "Pick next" states; no scoring | `active_season` | |
| Private personal player | Today, Feed, Small Wins | No crew strip, no feed/compose, no "post" | P2.5 client gates + audience-checked post RPCs | |
| Shared challenge, solo | Feed, Board, Crew | Feed allowed; Crew shows create/join; country board only with ≥ 10 players | `challenge_scoreboard`, P2.4 thresholds | |
| Crew member | Today crew status, nudge | Sees member states; nudge once per member per day | `crew_today`, `send_nudge` | |
| Crew member | Read another crew's details | Refused | `crew_details` membership check | |
| Crew owner | Crew details → Manage community | Hide post, mute, remove member, rotate code; each logged | scoped moderation (0073/0075) | |
| Crew owner | Moderate a different crew | Refused | scoped moderation | |
| Buddy candidate | Open `/buddies` with buddies flag off | Redirects to Today | `FeatureGate` + `_require_feature('buddies')` | |
| Creator applicant | Open builder before approval | Request/pending screen only | `create_challenge` creator check | |
| Approved creator | Create challenge, view stats | Works for own challenges only | `create_challenge`, creator dashboard RPC | |
| Muted player | Post in muted scope | Refused; notice in Settings | moderation RPCs | |
| Platform admin | Admin dashboard sections | All 12 load; sensitive writes ask for a reason and are audited | `_require_admin()`, `admin_action` | |
| Non-admin | Open `/admin` | "No access"; RPCs return `forbidden` | `_require_admin()` | |
| Any player | Call a hidden feature RPC (e.g. `log_lift`) | `feature_disabled` | `_require_feature` (0082) | |

## Results summary

| Date | Who ran it | Device | Passed | Failed | Tasks filed |
|---|---|---|---|---|---|
| | | | | | |
