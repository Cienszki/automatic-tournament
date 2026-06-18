# Rebuild plan: Dota 2 lobby bot, meepow-style ("one runner per lobby")

## 0. The core lesson we're adopting from meepow

Our current pain (the heartbeat/`lobby_state_update` clog, the cron latency) is a **symptom of one decision**: the lobby *logic* lives in a central, cron-polled Firestore event queue, and every worker streams every lobby event into it.

meepow does the opposite, and it's the right shape:

> **One dedicated, ephemeral process owns one lobby end-to-end, in real time.** A thin central layer only *spawns* runners and *reads* their status. A shared store holds config in / status out. There is no shared event bus, so there is nothing to clog, and scaling is "spawn another process".

We adopt meepow's **architecture**, implemented in **our** stack (Node.js + node-dota2 + Firestore + Railway), reusing the low-level lobby code we already got working (proto patch for `CSODOTALobbyMember`, correct region enum, kick-host-to-pool, `Lobby_<id>` chat, coin-toss two-step, etc.).

## 1. Stack decision (recommended)

- **Language: Node.js + node-dota2.** Reuse our proven lobby primitives; stay in the Firebase/Next ecosystem. (A Go fork of meepow is cleaner-slate but throws away working code and needs Go↔Firebase glue — not recommended.)
- **State store: Firestore** (replaces meepow's Redis — we already run it).
- **Central layer: a thin always-on "Conductor"** service on Railway that watches scheduled matches and spawns runners. (Could be a Firebase cron, but an always-on supervisor gives better crash control.)
- **Per-lobby process: "Lobby Runner"**, spawned by the Conductor. Two hosting options:
  - **A. Child process** (`child_process.fork`) under the Conductor on Railway — simplest, fine at our scale.
  - **B. On-demand container** per lobby (Cloud Run Job / Fly Machine / AWS ECS, exactly like meepow) — stronger isolation, more moving parts.
  - Recommend **A** now, keep **B** in pocket.
- **Admin panel / standings:** existing Next.js + Firestore, unchanged.

## 2. Architecture

```
 [Next.js admin panel] --writes bot config--> [Firestore] <--reads config / writes status+results-- [Lobby Runner]
            ^  reads live status                  ^                                                        |  real-time
            |                                     | spawn + supervise                                      v
 [Conductor service]  --------------------------- spawns 1 runner per active match -------------->   [Steam / Dota GC]
   - watches scheduled matches (pre-warm window)
   - assigns a bot account from the pool
   - supervises runners; respawns on crash (runner reattaches)
   - never processes lobby events
```

Key property: **a runner only ever sees its own lobby's events, in-process.** Cross-lobby interference and queue backlog are structurally impossible.

## 3. Components

### 3.1 Lobby Runner — the heart (one process per match/series)
**Input:** `sessionId`, assigned bot-account credentials, Firebase service account.

**Startup**
1. Read the session from Firestore: match, both rosters (+ standins, coaches), schedule, and the tournament's `config/bot` settings.
2. Connect Steam + Dota GC (node-dota2).
3. **Reattach check:** if the GC cache shows we're already hosting a lobby (after a crash/restart), resume managing it instead of creating a new one.
4. Create the lobby from the DB settings — correct region enum, game mode, league id, visibility, password, DotaTV delay, pause, series type, selection priority. Move host to the **player pool**. Join `Lobby_<id>` chat.
5. Invite the **registered roster only** (both teams' players + approved standins + coaches). **Not** the whitelist.
6. Write `state=lobby_open`, `dotaLobbyId` to the session doc.

**Real-time lifecycle — all driven by node-dota2 events, no queue**
- `practiceLobbyUpdate` → parse `all_members` (patched proto) → **enforce**: kick anyone not on the roster/coach/whitelist; warn players seated on the wrong team's side or in a slot that isn't theirs; track occupancy; persist `lastLobbyPlayers` to the session doc as a *field* (state, not a stream).
- `chatMessage` → ready commands (`!ready`/`!unready`), late-arrival votes, admin commands.
- **Ready-check** → gate on both teams' rostered players seated and ready. *(meepow simply auto-launches when the lobby is full; we deliberately gate on an explicit ready-check instead — one of several places we extend meepow's skeleton with our tournament rules.)*
- **Coin toss** (captains mode + selection priority) → two-step launch (open side selection, relaunch when both captains chose) — the logic we already built.
- **Late arrival** → a team short past scheduled start → open a forfeit/wait vote in chat → tally → forfeit or extend the window.
- **Start** → conditions met → `launchPracticeLobby`.
- **Game start** → lobby state `RUN` → record real `matchId`, `state=in_game`.
- **Game end** → lobby state `POSTGAME` → read `match_outcome` (winner) + duration → record the game result.
- **Series loop** (bo2/bo3/bo5) → if the series isn't decided, recreate the lobby for the next game carrying `radiant_series_wins`/`dire_series_wins`, repeat; else finalize.
- **Finalize** → write the series result → trigger standings sync → leave lobby + disconnect → **process exits** (ephemeral, like meepow's container).

**Local timers:** ready-check timeout, late-arrival window, overall no-show cancel.

### 3.2 Conductor — thin spawner/supervisor (always-on)
- Watches Firestore for upcoming matches inside a **pre-warm window** (e.g., create the lobby 5–10 min before scheduled start) where both teams are set and the tournament's bot is enabled.
- For each: claim an available bot account, create the session doc, **spawn a Lobby Runner** with `sessionId` + account.
- Supervise: on runner exit → clean exit (series done) = release account; crash = **respawn** (runner reattaches to its lobby and resumes from the session doc).
- On its own restart: rediscover active sessions from Firestore and re-supervise (runners keep running independently meanwhile).
- **Never** touches lobby events. Spawn + supervise + read status only.

### 3.3 Bot-account pool
- Max concurrent lobbies = number of accounts. We schedule in advance → size the pool to peak concurrency (e.g., 6–8 accounts for ~6 concurrent matches).
- An account is claimed by one runner for its whole series, released on finalize.
- Track per-account: enabled, `busyWithSessionId`, last successful connect, and a **rate-limit cooldown** after recent creates (Valve throttles lobby creation — we learned this the hard way).

### 3.4 State store (Firestore) — config in, status out
- Runner **reads**: session config (match, rosters, schedule, tournament bot settings).
- Runner **writes**: `state`, `dotaLobbyId`, `lastLobbyPlayers` (occupancy snapshot), `seriesScore`, game/match ids, final result, `lastHeartbeat`.
- Admin panel **reads** status for live display.
- **Principle (from the heartbeat fix):** continuous/high-frequency state (occupancy, heartbeat) is written to **fields**, never queued as processable events. There is no processable event queue at all in the new design.

### 3.5 Admin panel & result sync
- Settings unchanged (the bot config the runner reads).
- Live status: read session docs.
- Result sync: on finalize, write the match result and reuse the existing standings/import path.

## 4. Data model (Firestore)
- `botSessions/{id}`: `{ matchId, tournamentId, botAccountId, state, lobbyName, lobbyPassword, settingsSnapshot, radiantTeam, direTeam, schedule, dotaLobbyId, lastLobbyPlayers, seriesFormat, currentGameNumber, seriesScore, completedGameIds, result, lastHeartbeat, timestamps }`.
- `botAccounts/{id}`: `{ enabled, busyWithSessionId|null, lastConnectedAt, cooldownUntil }` (creds stay in a secret store, referenced).
- `tournaments/{id}/config/bot`: unchanged (settings source).
- Results → existing match/standings collections.

## 5. Lobby Runner state machine
`created → lobby_open → ready_check → (coin_toss) → in_game → post_game → [next_game ↺ | finalizing → done]`
with side branches `late_vote` (from lobby_open/ready_check) and `cancelled` (no-show / admin). Each transition is driven by a specific node-dota2 event or local timer; every handler is idempotent and re-derives from current state so a restart is safe.

## 6. Concurrency, scaling, no-clog
- One runner per lobby → full isolation; a busy lobby never affects another.
- No shared queue → backlog/clog is impossible by construction.
- Scale = spawn more runners, bounded only by account count.

## 7. Robustness / crash recovery
- **Runner crash** → Conductor respawns (same `sessionId` + account) → runner **reattaches** to the existing GC lobby via the SO cache and resumes from the session doc.
- **Conductor crash / redeploy** →
  - With **option B** (container-per-lobby): runners are genuinely independent processes and keep going untouched; the restarted Conductor rediscovers active sessions from Firestore and re-supervises.
  - With **option A** (`child_process.fork` under one Railway service): a Conductor restart/redeploy **also cycles its child runners**. That's still safe because each runner **reattaches** to its live lobby on restart (an in-progress match survives a redeploy), but it is *not* "unaffected." If you need option-A runners to outlive a Conductor redeploy, spawn them `detached` (or move to option B). This is the main trade-off between the two hosting choices.
- **Idempotency** everywhere: check current state before acting (don't re-create if already hosting; don't re-invite seated players).

## 8. Deployment
- Railway: a `conductor` service that forks child runners (option A). Or per-lobby containers (option B) on Cloud Run Jobs / Fly Machines / ECS.
- Secrets: Steam creds per account + Firebase service account via env; runner receives its account creds from the Conductor/secret store.
- The **proto patch** (inject `CSODOTALobbyMember`) and the **region map** live in the runner build (carry over the Dockerfile fix).

## 9. Migration from the current system
- **Reuse:** `dota-client.js` lobby primitives + proto patch + region map + coin-toss/ready/late logic — lift into the runner.
- **Replace:** the Firebase cron orchestrator + `botEvents` queue + the 4 persistent per-account workers → the Conductor + per-lobby runners.
- **Keep:** Firestore data, admin panel, settings, standings sync.
- **Phase it** (see roadmap) and cut over one tournament before retiring the old path.

## 10. Testing
- Reuse the dry-run harness pattern (spawn a runner for a test session, a human joins, verify each lifecycle step) — but now exercising the *real* runner code, not a separate test tool.
- Unit-test the state-machine transitions in isolation.

## 11. Risks / open questions
- Account count vs peak concurrency (provision enough).
- Runner hosting: child_process (simple) vs container-per-lobby (isolated) — pick per ops appetite.
- Reattach-after-crash correctness (verify GC cache behavior on reconnect).
- Lobby-creation rate limits (space out; never spam — bake cooldowns into the pool).
- Captains-mode coin toss remains the least-tested path; prioritize a live dry run.

## 12. Roadmap (milestones)
- **M1 — Runner skeleton:** create → host-to-pool → invite roster → start → detect `RUN`/`POSTGAME` → finalize, for a single match, manually spawned. Reuse existing lobby code. (Proves the per-process model end-to-end.)
- **M2 — Full lifecycle in the runner:** member enforcement/kick, chat, ready-check, coin toss, late-arrival voting, bo3/bo5 series loop, reattach-on-restart.
- **M3 — Conductor:** scheduling + pre-warm, account pool, spawn, supervise, crash recovery.
- **M4 — Admin status + result sync.**
- **M5 — Cutover** one tournament; then retire the cron orchestrator + `botEvents` queue.
