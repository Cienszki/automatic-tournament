# Lobby Bot — Abuse & Exploit Analysis

**Version:** 1.1  
**Created:** March 7, 2026  
**Updated:** March 8, 2026 — enforcement system implemented  
**Purpose:** Identify 20 ways players or teams can abuse/break the bot system and when admin intervention is required.

---

## Severity Legend

| Level | Meaning |
|-------|---------|
| **CRITICAL** | Breaks the match or gives unfair competitive advantage |
| **HIGH** | Disrupts the lobby flow, may delay the match significantly |
| **MEDIUM** | Annoying or exploitable but has limited match impact |
| **LOW** | Minor nuisance, mostly cosmetic or self-defeating |

---

## 1. Slot Squatting (Wrong Side on Purpose)

**Description:** A player deliberately sits in the enemy team's slot and refuses to move, hoping to delay or cancel the match.

**Severity:** HIGH  
**Current Mitigation:** ✅ **IMPLEMENTED.** `evaluateEnforcement()` in `lobby-lifecycle.ts` detects wrong-slot players on every `lobby_state_update` event. The bot posts a chat warning with the player's name, waits a configurable grace period (`wrongSlotGracePeriodSeconds`, default 30s), then auto-kicks and re-invites the player. Tracked via `wrongSlotWarnings` on the `LobbySession`. Configurable in admin BotTab under "Enforcement & Security".  
**Admin Intervention:** Only if the player continuously re-joins the wrong slot after re-invites.  
**Status:** Resolved.

---

## 2. Captain Refuses to Type !ready

**Description:** A team captain (or designated ready-caller) refuses to type `!ready`, stalling the lobby indefinitely.

**Severity:** HIGH  
**Current Mitigation:** ✅ **IMPLEMENTED.** `enforceSessionTimeouts()` in the orchestrator implements a multi-phase timeout system with four distinct thresholds:
- **Pending stuck** (`pendingSessionTimeoutMinutes`, default 20 min) — cancel if no bot was ever assigned
- **Bot stuck** (`botAssignedTimeoutMinutes`, default 5 min) — cancel if bot was assigned but never opened the lobby
- **Lobby open — warning** (`lobbyOpenWarningMinutes`, default 15 min from `lobbyCreatedAt`) — bot sends a chat warning if not all players have joined, setting `timeoutWarningSentAt` to prevent duplicate warnings
- **Lobby open — close** (`lobbyOpenTimeoutMinutes`, default 30 min from `lobbyCreatedAt`) — bot sends farewell message, leaves lobby, session is cancelled, bot freed
- **Ready check stuck** (`readyCheckTimeoutMinutes`, default 10 min) — cancel if both teams !ready'd but the game never launched

The `lobby_open` clock is measured from `lobbyCreatedAt` (when Dota 2 accepted the lobby), NOT from `createdAt` (when the session was scheduled), so pre-match lead time does not eat into the wait window.  
**Admin Intervention:** YES — admin must enforce the forfeit ruling based on tournament rules.  
**Status:** Multi-phase timeout implemented; forfeit ruling requires admin.

---

## 3. !ready / !unready Spam

**Description:** A player or bot account spams `!ready` and `!unready` rapidly to confuse the state or annoy other players.

**Severity:** MEDIUM  
**Current Mitigation:** ✅ **IMPLEMENTED.** Per-player cooldown (`readyCooldownSeconds`, default 5s) enforced in `handleChatForReadyCheck()`. Rapid !ready/!unready commands are silently ignored. Cooldown timestamps tracked in `LobbySession.readyCooldowns`. Configurable in admin BotTab.  
**Admin Intervention:** NO  
**Status:** Resolved.

---

## 4. Impersonation via Steam Name Change

**Description:** A player changes their Steam display name to match another player's name, trying to confuse the bot or admin about who is in which slot.

**Severity:** LOW  
**Current Mitigation:** The bot tracks players by **Steam32 ID**, not display name. Validation resolves IDs, not names. Impersonation does not affect the system.  
**Admin Intervention:** NO  
**Recommendation:** None needed. The system is already immune to this attack.

---

## 5. Unauthorized Player Joins (Ring-in)

**Description:** A non-rostered, non-standin player joins the lobby and sits in a team slot, pretending to be a legitimate player.

**Severity:** CRITICAL  
**Current Mitigation:** ✅ **IMPLEMENTED.** `handlePlayerJoinedEnforcement()` in `bot-agent.ts` immediately kicks unauthorized players on `player_joined` events. `handleLobbyStateEnforcement()` runs full enforcement on every `lobby_state_update` as a secondary check. Bot posts a chat message identifying the kicked player. Controlled by `autoKickUnauthorized` config toggle.  
**Admin Intervention:** NO — fully automated.  
**Status:** Resolved.

---

## 6. DDoS / Flood the Bot's Command Queue

**Description:** Someone with Firestore write access inserts thousands of garbage commands into `/botCommands/{botId}/queue/`, overwhelming the bot worker.

**Severity:** CRITICAL  
**Current Mitigation:** ✅ **IMPLEMENTED.** Three layers of protection:
1. **Firestore rules:** All bot collections (`/botCommands/**`, `/botEvents/**`, `/botLobbySessions/**`, `/botAccounts/**`, `/botSyncTasks/**`) now deny all client writes (`allow write: if false`). Only Admin SDK (server-side) can write.
2. **Command age check:** `CommandHandler` skips commands older than 5 minutes (`MAX_COMMAND_AGE_MS`), marking them as `expired` with an error message.
3. **Queue size warning:** When the pending queue exceeds 20 commands (`QUEUE_SIZE_WARNING`), the bot worker logs a flood warning. Only 5 commands are processed per poll cycle.

**Admin Intervention:** Only for investigating the attack source.  
**Status:** Resolved.

---

## 7. Stealing the Lobby Password

**Description:** The lobby password is visible in Firestore documents. A player with database access reads it and shares it publicly, letting spectators or griefers join.

**Severity:** MEDIUM  
**Current Mitigation:** ✅ **IMPLEMENTED.** Firestore rules deny all client reads/writes to `/botLobbySessions/**` (admin-only read). Added `passwordVisibleToPlayers` config toggle (default: true) — when enabled, the password is shown on the match page for players; when disabled, players can only join via the Dota 2 invite. Auto-kick of unauthorized players neutralizes password leaks since griefers are kicked immediately.  
**Admin Intervention:** NO — unauthorized players are auto-kicked regardless.  
**Status:** Resolved.

---

## 8. Bot Account Credentials Leaked

**Description:** Someone obtains the Steam username, password, or shared_secret of a bot account and uses it to log in simultaneously or steal the account.

**Severity:** CRITICAL  
**Current Mitigation:** Credentials are stored in Firestore `/botAccounts/` with restricted read access. The bot worker reads them at startup. Steam Guard should be enabled.  
**Admin Intervention:** YES — immediately disable the bot, change credentials, revoke sessions.  
**Recommendation:** Use Steam Guard with `shared_secret` rather than no-guard accounts. Rotate passwords periodically. Limit Firestore admin access. Consider encrypting credentials at rest.

---

## 9. Team Abandons Mid-Lobby (No-Show)

**Description:** A team is scheduled but none of their 5 players join the lobby within the allowed time.

**Severity:** HIGH  
**Current Mitigation:** ✅ **IMPLEMENTED.** The lobby timeout cascade handles this automatically. Once the Dota 2 lobby is open (`lobbyCreatedAt`), the clock starts:
1. At `lobbyOpenWarningMinutes` (default 15) without a full roster, the bot sends a chat warning with the remaining time
2. At `lobbyOpenTimeoutMinutes` (default 30), the bot closes the lobby and frees itself

**Admin Intervention:** YES — admin still decides the forfeit ruling based on tournament rules.  
**Status:** Timeout resolved; forfeit is tournament-rules-dependent.

---

## 10. Player Disconnects During the Game

**Description:** A player disconnects (intentionally or not) during a live game. The bot has no way to pause or manage the in-game state.

**Severity:** HIGH  
**Current Mitigation:** The bot is only an observer once the game starts. It cannot pause, kick, or manage in-game players. Dota 2's built-in pause system handles this.  
**Admin Intervention:** SOMETIMES — if intentional, admin applies rule penalties after the match.  
**Recommendation:** This is inherently a Dota 2 feature limitation. Document clearly that the bot does NOT manage in-game state. Tournament rules should handle disconnects.

---

## 11. Spectator Griefing (Leaking Picks/Bans)

**Description:** A spectator joins the lobby and relays draft information (picks/bans) to one of the teams via Discord or other means.

**Severity:** CRITICAL  
**Current Mitigation:** ✅ **IMPLEMENTED.** `allowSpectators` now defaults to `false` in `DEFAULT_TOURNAMENT_BOT_CONFIG`. Combined with the enforcement system, ALL non-registered players (including spectators) are auto-kicked immediately on join. The enforcement evaluator (`evaluateEnforcement()`) treats every unrecognized Steam ID as unauthorized and kicks them.  
**Admin Intervention:** NO — fully automated.  
**Status:** Resolved.

---

## 12. Exploiting the Ready Check with a Fake Captain

**Description:** Any Radiant player can type `!ready` and mark the entire Radiant team as ready, even if they're not the captain.

**Severity:** MEDIUM  
**Current Mitigation:** Currently, any player on the team can trigger the ready command. The system identifies the player's team by Steam ID and marks that team ready.  
**Admin Intervention:** NO — but could cause confusion.  
**Recommendation:** Add a `captainOnlyReady` config option. When enabled, only the captain's Steam ID can trigger `!ready` for their team.

---

## 13. Lobby Password Brute Force

**Description:** Someone tries to join the lobby by guessing the password.

**Severity:** LOW  
**Current Mitigation:** Passwords are randomly generated strings (typically 6-8 characters). Dota 2 has no lockout mechanism but there's no automated way to attempt many passwords either.  
**Admin Intervention:** NO  
**Recommendation:** Generate sufficiently random passwords (8+ chars, alphanumeric). This attack is impractical.

---

## 14. Match Result Manipulation via Early Leave

**Description:** A team that's losing leaves the game before the ancient falls, hoping the bot fails to detect the result or records it incorrectly.

**Severity:** HIGH  
**Current Mitigation:** The bot detects `game_ended` events from the Dota 2 GC. The match result (including wins by abandonment) is captured regardless of how the game ends. Post-match sync uses OpenDota/Valve API data.  
**Admin Intervention:** SOMETIMES — if the game doesn't register correctly on Valve's servers (rare).  
**Recommendation:** Always cross-reference the bot's `game_ended` event with OpenDota API data. If there's a mismatch, flag for admin review.

---

## 15. Stalling by Swapping Slots Repeatedly

**Description:** Players keep swapping between Radiant and Dire slots, never settling, to prevent the ready check from completing.

**Severity:** MEDIUM  
**Current Mitigation:** ✅ **IMPLEMENTED.** The wrong-slot enforcement system warns and then kicks players who keep swapping slots. The lobby timeout (`lobbyTimeoutMinutes`) auto-cancels sessions if stalling continues. Together, these make slot-swap-stalling impractical.  
**Admin Intervention:** Only for sustained intentional disruption.  
**Status:** Resolved.

---

## 16. Abusing the Standin System

**Description:** A team registers a smurf account as a "standin" to bring in a much better player without proper authorization, hoping the bot won't check MMR.

**Severity:** CRITICAL  
**Current Mitigation:** Standin approval happens at the platform level (opponent captain + admin). The bot checks if the standin's Steam ID is in `expectedPlayers`. It does NOT verify MMR.  
**Admin Intervention:** YES — admin must verify standin eligibility before approving.  

✅ **Live Standin Sync (IMPLEMENTED):** When a standin is approved (by enemy captain via `approveStandinRequest()` or by admin via `approveStandinAppeal()`) AFTER a lobby is already open, `syncLobbySessionStandins()` is called automatically. This re-reads `buildLobbyTeamAssignments()` from the match document and patches `radiantTeam`/`direTeam` on all active (pre-game) lobby sessions for that match. The bot will not kick the newly approved standin, and the standin can sit in the correct slot. This also works mid-series: `scheduleNextGameInSeries()` re-reads standins when creating lobbies for subsequent games.  
**Recommendation:** This is a tournament rules issue, not a bot issue. Ensure standin approval workflow requires admin verification. Consider integrating MMR checks into the approval flow.

---

## 17. Bot Worker Environment Tampering

**Description:** Someone with server access modifies the bot worker code or environment variables to change behavior (e.g., skip validation, always ready both teams).

**Severity:** CRITICAL  
**Current Mitigation:** The bot worker runs on a server controlled by the platform admin. Access should be restricted.  
**Admin Intervention:** YES — this is a server security issue.  
**Recommendation:** Deploy bot worker in a container with read-only filesystem. Use CI/CD for deployments, not manual edits. Restrict SSH/RDP access. Monitor process integrity.

---

## 18. Creating Fake Bot Events in Firestore

**Description:** An attacker with Firestore write access creates fake `game_ended` or `player_joined` events to manipulate the lobby state machine.

**Severity:** CRITICAL  
**Current Mitigation:** ✅ **IMPLEMENTED.** Firestore rules now explicitly deny all client writes to `/botEvents/**`, `/botCommands/**`, `/botLobbySessions/**`, `/botAccounts/**`, and `/botSyncTasks/**` (`allow write: if false`). Admin reads are permitted for the monitoring UI. Only Admin SDK bypasses these rules.  
**Admin Intervention:** NO — attack vector is blocked.  
**Status:** Resolved.

---

## 19. Occupying All Bot Accounts

**Description:** A malicious organizer or admin schedules many fake matches to consume all bot accounts, denying service to legitimate matches.

**Severity:** HIGH  
**Current Mitigation:** `scheduleLobbyForMatch` creates pending sessions which consume bots. There's no per-tournament bot quota.  
**Admin Intervention:** YES — super admin must cancel fake sessions and investigate.  

✅ **Series Management (IMPLEMENTED):** The bot now properly manages series (BO1/BO2/BO3/BO5). After a game ends, `handleGameEnded()` uses `calculateSeriesResult()` to determine if the series is decided. If more games are needed, `scheduleNextGameInSeries()` creates a new lobby session automatically. If the series is decided, the current session is completed and the bot is freed to the pool. The orchestrator's `scheduleUpcomingMatches()` also checks `match.winnerId` and `currentGameNumber` to avoid creating redundant sessions. This means bots are released promptly after series completion, mitigating exhaustion from series matches occupying bots longer than necessary.  
**Recommendation:** Add per-tournament concurrent session limits. Only super admins can increase the limit. Monitor bot pool utilization.

---

## 20. Match ID Spoofing / Wrong Match Data

**Description:** A bug or malicious action causes the bot to create a lobby for the wrong match, with wrong team assignments, potentially leaking roster info or creating confusion.

**Severity:** HIGH  
**Current Mitigation:** `buildLobbyTeamAssignments` reads team data directly from Firestore match documents. If the match ID is wrong, the players listed will be from the wrong match.  
**Admin Intervention:** YES — must cancel the session and reschedule.  
**Recommendation:** Add match state validation (only schedule lobbies for matches in `scheduled` state). Add a confirmation step in the admin UI before lobby creation. Log all session creation with full context for audit.

---

## Summary Table

| # | Attack | Severity | Auto-Mitigated? | Admin Needed? |
|---|--------|----------|-----------------|---------------|
| 1 | Slot Squatting | HIGH | ✅ YES (auto-kick after grace period) | RARE |
| 2 | Refuse to !ready | HIGH | ✅ YES (multi-phase lobby timeout) | YES (forfeit) |
| 3 | !ready/!unready Spam | MEDIUM | ✅ YES (5s cooldown per player) | NO |
| 4 | Name Impersonation | LOW | YES (ID-based tracking) | NO |
| 5 | Unauthorized Player | CRITICAL | ✅ YES (immediate auto-kick) | NO |
| 6 | Command Queue Flood | CRITICAL | ✅ YES (rules + age check + size warning) | RARE |
| 7 | Password Leak | MEDIUM | ✅ YES (rules + auto-kick griefers) | NO |
| 8 | Bot Credentials Leaked | CRITICAL | NO | YES |
| 9 | No-Show | HIGH | ✅ YES (warning at 15min, close at 30min) | YES (forfeit) |
| 10 | In-Game Disconnect | HIGH | N/A (outside bot scope) | SOMETIMES |
| 11 | Spectator Ghosting | CRITICAL | ✅ YES (spectators OFF + auto-kick) | NO |
| 12 | Fake Captain Ready | MEDIUM | NO (any player can ready) | NO |
| 13 | Password Brute Force | LOW | ✅ YES (auto-kick unauthorized) | NO |
| 14 | Early Leave Manipulation | HIGH | Partially (GC events + API) | SOMETIMES |
| 15 | Slot Swap Stalling | MEDIUM | ✅ YES (enforcement + timeout) | RARE |
| 16 | Smurf Standin | CRITICAL | ✅ PARTIAL (live standin sync) | YES |
| 17 | Server Tampering | CRITICAL | NO | YES |
| 18 | Fake Firestore Events | CRITICAL | ✅ YES (rules deny client writes) | NO |
| 19 | Bot Account Exhaustion | HIGH | ✅ PARTIAL (series mgmt frees bots) | YES |
| 20 | Wrong Match Data | HIGH | Partially (state validation) | YES |

---

## Key Takeaways

### Things That **Do** Require Admin Intervention (Cannot Be Fully Automated)

1. Forfeit rulings (lobby timeout cancels session, but the admin decides the competitive outcome)
2. Standin eligibility verification (MMR checks, identity verification)
3. Security incidents (credential leaks, server tampering)
4. Bot account exhaustion from abuse (requires investigation)

### Things the Bot Now Handles Automatically ✅

1. **Player identity verification** — Steam ID-based, not name-based
2. **Unauthorized player auto-kick** — immediate kick on join + periodic enforcement
3. **Wrong-slot auto-kick** — warning → grace period → kick + re-invite
4. **Spectator blocking** — spectators OFF by default, all non-roster players kicked
5. **Ready command cooldown** — 5-second per-player cooldown prevents spam
6. **Multi-phase lobby timeout** — pending stuck → bot stuck → lobby open warning → lobby open close → ready check stuck; each phase has an independent threshold configurable in the admin BotTab
7. **Command queue protection** — Firestore rules block client writes, age check skips stale commands, queue size warning
8. **Firestore security** — all bot collections locked to server-only writes
9. **Game result capture** — GC events + API cross-reference
10. **Password security** — random generation, configurable visibility, auto-kick neutralizes leaks
11. **Live standin sync** — approved standins are hot-patched into active lobby sessions, preventing wrongful kicks
12. **Series management** — BO1/BO2/BO3/BO5 lifecycle with auto-lobby creation, score tracking, early series decision detection

### Implementation Files

| Feature | File(s) |
|---------|---------|
| Enforcement types/config | `src/types/lobby-bot.ts` |
| Enforcement evaluator | `src/lib/bot/lobby-lifecycle.ts` |
| Event handlers (kick/reinvite) | `src/lib/bot/bot-agent.ts` |
| Command rate limiting | `bot-worker/src/command-handler.ts` |
| Lobby timeout (multi-phase) | `src/app/api/admin/bot/orchestrate/route.ts`, `src/types/lobby-bot.ts` |
| Firestore security | `firestore.rules` |
| Admin UI | `src/app/[tournamentSlug]/admin/tabs/BotTab.tsx` |
| i18n | `messages/pl.json`, `messages/en.json` |
| Live standin sync | `src/lib/standin-actions.ts`, `src/lib/bot/bot-config-actions.ts` |
| Series management | `src/lib/bot/bot-agent.ts`, `src/lib/bot/lobby-lifecycle.ts`, `src/lib/bot/bot-config-actions.ts` |
