# Feature flags

Flags live in `public.admin_feature_flags` (key, enabled). Admins toggle them in **Admin → Flags**
(`admin_action('flag', …)`, allowlisted keys only). A key missing from the table counts as **on**.

- **Server:** `public._require_feature(key)` raises `feature_disabled` at the top of each gated RPC.
- **Client:** `src/lib/features.ts` — `useFeature(key)` hides entry points; `FeatureGate` redirects a
  feature's route to `/today`; `hiddenUrl()` drops inbox items that link into a hidden route.

Inventory as of migration `0082_launch_feature_flags.sql` (P0.2 / P2.1).

| Flag | Controls | Launch value | Enforced on server | Client entry points (all gated) | Known gaps |
|---|---|---|---|---|---|
| `bosses` | Boss Fight: weekly Boss, rewards, lessons | **off** | yes — `boss_action` (0054), `create_boss_lesson` (0082); `hit_boss`/`reset_boss` call `boss_action` | `/boss` route, Today Boss card + query, Me tools grid, Me "Autres outils", inbox links | `boss_overview` (read-only) still answers |
| `duels` | Detox duels | **off** | yes — `detox_duel_action` (0027) | Duel section on `/detox` | — |
| `buddies` | Adult buddy discovery and matching | **off** | yes — `buddy_action` (0027), `buddy_matches`, `report_buddy` (0082) | `/buddies` route, Me buddy row (+ its query), inbox links | `buddy_directory` is a read-only SQL function and is not gated |
| `lift` | Lift log and its PR points | **off** (new) | yes — `log_lift`, `log_lift_session` (0082) | `/lift` route, Train sheet "Log sets", Me tools grid, Me "Autres outils", inbox links | Saved sets and points already earned are kept |
| `capsule_audio` | Voice recording in the time capsule | **off** (new) | yes — `capsule_audio_access` (0082) | Record button and audio preview on `/capsule` | Audio already sealed still plays |
| `daily_dare` | Daily Dare (+10 "Chaos") and its spin wheel | **off** (new) | yes — `spin_daily_chaos`, `set_chaos_done` (0082) | Daily Dare card in Today's bonus area | Plan item "quick challenge" mapped here: no separate feature exists |
| `creator_challenges` | Creator challenge creation | on | yes — `create_challenge`, `create_creator_challenge` (0082) | not hidden for launch | Client does not read this flag |
| `push` | Browser push notifications | off (unchanged) | **no** | — | Not checked anywhere; gating `register_push` would break current sign-ups, left for a separate task |
| `apple_signin` | Apple sign-in | off (unchanged) | n/a (auth provider) | — | Not read by code |
| `auto_flag_links` | Auto-flag posts containing links | on | yes — moderation trigger | Admin moderation toggle | — |

Turning a flag back on restores the feature with no other change; nothing was deleted.
