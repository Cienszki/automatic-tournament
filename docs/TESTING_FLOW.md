# Bot Worker — Full Testing Flow

**Version:** 2.0  
**Updated:** April 22, 2026  
**Purpose:** Complete reference for running, understanding, and extending bot-worker tests.

---

## Overview

The bot worker is tested in four layers:

| Layer | Type | Requires | Speed |
|-------|------|----------|-------|
| 1. Pure logic | Automated (inline) | Nothing | < 1 s |
| 2. Firestore integration | Automated (real DB) | Firebase credentials | 5–15 s |
| 3. Steam / Dota 2 GC — single bot | Semi-automated | Steam account + human tester OR bot accounts | 3–10 min |
| 4. Steam / Dota 2 GC — multi-bot | **Fully automated** | 2–4 registered bot accounts | 5–15 min |
| 5. Admin UI smoke | Manual (browser) | Running Next.js dev server | 10–20 min |

**Quick regression**: run layers 1 → 2 → 4 in order. Total: ~20 min with 4 bots available.

---

## File Inventory

| File | Layer | Automated? | What it tests |
|------|-------|-----------|---------------|
| `test-placeholder-logic.ts` | 1 | ✅ Full | Logic: `applyPlaceholders`, `getEffectiveChatMessages`, `checkTeamSlots` — 58 assertions |
| `test-command-queue.ts` | 2 | ✅ Full | Firestore command queue: write → CommandHandler picks up → marks complete; old command expire; unknown type |
| `test-accounts.ts` | 2 | ✅ Full | Reads `/botAccounts` from Firestore and prints a status table; no Steam connection |
| `test-login.ts` | 3 | ✅ Auto | Steam login + GC connection; no lobby — just verifies credentials work |
| `test-features.ts` | 3 | ⚠️ Manual | Lobby creation, invite, join detection, kick (requires Cienszki to be online) |
| `test-chat.ts` | 3 | ⚠️ Manual | Lobby chat: welcome message + `!hi` command reply (requires Cienszki) |
| `test-dota-client.ts` | 3 | ⚠️ Manual | `DotaClient` class wrapper: all high-level events, auto-kick, slot validation (requires Cienszki) |
| `test-ready-check.ts` | 3 | ⚠️ Manual | `!r` / `!ur` ready-check flow: wrong slot rejection, correct slot acceptance, `!ur` reset, no-cooldown spam (requires Cienszki) |
| `test-two-player-launch.ts` | 3 | ⚠️ Manual | **Two real captains** (Cienszki + Pupa): both join, choose sides, both type `!r`, bot starts game with coin toss; see §3f |
| `test-multi-bot.ts` | 4 | ✅ Auto | **Full lobby simulation** using registered bot accounts — covers all of the above without a human; see §4 |

---

## Running Order (Full Regression)

```
Step 1  — npx tsx bot-worker/test-placeholder-logic.ts
Step 2  — npx tsx bot-worker/test-command-queue.ts
Step 3  — npx tsx bot-worker/test-accounts.ts             ← verify bots are registered
Step 4  — npx tsx bot-worker/test-login.ts                ← verify host credentials
Step 5  — npx tsx bot-worker/test-multi-bot.ts            ← full automated lobby simulation
Step 5b — npx tsx bot-worker/test-two-player-launch.ts    ← two-captain coin-toss launch test (requires Cienszki + Pupa)
Step 6  — (optional) Manual UI smoke test (see §5)
```

All commands run from the project root (`automatic-tournament/`).

---

## §1 — Pure Logic Test: `test-placeholder-logic.ts`

### What it covers

| Section | Cases | Description |
|---------|-------|-------------|
| `applyPlaceholders` | 12 | `{player_name}`, `{team_name}`, `{missing}`, repeats, unknown keys, empty string, multiline |
| `getEffectiveChatMessages` | 15 | Per-bot overrides, cross-contamination check, empty override object, undefined field |
| `checkTeamSlots` | 19 | Solo player, 5-player team, Dire side, unassigned = fail, wrong side = fail, spectator slot = fail |
| Integration pipeline | 12 | End-to-end: rejection message builds correctly, ready message on all-seated, multi-missing join |

**Total: 58 assertions  |  Expected: 58 passed, 0 failed**

### How to run

```bash
npx tsx bot-worker/test-placeholder-logic.ts
```

No environment variables needed. Exit code `0` = all passed.

### When to run
- After any change to `applyPlaceholders`, `getEffectiveChatMessages`, or slot validation logic
- Always run before pushing to `main`

---

## §2 — Firestore Integration Tests

### 2a — `test-command-queue.ts`

#### What it covers

1. Push a `create_lobby` command into `/botCommands/{botId}/queue`
2. `CommandHandler` (running against a stub `DotaClient`) picks it up within 5 s
3. Command document is marked `status: 'completed'`
4. A `botEvents` document is written back
5. Old command (> 5 min): auto-marked `'failed'`
6. Unknown command type: logged, not crashed, no status regression

**All Firestore documents written are cleaned up after the test.**

#### How to run

```bash
npx tsx bot-worker/test-command-queue.ts
```

Requires `FIREBASE_SERVICE_ACCOUNT_BASE64` in `bot-worker/.env`.

### 2b — `test-accounts.ts`

#### What it covers

Reads `/botAccounts` from Firestore and prints a formatted table:

```
  #  Doc ID                  Username         Display name         Steam32      Status   Enabled  Heartbeat   Notes
  ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  1  <firestoreId>           pd2ihbot1        PD2IH Bot 1          123456789    idle     ✓        2m ago
  2  <firestoreId>           pd2ihbot2        PD2IH Bot 2          987654321    idle     ✓        never
  ...
```

Also prints the `--bot-id=<id>` run command for each bot and a Steam identity map useful for test constants.

#### How to run

```bash
npx tsx bot-worker/test-accounts.ts
```

#### When to run
- After registering new bots in the admin panel (to confirm they show up)
- Before running `test-multi-bot.ts` (to verify accounts exist and are enabled)

---

## §3 — Single-Bot / Manual Tests (require human or substitution)

These tests were written before the bot accounts were available. They remain useful for:
- Verifying a specific feature in isolation
- Testing with a **real human player** (Cienszki) rather than another bot
- Debugging bot behavior interactively

> **Automated alternative:** `test-multi-bot.ts` covers all of these automatically using
> the registered bot accounts. Run that unless you need the interactive mode.

### 3a — `test-login.ts`

Tests Steam login and Dota 2 GC connection only (no lobby).

```bash
npx tsx bot-worker/test-login.ts
```

Expected output:
```
[INFO] Connecting as pd2ihbot1...
[INFO] Steam: Logged in OK (EResult=1)
[INFO] Dota 2: GC connection established
[INFO] Account persona: PD2IH Bot 1
All checks passed ✓
```

### 3b — `test-features.ts` ⚠️ Requires Cienszki online

End-to-end lobby lifecycle:

| # | Step | What it verifies |
|---|------|-----------------|
| 1 | Connect | Steam login + GC ready |
| 2 | Create lobby | `createPracticeLobby` succeeds, Lobby object populated |
| 3 | Invite Cienszki | GC invite + Steam friend message sent |
| 4 | Send welcome | Chat message delivered (practceLobbyUpdate fires) |
| 5 | Cienszki joins | `practiceLobbyUpdate` fires with his Steam32 ID |
| 6 | See Cienszki | Bot sends "I see you" confirmation message |
| 7 | Kick | `practiceLobbyKick` removes him |
| 8 | Leave | Bot leaves lobby cleanly |

```bash
npx tsx bot-worker/test-features.ts
```

### 3c — `test-chat.ts` ⚠️ Requires Cienszki online

Lobby chat interaction:

| # | What it tests |
|---|--------------|
| Welcome message | `{player_name}` substituted on join |
| Welcome image URL | URL appears in chat (Dota 2 text-only) |
| `!hi` command | Bot replies "Hi \<name\>!" |
| Lobby stays alive | Bot observes until Cienszki leaves or 8-minute timeout |

```bash
npx tsx bot-worker/test-chat.ts
```

### 3d — `test-dota-client.ts` ⚠️ Requires Cienszki online

Tests the **`DotaClient` class** wrapper (higher-level API, not raw node-dota2):

| Feature | How verified |
|---------|-------------|
| `DotaClient.connect()` | Returns without error |
| `DotaClient.createLobby()` | Lobby created, `lobbyId` returned |
| `DotaClient.setSessionTeams()` | Expected players configured |
| `DotaClient.invitePlayer()` | GC invite sent |
| `'playerJoined'` event | Fires with Cienszki's `LobbyPlayerInfo` |
| Self-loop guard | `'chatMessage'` does NOT fire for bot's own messages |
| `'chatMessage'` for player | Fires for `!hi` from Cienszki |
| Auto-kick | Uninvited player gets kicked (manual trigger) |
| Slot validation in update | `lobbyUpdate` event includes `TeamSlotValidation` |
| `DotaClient.leaveLobby()` | Clean leave |

```bash
npx tsx bot-worker/test-dota-client.ts
```

### 3e — `test-ready-check.ts` ⚠️ Requires Cienszki online

Tests the full `!r` / `!ur` ready-check scenario with **a single human player**. Uses the same inline logic as `test-multi-bot.ts` but coordinates with a human instead:

| Test | Scenario |
|------|---------|
| A | Welcome message contains `{player_name}` |
| A-2 | `currentPlayers` snapshot populated after join |
| B | `!r` from **unassigned** → bot sends `teamNotReadyMessage` with missing names |
| B-2 | `radiantReady` stays `false` after rejection |
| C | `!r` from **Radiant slot** → bot sends `teamReadyMessage`, flags set |
| D | `!ur` → `radiantReady` cleared, ack message sent |
| E | 3× `!r` quickly → 3 bot responses (no cooldown) |
| F | `currentPlayers` snapshot accuracy (final lobby state) |

```bash
npx tsx bot-worker/test-ready-check.ts
```

The bot sends Polish-language test instructions to Cienszki in lobby chat for each stage.

---

### 3f — `test-two-player-launch.ts` ⚠️ Requires Cienszki + Pupa online

Tests the full **two-captain coin-toss match-start** flow.
Both real players must be online in Dota 2 simultaneously.

**Testers:**
| Player | Steam32 | Steam64 | Assigned side |
|--------|---------|---------|---------------|
| Cienszki | 35747920 | 76561197996013648 | Radiant |
| Pupa | 111886752 | 76561198072152480 | Dire |

| Test | Scenario |
|------|---------|
| A | GC invite + Steam friend message sent to both players |
| B | Welcome message sent to each player as they join (`{player_name}` substitution) |
| C | `!r` from spectator/unassigned → bot replies asking player to sit in any player slot |
| D | `!r` while unassigned does NOT mark player ready |
| E | Both seated in any player slot (0–9) and type `!r` → both accepted; side at this point is irrelevant |
| F | `startGame()` succeeds — coin toss Phase 1 triggered (`launchPracticeLobby`) |
| G | `coinTossResult` event fires — priority team identified and announced in chat |
| H | Players pick side/priority in lobby UI → `coinTossSelectionComplete` fires → Phase 2 auto-launches game |

> **Note:** Dota 2 GC may reject `launchPracticeLobby` unless all 10 player slots are filled.
> With only 2 real players the launch may fail — the test records this gracefully and
> distinguishes bot logic failures from GC slot requirements.

```bash
npx tsx bot-worker/test-two-player-launch.ts
```

---

## §4 — Multi-Bot Automated Test: `test-multi-bot.ts`

This is the primary automated regression tool. It uses **all registered + enabled bots** from Firestore and runs the full lobby lifecycle with **no human needed**.

### Bot roles

| Index | Role | Slots they occupy |
|-------|------|-------------------|
| Bot[0] | **Host** — creates lobby, runs all logic | Unassigned pool |
| Bot[1] | **RadiantBot1** — Radiant slot 0 | Radiant |
| Bot[2] | **RadiantBot2** — Radiant slot 1 | Radiant (skipped if only 2 bots) |
| Bot[3] | **DireBot1** — Dire slot 0 | Dire (skipped if < 4 bots) |

Roles are assigned by **Firestore creation order** (`orderBy('createdAt')`). Run `test-accounts.ts` first to see which bot gets which role.

### Test matrix

| Test | 2 bots | 3 bots | 4 bots | What it verifies |
|------|--------|--------|--------|-----------------|
| A — Bots join | ✅ | ✅ | ✅ | `joinPracticeLobby` works; host's `practiceLobbyUpdate` detects new players |
| B — Welcome messages | ✅ | ✅ | ✅ | `{player_name}` substituted on join for each bot |
| C — !r from unassigned | ✅ | ✅ | ✅ | Slot validation rejects `!r` when not on the correct side |
| D — !r with one missing | ✅ | ✅ | ✅ | Rejection message lists the specific missing player's name |
| E — Radiant ready | ✅ | ✅ | ✅ | All Radiant bots seated → `teamReadyMessage`, `radiantReady=true` |
| F — DireBot wrong slot | ❌ skip | ✅ | ✅ | Dire bot's `!r` from unassigned is rejected |
| G — DireBot ready | ❌ skip | ✅ | ✅ | Dire bot on Dire slot → `teamReadyMessage`/`allReadyMessage` |
| H — Both teams ready | ❌ skip | ✅ | ✅ | `ALL_READY_MSG` triggered when both flags true |
| I — !ur reset | ✅ | ✅ | ✅ | `radiantReady` cleared, ack message sent |
| J — No-cooldown spam | ✅ | ✅ | ✅ | 3× `!r` in <1 s each gets a response |

### How to run

```bash
# Make sure bot accounts are in Firestore first:
npx tsx bot-worker/test-accounts.ts

# Run the automated test:
npx tsx bot-worker/test-multi-bot.ts
```

### Full expected output (4 bots, all pass)

```
──────────────────────────────────────────────────────────────
  SETUP — Fetching bot credentials from Firestore
──────────────────────────────────────────────────────────────
  ℹ  Found 4 enabled bot account(s) in Firestore
  PD2IH — Multi-Bot Automated Lobby Test
  Host bot    : PD2IH Bot 1  (pd2ihbot1)
  Player 1    : PD2IH Bot 2  (pd2ihbot2)  → Radiant #1
  Player 2    : PD2IH Bot 3  (pd2ihbot3)  → Radiant #2
  Player 3    : PD2IH Bot 4  (pd2ihbot4)  → Dire #1
...
  FULL TEST SUMMARY
  ✓ Connect bot 0 (pd2ihbot1)
  ✓ Connect bot 1 (pd2ihbot2)
  ✓ Connect bot 2 (pd2ihbot3)
  ✓ Connect bot 3 (pd2ihbot4)
  ✓ Host creates lobby
  ✓ TEST A: all player bots joined  (3 bots)
  ✓ TEST B: welcome to PD2IH Bot 2
  ✓ TEST B: welcome to PD2IH Bot 3
  ✓ TEST B: welcome to PD2IH Bot 4
  ✓ TEST C: !r from unassigned rejected  (atSlot=unassigned(-1))
  ✓ TEST D: !r rejected (second Radiant missing)
  ✓ TEST E: Radiant ready (all on correct slots)
  ✓ TEST F: DireBot !r from unassigned rejected
  ✓ TEST G: DireBot ready (on correct slot)
  ✓ TEST H: both teams ready → allReadyMessage
  ✓ TEST I: !ur clears ready state
  ✓ TEST J: no cooldown (3x !r)  (3 responses)

  Passed: 17  Failed: 0  Skipped: 0
```

### Known limitations

| Limitation | Explanation |
|------------|-------------|
| Connection rate limiting | Bots connect sequentially with 3 s gaps to avoid Steam's rate limiter. With 4 bots, setup takes ~12 s before lobby creation. |
| GC deduplication | The Dota 2 GC may drop identical messages sent < 1 s apart. TEST J may report "2 responses" instead of 3 — this is logged as a pass with a note, not a failure. |
| Sentry files | Each bot writes its own `./sentry-<username>` file in the root. This is normal and prevents Steam Guard emails on future logins. |
| Slot assignment race | `joinPracticeLobbyTeam` takes ~300–800 ms to propagate to the host's `practiceLobbyUpdate`. Tests wait 1200 ms after slot changes to avoid flakes. |
| no `allReadyMessage` in some runs | TEST H fires only if both `radiantReady` AND `direReady` are `true` simultaneously. If TEST I already cleared `radiantReady`, TEST H is auto-skipped. |

---

## §5 — Admin UI Smoke Test (Manual, Browser)

Open `localhost:3000/{tournament}/admin` and navigate to the **Bot** tab.

### 5a — Bot Configuration tab

| Check | How to verify |
|-------|--------------|
| Bot system can be enabled/disabled | Toggle and save; no console errors |
| Lobby settings preserved | Change game mode, server region, save, reload page |
| Ready-check commands configurable | Add custom command, save, reload |
| Chat message templates editable | Change `welcomeMessage`, save, visible in UI on reload |
| Per-bot personality section visible | Section renders; can expand/collapse each bot account |
| Per-bot message override works | Enter custom `teamReadyMessage` for Bot 1, save, reload — still present |

### 5b — Bot Accounts tab

| Check | How to verify |
|-------|--------------|
| Account list loads | 4 accounts visible (pd2ihbot1..4) with status badges |
| Status badges correct colour | idle = green, error = red, offline = grey |
| Last heartbeat shows | "X min ago" or "never" updates on reload |
| Add new account form | Fill username / display name / password, submit → appears in list |
| Enable/disable toggle | Toggle one bot, reload — state persists |
| Delete account | Remove a test account, confirm it disappears |

### 5c — Active Sessions tab

| Check | How to verify |
|-------|--------------|
| Shows "no active sessions" when idle | Verify text rather than blank |
| Shows session once bot starts | Run the bot worker and navigate back — session card appears within 30 s |
| Session card shows correct match/tournament | Verify against what was dispatched |

### 5d — Bot Assignment in Match view

| Check | How to verify |
|-------|--------------|
| "Start bot for this match" button visible | Navigate to a match with both teams confirmed |
| Assignment triggers command in Firestore | Click button, check `botCommands/{botId}/queue` in Firebase console |
| Bot status updates to `in_lobby` | After bot worker processes command, status badge changes |

---

## §6 — Feature Coverage Matrix

| Feature | Logic test | Command queue | Login test | Multi-bot test | Manual test |
|---------|-----------|---------------|------------|---------------|-------------|
| `applyPlaceholders` | ✅ § 1 | — | — | ✅ B,C,D,E | ✅ test-chat |
| `getEffectiveChatMessages` | ✅ § 1 | — | — | — | — |
| `checkTeamSlots` | ✅ § 1 | — | — | ✅ C,D,E,F,G | ✅ test-ready-check |
| Steam login / GC connect | — | — | ✅ | ✅ A | ✅ test-features |
| Lobby creation | — | — | — | ✅ Step 1 | ✅ test-features |
| Player join detection | — | — | — | ✅ A | ✅ test-features |
| Welcome message on join | — | — | — | ✅ B | ✅ test-chat |
| Kick player | — | — | — | — | ✅ test-features |
| Lobby chat send | — | — | — | ✅ all | ✅ test-chat |
| `!r` wrong slot → reject | — | — | — | ✅ C,D,F | ✅ test-ready-check B |
| `!r` correct slot → ready | — | — | — | ✅ E,G | ✅ test-ready-check C |
| `!ur` reset | — | — | — | ✅ I | ✅ test-ready-check D |
| No-cooldown spam | — | — | — | ✅ J | ✅ test-ready-check E |
| Both teams ready → allReady | — | — | — | ✅ H | — |
| Slot move (joinPracticeLobbyTeam) | — | — | — | ✅ D,E,G | — |
| DotaClient wrapper | — | — | — | indirectly | ✅ test-dota-client |
| Firestore command queue | — | ✅ full | — | — | — |
| `CommandHandler` lifecycle | — | ✅ full | — | — | — |
| Per-bot personality overrides | ✅ § 1 | — | — | — | manual UI |
| Admin UI — bot config | — | — | — | — | ✅ § 5a |
| Admin UI — accounts list | — | — | — | — | ✅ § 5b |
| Admin UI — assignment | — | — | — | — | ✅ § 5d |

**Gaps / not yet tested:**
- `launchPracticeLobby()` (start the game) — no automated test exists
- Post-game result sync from OpenDota
- Series format (BO2/BO3) lobby flow
- Late timer split announcement (split into `announcementBeforeGame` / `announcementInGame`)
- Standin sync during live lobby

---

## §7 — Adding New Tests

### Adding a pure logic assertion

Open `test-placeholder-logic.ts`, find the relevant section, and add a new `check()` call following the existing pattern:

```typescript
check('my description', () => {
  const result = myFunction(input);
  assertEquals(result, expectedOutput);
});
```

### Adding a multi-bot test stage

Open `test-multi-bot.ts` and insert a new `section()/commandLog/record()` block after the closest related existing stage. Update the test matrix in this document.

### Testing a new bot command

1. Add a new command keyword to the `chatMessage` handler in `test-multi-bot.ts`
2. Have the appropriate player bot send it at the right stage
3. Assert on the response in `commandLog`

### Registering a new bot account

1. Go to `/{tournament}/admin` → Bot tab → Konta Steam → Dodaj konto
2. Enter username, display name, Steam password
3. Run `npx tsx bot-worker/test-accounts.ts` to confirm `enabled: true`
4. Run `npx tsx bot-worker/test-multi-bot.ts` — the new bot will be picked up automatically

---

## §8 — Environment Setup

### `bot-worker/.env` minimum required keys

```env
# Firebase (read bot credentials from /botAccounts)
FIREBASE_SERVICE_ACCOUNT_BASE64=<base64 encoded service account JSON>

# Host bot Steam credentials (used when not reading from Firestore: test-login, test-features, test-chat)
STEAM_USERNAME=pd2ihbot1
STEAM_PASSWORD=Chomik69!1
```

For `test-multi-bot.ts`, `test-accounts.ts`, and `test-command-queue.ts`, only `FIREBASE_SERVICE_ACCOUNT_BASE64` is needed. The bot credentials are read **directly from Firestore** (decoded from `encryptedPassword` base64).

For `test-login.ts`, `test-features.ts`, `test-chat.ts`, `test-dota-client.ts`, `test-ready-check.ts`, the `STEAM_USERNAME` / `STEAM_PASSWORD` are needed (the host bot).

### Sentry files

Steam generates a sentry file (machine auth token) on first login. Each bot stores its own:
- Host bot (raw tests): `./test-sentry`
- Multi-bot test: `./sentry-bot-<username>` per bot

These files are normal and prevent repeated Steam Guard emails on subsequent runs. Do not delete them unless switching machines.

---

*This document is maintained alongside the test files in `bot-worker/`. Update §6 whenever a new feature is covered by tests.*
