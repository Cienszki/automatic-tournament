# Dota 2 Lobby Bot System — Full Documentation

**Version:** 1.2  
**Last Updated:** March 2026  
**Status:** Implementation complete — not yet deployed

**Changelog:**
- v1.2 — Multi-phase lobby timeouts, multi-game series management, live standin sync
- v1.1 — Abuse analysis document split out
- v1.0 — Initial documentation

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [How It Works — Step by Step](#3-how-it-works--step-by-step)
4. [Component Deep Dive](#4-component-deep-dive)
5. [Firestore Data Model](#5-firestore-data-model)
6. [Admin Panel (Bot Tab)](#6-admin-panel-bot-tab)
7. [Deployment & Go-Live Checklist](#7-deployment--go-live-checklist)
8. [Steam Account Requirements](#8-steam-account-requirements)
9. [Testing Program](#9-testing-program)
10. [Security & Abuse Analysis](#10-security--abuse-analysis)
11. [Troubleshooting](#11-troubleshooting)
12. [FAQ](#12-faq)

---

## 1. System Overview

The Lobby Bot system automates the entire pre-match workflow for Dota 2 tournament matches on dota2inhouse.pl:

1. **Before match time** — automatically creates a Dota 2 lobby with configured settings
2. **Invites all players** — sends Steam invites to both teams' players, coaches, and approved standins
3. **Posts instructions** — sends configurable chat messages (welcome, team assignments, rules)
4. **Handles ready check** — listens for `!ready` / `!unready` commands in lobby chat
5. **Validates requirements** — checks team names are set, all 10 players are in correct slots
6. **Starts the game** — initiates coin toss → game launch
7. **Observes the match** — stays connected as spectator during the game
8. **Post-match sync** — waits a configurable delay (default 5 min), then triggers match data import from OpenDota

### Why a separate process?

The Dota 2 Game Coordinator (GC) protocol requires a **persistent TCP connection** via Steam. This is fundamentally incompatible with Next.js serverless functions (which are short-lived HTTP handlers). Therefore, the bot runs as a **separate long-running Node.js process** ("bot-worker") that communicates with the Next.js app through Firestore documents acting as a message queue.

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│  Next.js Application (Serverless)                                   │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │  Admin Panel      │  │  Orchestrator    │  │  API Routes      │  │
│  │  (BotTab.tsx)     │  │  (/api/admin/    │  │  /api/admin/bot  │  │
│  │                   │  │  bot/orchestrate)│  │  /config         │  │
│  │  • Configure      │  │                  │  │  /sessions       │  │
│  │  • Monitor        │  │  • Health checks │  │  /pool-status    │  │
│  │  • Enable/disable │  │  • Schedule jobs │  │                  │  │
│  └──────────────────┘  │  • Assign bots   │  └──────────────────┘  │
│                        │  • Process events │                        │
│                        │  • Trigger syncs  │                        │
│                        └────────┬─────────┘                        │
└─────────────────────────────────┼──────────────────────────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │      FIRESTORE             │
                    │                            │
                    │ /botAccounts/{id}          │  ← Bot credentials & status
                    │ /botCommands/{id}/queue/   │  ← Commands: orchestrator → worker
                    │ /botEvents/{id}            │  ← Events: worker → orchestrator
                    │ /botLobbySessions/{id}     │  ← Lobby session state
                    │ /botSyncTasks/{id}         │  ← Scheduled sync jobs
                    │ /tournaments/{id}/config/bot│  ← Per-tournament config
                    └─────────────┬─────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │  Bot Worker Process(es)     │
                    │  (Separate Node.js)         │
                    │                            │
                    │  ┌────────────────────┐    │
                    │  │  DotaClient        │    │  ← steam-user + node-dota2
                    │  │  (Steam + Dota 2)  │    │
                    │  └────────┬───────────┘    │
                    │  ┌────────┴───────────┐    │
                    │  │  CommandHandler     │    │  ← Polls Firestore commands
                    │  └────────────────────┘    │
                    │  ┌────────────────────┐    │
                    │  │  EventBridge        │    │  ← Writes events to Firestore
                    │  └────────────────────┘    │
                    └────────────┬───────────────┘
                                 │
                    ┌────────────▼───────────────┐
                    │  Valve Steam / Dota 2 GC    │
                    │  (Game Coordinator)          │
                    │                              │
                    │  • Custom lobby management   │
                    │  • Player invite system      │
                    │  • Chat messaging            │
                    │  • Game launch               │
                    │  • SourceTV data             │
                    └──────────────────────────────┘
```

---

## 3. How It Works — Step by Step

### Phase 1: Scheduling (Orchestrator)

The orchestrator runs periodically (every 1–5 minutes) via cron or manual trigger:

1. **Scans tournaments** with bot enabled
2. **Finds upcoming matches** whose `scheduledFor` time falls within the configurable lead time window (default: 10 minutes before match time)
3. **Creates a LobbySession** document in Firestore with:
   - Match info (teams, players, approved standins)
   - Generated lobby password
   - Initial state: `pending`
4. **Assigns an available bot account** to the session (first-come, first-served)
   - Bot status changes: `idle` → `starting`
   - Session state changes: `pending` → `bot_assigned`

### Phase 2: Lobby Creation (Bot Worker)

The bot-worker process, which is continuously polling its command queue:

1. **Receives `create_lobby` command** with lobby settings (game mode, server, password, etc.)
2. **Calls `Dota2.createPracticeLobby()`** via the GC protocol
3. **Emits `lobby_created` event** back to Firestore
4. Session state: `bot_assigned` → `lobby_creating` → `lobby_open`

### Phase 3: Player Invites (Bot Worker)

1. **Receives `invite_players` command** with all Steam IDs
2. **Calls `Dota2.inviteToLobby()`** for each player (500ms delay between invites to avoid rate limits)
3. Players receive Steam invites and join the lobby
4. **Sends welcome message** and team assignment chat messages

### Phase 4: Ready Check (Orchestrator + Bot Worker)

1. Players join lobby and move to their assigned team slots
2. A player (or captain, if configured) types `!ready` in lobby chat
3. **Bot worker detects the chat message**, emits a `chat_message` event
4. **Orchestrator processes the event**, identifies which team the player belongs to, updates ready state
5. When one team is ready, bot posts: `"<TeamName> is ready! Waiting for the other team..."`
6. When **both teams** ready:
   - Session state: `lobby_open` → `ready_check`
   - Bot posts the "all ready" message

### Phase 5: Validation (Orchestrator)

Once both teams are ready, the system validates:

1. **Team names set** — Both Radiant and Dire must have team names (not empty)
2. **Correct players in correct slots** — Each expected player must be on their assigned side
3. **5v5 minimum** — Both sides need at least 5 players
4. **No unauthorized players** — Warns about unknown players in team slots

If validation **passes**: state → `requirements_met`  
If validation **fails**: bot posts error messages, state reverts to `lobby_open`

### Phase 6: Game Launch

1. Bot receives `start_game` command
2. **Calls `Dota2.launchPracticeLobby()`** — this triggers the coin toss
3. State: `requirements_met` → `coin_toss` → `in_game`
4. Bot stays connected as observer throughout the game

### Phase 7: Post-Match

1. Game ends — bot detects via SourceTV data or lobby state change
2. State: `in_game` → `post_game`
3. **Writes a sync task** to Firestore with a scheduled time (default: 5 minutes after game end)
4. The orchestrator picks up the sync task and triggers the existing match import/sync system
5. State: `post_game` → `syncing` → `completed`
6. Bot is released back to idle pool

### State Machine

```
pending → bot_assigned → lobby_creating → lobby_open → ready_check →
requirements_met → coin_toss → in_game → post_game → syncing → completed

Any state can → error
Any pre-game state can → cancelled
error → pending (retry)
```

---

## 4. Component Deep Dive

### 4.1. Type Definitions (`src/types/lobby-bot.ts`)

All TypeScript interfaces for the system. Key types:

| Type | Purpose |
|------|---------|
| `BotAccount` | Steam bot credentials and runtime status |
| `TournamentBotConfig` | Per-tournament settings (admin configurable) |
| `LobbySettings` | Dota 2 lobby creation parameters |
| `ReadyCheckConfig` | Ready/unready commands, timeout, captain-only toggle |
| `LobbyChatConfig` | Configurable welcome, team assignment, validation messages |
| `PostMatchConfig` | Sync delay, auto-sync toggle |
| `LobbySession` | Runtime state of a single lobby instance |
| `LobbyTeamAssignment` | Expected players per team (including standins) |

### 4.2. Server Actions (`src/lib/bot/bot-config-actions.ts`)

Firestore CRUD running with `'use server'` (Next.js server actions):

- `getTournamentBotConfig()` / `saveTournamentBotConfig()` — config CRUD
- `getAllBotAccounts()` / `getAvailableBotAccounts()` — bot account management
- `registerBotAccount()` / `updateBotAccountStatus()` — bot registration
- `createLobbySession()` / `getLobbySession()` / `updateLobbySession()` — session CRUD
- `buildLobbyTeamAssignments()` — resolves rosters + approved standins into player lists
- `scheduleLobbyForMatch()` — creates a pending session for an upcoming match (carries `seriesFormat`, `seriesScore`, `completedGameWinners`)
- `syncLobbySessionStandins(tournamentId, matchId)` — hot-patches all active pre-game sessions with the latest approved standin roster; called automatically when a standin request is approved or an appeal is approved
- `scheduleNextGameInSeries(previousSession, nextGameNumber)` — clones an ended session into a new `pending` session for the next game in a series; re-reads standins fresh, strips/appends " - Game N" suffix on the lobby name, carries over `seriesScore` and `completedGameWinners`; returns `{ success, sessionId, error }`

### 4.3. Lobby Lifecycle (`src/lib/bot/lobby-lifecycle.ts`)

Pure logic (no I/O):

- `validateLobbyRequirements()` — checks team names, player slots, 5v5 count
- `identifyPlayerTeam()` — maps a Steam ID to radiant/dire
- `isReadyCommand()` / `isUnreadyCommand()` — command matching
- `isValidTransition()` — enforces state machine rules
- `formatTeamAssignmentMessage()` / `formatValidationErrors()` — chat formatting
- `calculateSeriesResult(session)` — determines whether a series is decided; returns `SeriesResult { decided, winnerId, isDraw, score, gamesPlayed, maxGames, winsToWin }`. BO2 special case: series always plays both games, a 1-1 result is a draw.
- `getWinsToWin(seriesFormat)` — returns min wins needed (BO1→1, BO2→2, BO3→2, BO5→3)
- `getNextGameNumber(session)` — returns `completedGameWinners.length + 1`
- `formatSeriesScore(session)` — `"1-0"` / `"1-1"` string for chat messages

### 4.4. Bot Pool Manager (`src/lib/bot/bot-pool-manager.ts`)

Multi-instance management:

- `assignBotsToSessions()` — assigns idle bots to pending sessions (1:1 constraint)
- `releaseBot()` — returns a bot to idle state
- `healthCheckBots()` — detects stale bots (no heartbeat), marks as offline
- `getBotPoolStatus()` — returns pool statistics for the admin monitor

### 4.5. Bot Agent (`src/lib/bot/bot-agent.ts`)

Communication layer between Next.js and bot-workers:

- `sendBotCommand()` — writes a command to Firestore for a specific bot to execute
- `writeBotEvent()` — writes an event from the bot to Firestore
- `processUnhandledBotEvents()` — orchestrator polls and routes events
- `handleChatForReadyCheck()` — processes ready/unready commands, updates session state
- `scheduleMatchSync()` — creates a sync task document
- `handleGameEnded(session, event, botAccountId)` — records the winner from `event.radiantWin`, updates `seriesScore` and `completedGameWinners`, pushes the Dota match ID into the match doc, updates team scores; then calls `calculateSeriesResult()`: if decided, finalises the match (sets `winnerId`, `completed`); otherwise calls `scheduleNextGameInSeries()` and posts a series-score chat message

### 4.6. Bot Worker Process (`bot-worker/`)

Separate Node.js process with its own `package.json`:

| File | Purpose |
|------|---------|
| `src/index.ts` | Main entry: loads credentials, connects, starts handlers, graceful shutdown |
| `src/dota-client.ts` | Wraps `steam-user` + `node-dota2`: connect, lobby CRUD, chat, start game |
| `src/command-handler.ts` | Polls Firestore command queue, executes on DotaClient |
| `src/event-emitter.ts` | Bridges DotaClient events → Firestore event documents |
| `src/firebase.ts` | Firebase Admin SDK init (separate named app) |
| `src/logger.ts` | Structured logging with configurable levels |

### 4.7. API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/admin/bot/config` | GET | Get tournament bot config |
| `/api/admin/bot/config` | POST | Save tournament bot config |
| `/api/admin/bot/sessions` | GET | List lobby sessions (filterable by status) |
| `/api/admin/bot/sessions` | POST | Manually create a lobby session |
| `/api/admin/bot/pool-status` | GET | Get bot pool statistics |
| `/api/admin/bot/orchestrate` | POST | Run orchestrator cycle (scheduling, assignment, events, sync) |

### 4.8. Admin UI (`BotTab.tsx`)

Two sub-views:

**Settings View:**
- Bot enable/disable toggle
- Lobby settings (game mode, server region, visibility, pause, DotaTV delay, series type, League ID)
- Ready check configuration (commands, captain-only)
- **Timeout Phases section** (5 inputs): pending timeout, bot-assigned timeout, lobby-open warning, lobby-open timeout, ready-check timeout
- Chat messages (all 6 message types with placeholders)
- Post-match settings (sync delay, auto-sync)

**Monitor View:**
- Bot pool status (total/idle/active/offline/error counts)
- Pending/active session counts
- Active session cards with real-time state, team ready status, validation errors

---

## 5. Firestore Data Model

### Collections

```
/botAccounts/{botId}
├── username: string
├── encryptedPassword: string        (base64 encoded)
├── steamId: string                  (Steam64)
├── steamId32: string                (Steam32 account ID)
├── displayName: string
├── enabled: boolean
├── status: BotAccountStatus
├── currentMatchId: string | null
├── currentTournamentId: string | null
├── lastHeartbeat: string (ISO)
├── notes?: string
├── createdAt: string
└── updatedAt: string

/botCommands/{botId}/queue/{commandId}
├── botAccountId: string
├── command: BotCommand              (typed union)
├── status: 'pending' | 'processing' | 'completed' | 'failed'
├── createdAt: string
├── processedAt?: string
├── result?: object
└── error?: string

/botEvents/{eventId}
├── botAccountId: string
├── event: BotEvent                  (typed union)
├── processed: boolean
├── createdAt: string
└── processedAt?: string

/botLobbySessions/{sessionId}
├── matchId: string
├── tournamentId: string
├── botAccountId: string
├── state: LobbySessionState
├── lobbyName: string
├── lobbyPassword: string
├── dotaLobbyId?: string
├── radiantTeam: LobbyTeamAssignment
├── direTeam: LobbyTeamAssignment
├── readyState: { radiantReady, direReady, readyBy... }
├── validationErrors: string[]
├── currentGameNumber: number
├── totalGames: number
├── completedGameIds: number[]
├── seriesFormat: 'bo1' | 'bo2' | 'bo3' | 'bo5'   ← series type for this session
├── seriesScore: Record<string, number>             ← { [teamId]: wins } cumulative across games
├── completedGameWinners: Array<'radiant' | 'dire'>  ← ordered list of game winners
├── timeoutWarningSentAt?: string (ISO)              ← prevents duplicate lobby-closing warnings
├── createdAt, lobbyCreatedAt, gameStartedAt...
└── error?: { message, code, timestamp }

/botSyncTasks/{taskId}
├── sessionId: string
├── matchId: string
├── tournamentId: string
├── dotaMatchId: number
├── syncAt: string (ISO)
├── status: 'pending' | 'processing' | 'completed' | 'failed'
└── createdAt: string

/tournaments/{tournamentId}/config/bot
└── TournamentBotConfig
    ├── enabled: boolean
    ├── lobbySettings: LobbySettings
    ├── readyCheckConfig: ReadyCheckConfig
    ├── chatConfig: LobbyChatConfig
    ├── postMatchConfig: PostMatchConfig
    │
    └── Timeout phase fields (replaces old lobbyTimeoutMinutes / autoForfeitMinutes):
        ├── pendingSessionTimeoutMinutes: number    (default 20) — cancel if bot never assigned
        ├── botAssignedTimeoutMinutes: number       (default 5)  — cancel if bot_assigned/lobby_creating stalls
        ├── lobbyOpenWarningMinutes: number         (default 15) — send 1× warning at N min after lobbyCreatedAt
        ├── lobbyOpenTimeoutMinutes: number         (default 30) — close lobby at N min after lobbyCreatedAt
        └── readyCheckTimeoutMinutes: number        (default 10) — cancel if both teams readied but game never started
```

### Required Firestore Indexes

```
botLobbySessions: (tournamentId ASC, state ASC, createdAt DESC)
botLobbySessions: (matchId ASC, currentGameNumber ASC, state ASC)
botLobbySessions: (state ASC, createdAt ASC)
botEvents: (processed ASC, createdAt ASC)
botCommands/{id}/queue: (status ASC, createdAt ASC)
botSyncTasks: (status ASC, scheduledAt ASC)
botAccounts: (enabled ASC, status ASC)
```

---

## 6. Admin Panel (Bot Tab)

Accessible at `/{tournament-slug}/admin` → Bot tab.

### Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Bot Enabled | false | Master on/off switch |
| Game Mode | Captain's Mode | Dota 2 game mode |
| Server Region | Europe West | Dota 2 server |
| Visibility | Unlisted | Lobby visibility |
| DotaTV Delay | 120s | Broadcast delay |
| Pause Setting | Limited | Pause rules |
| Series Type | None (0) | 0=none, 1=BO3, 2=BO5 |
| League ID | — | Valve league ID for ticket |
| Lead Time | 10 min | How early to create lobby |
| Allow Spectators | true | — |
| Ready Commands | !ready, !r | Commands to mark team as ready |
| Unready Commands | !unready, !ur | Commands to undo ready |
| Captain Only | false | Only captain can ready |
| **Timeout Phases** | | *Replaces old single Ready Timeout setting* |
| Pending Timeout | 20 min | Cancel session if bot is never assigned |
| Bot Assigned Timeout | 5 min | Cancel if stuck in bot_assigned / lobby_creating |
| Lobby Open Warning | 15 min | Send one-time warning before closing (clocked from lobby creation) |
| Lobby Open Timeout | 30 min | Close lobby if players don’t fill (clocked from lobby creation) |
| Ready Check Timeout | 10 min | Cancel if both teams readied but game never started |
| Sync Delay | 5 min | Wait after game before syncing |
| Auto Sync | true | Auto-trigger match data import |

### Monitor

- **Bot Pool**: Counts of total/idle/active/offline/error bots (platform-wide)
- **Sessions**: Active session cards showing state badge, team ready indicators, validation errors

---

## 7. Deployment & Go-Live Checklist

### What You Need to Do

#### ✅ Steam Accounts (REQUIRED)

You need **at least 1 dedicated Steam account** per concurrent match. For a tournament where up to 4 matches may run simultaneously, you need 4 bot accounts.

**Per bot account, you need:**

1. **Create a new Steam account** at https://store.steampowered.com/join/
   - Use a unique email address (consider `botN@yourdomain.com`)
   - Do NOT use your personal Steam account
   
2. **Install Dota 2** on the account (free to play — just add it to the library)
   - The bot needs to have the Dota 2 license on the account
   - You do NOT need to download/install the game files, just add the game to the account

3. **Disable Steam Guard email verification** or set up **Steam Guard Mobile Authenticator**
   - If using Mobile Authenticator: extract the `shared_secret` (needed for auto-2FA)
   - Tools like [SteamDesktopAuthenticator](https://github.com/Jessecar96/SteamDesktopAuthenticator) can extract the shared_secret
   - Without this, you'll need to manually enter Steam Guard codes on every login

4. **Accept Dota 2's EULA / launch the game at least once** from this account
   - Some GC operations require having launched the game at least once

5. **Do NOT enable limited/community features that require spending $5**
   - The bot doesn't need to trade or use the community market
   - But if Valve restricts GC access for "limited" accounts, you may need to add $5 wallet funds

6. **Account naming**: Give each bot a recognizable display name (e.g., "PD2IH Bot 1")

#### ✅ Register Bot Accounts in Firestore

For each Steam bot account, add a document to `/botAccounts/`:

```json
{
  "username": "pd2ih_bot_1",
  "encryptedPassword": "<base64-encoded-password>",
  "steamId": "76561198XXXXXXXXX",
  "steamId32": "XXXXXXXXX",
  "displayName": "PD2IH Bot 1",
  "enabled": true,
  "status": "idle",
  "currentMatchId": null,
  "currentTournamentId": null,
  "lastHeartbeat": null,
  "notes": "Main bot account",
  "createdAt": "2026-03-07T00:00:00Z",
  "updatedAt": "2026-03-07T00:00:00Z"
}
```

**To encode the password:**
```bash
echo -n "your_steam_password" | base64
```

> ⚠️ **Security note**: In production, use proper encryption (e.g., AES-256) with a server-side key, not just base64. The current implementation uses base64 as a placeholder.

#### ✅ Bot Worker Deployment

The bot-worker is a **long-running Node.js process** — it cannot run as a serverless function. Options:

| Option | Pros | Cons |
|--------|------|------|
| **VPS (DigitalOcean, Hetzner)** | Cheap ($5-10/mo), full control | Manual maintenance |
| **Docker + Cloud Run (always-on)** | Auto-scaling, managed | Higher cost, min instances needed |
| **Railway / Render** | Easy deploy, background workers | Cost per uptime |
| **Your own PC** | Free, easy to debug | Must be on during matches |

**Recommended for start**: Run on a cheap VPS or even your own PC. One bot-worker process per bot account:

```bash
# Terminal 1 — Bot 1
cd bot-worker
BOT_ACCOUNT_ID=abc123 npm start

# Terminal 2 — Bot 2
cd bot-worker
BOT_ACCOUNT_ID=def456 npm start
```

#### ✅ Install Bot Worker Dependencies

```bash
cd bot-worker
npm install
```

#### ✅ Configure Bot Worker Environment

Create `bot-worker/.env`:
```env
FIREBASE_SERVICE_ACCOUNT_BASE64=<same-as-main-app>
BOT_ACCOUNT_ID=<from-firestore>
POLL_INTERVAL_MS=2000
HEARTBEAT_INTERVAL_MS=30000
LOG_LEVEL=info
```

#### ✅ Set Up Orchestrator Cron

The orchestrator needs to run periodically. Options:

**Option A: Vercel Cron (if hosting on Vercel)**
Add to `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/admin/bot/orchestrate",
    "schedule": "*/2 * * * *"
  }]
}
```
Note: Vercel cron requires auth — you'll need to add a cron secret.

**Option B: External cron service**
Use cron-job.org, EasyCron, or similar to POST to `/api/admin/bot/orchestrate` every 2 minutes with an auth token.

**Option C: Self-hosted cron (VPS)**
```bash
# crontab -e
*/2 * * * * curl -X POST https://dota2inhouse.pl/api/admin/bot/orchestrate \
  -H "Authorization: Bearer <service-account-token>"
```

#### ✅ Firestore Security Rules

Add rules for bot collections:
```
match /botAccounts/{botId} {
  allow read: if isAdmin();
  allow write: if isSuperAdmin();
}
match /botCommands/{botId}/queue/{cmdId} {
  allow read, write: if isAdmin();
}
match /botEvents/{eventId} {
  allow read, write: if isAdmin();
}
match /botLobbySessions/{sessionId} {
  allow read: if isAdmin();
  allow write: if isAdmin();
}
match /botSyncTasks/{taskId} {
  allow read, write: if isAdmin();
}
```

#### ✅ Firestore Indexes

Deploy the required composite indexes (see Section 5).

#### ✅ Enable Bot in Admin Panel

1. Go to `/{tournament-slug}/admin` → Bot tab
2. Toggle "Bot Enabled" → ON
3. Configure lobby settings (game mode, server, league ID, etc.)
4. Configure ready check commands
5. Set lead time and sync delay
6. Save configuration

#### ✅ Verify League ID

If using a Valve League ID (e.g., 19206 for PDL):
- The bot's Steam account may need to be a registered admin for that league
- League lobbies create DotaTV-enabled games with ticket support
- Without the league ID, lobbies work but won't appear on the league ticket

### Summary Checklist

- [ ] Create Steam bot account(s) (minimum 1, recommend 2-3)
- [ ] Install Dota 2 on each account, launch once
- [ ] Set up Steam Guard or extract `shared_secret`
- [ ] Register bot accounts in Firestore `/botAccounts/`
- [ ] Install bot-worker dependencies (`npm install` in `bot-worker/`)
- [ ] Create `.env` file for bot-worker
- [ ] Deploy/run bot-worker process(es) — one per bot account
- [ ] Set up orchestrator cron (every 1-5 minutes)
- [ ] Add Firestore security rules for bot collections
- [ ] Deploy Firestore indexes
- [ ] Enable bot in admin panel and configure settings
- [ ] Run the full test suite (see Section 9)
- [ ] Do a dry run with a test match

---

## 8. Steam Account Requirements

### How Many Bot Accounts Do I Need?

| Concurrent Matches | Bot Accounts Needed | Reasoning |
|---|---|---|
| 1 at a time | 1 | One lobby per bot |
| 2 at a time | 2 | PDL: Elite on Thursday + other divisions on Wednesday |
| 4 at a time | 4 | Multiple matchdays or tournament playoffs |
| 8+ at a time | 8+ | Large tournament with many simultaneous matches |

**For PDL Season 1**: You should have **2-3 bot accounts** minimum (matches are scheduled sequentially on matchdays, but having backups is wise).

### Account Age & Restrictions

- **New accounts**: Valve may impose temporary restrictions on very new accounts. Create them a few days before you need them.
- **Limited accounts**: Accounts that haven't spent $5 on Steam are "limited". This hasn't been confirmed to affect GC access, but consider adding $5 as a precaution.
- **Phone number**: Not required unless you need to bypass certain restrictions.
- **VAC bans**: Never use accounts that have VAC bans — they may be restricted.

### Steam Guard Authentication

The bot needs to log in to Steam programmatically. There are three options:

1. **No Steam Guard**: Least secure, may trigger Valve's "new device" login block
2. **Email code**: Manual — you'd need to enter the code each time the bot starts (not practical)
3. **Mobile Authenticator with `shared_secret`**: Best option — auto-generates 2FA codes

**Recommended**: Use Steam Desktop Authenticator to set up and extract the `shared_secret`, then store it in the Firestore bot account document or as an environment variable.

### Costs

- **Steam accounts**: Free to create
- **Dota 2**: Free to play
- **Total direct cost per bot**: $0 (potentially $5 if limited account causes issues)

---

## 9. Testing Program

See [docs/LOBBY_BOT_TESTING.md](./LOBBY_BOT_TESTING.md) for the full test suite.

---

## 10. Security & Abuse Analysis

See [docs/LOBBY_BOT_ABUSE_ANALYSIS.md](./LOBBY_BOT_ABUSE_ANALYSIS.md) for the full analysis of 20 potential abuse scenarios.

---

## 11. Troubleshooting

### Bot won't connect to Steam

- **Check credentials**: Verify username/password in Firestore or `.env`
- **Steam Guard**: Make sure `shared_secret` is correct, or disable Steam Guard temporarily
- **Steam outage**: Check https://steamstat.us — Steam GC may be down
- **Rate limited**: Too many login attempts — wait 30 minutes
- **VPN/firewall**: Ensure the bot's server can reach Steam's servers (TCP/UDP)

### Bot connects but lobby creation fails

- **Dota 2 not launched**: The account must have Dota 2's GC connection. Ensure `gamesPlayed([570])` is called
- **League ID issues**: The bot's account may not be an admin for that league
- **Server region invalid**: Verify the server region ID is correct

### Players don't receive invites

- **Privacy settings**: Players with "Do not allow" friend invites won't receive lobby invites
- **Steam ID wrong**: Verify Steam32 IDs are correct in team registrations
- **Rate limits**: Invites sent too fast — the 500ms delay should prevent this

### Ready check not working

- **Wrong commands**: Verify the configured ready commands match what players type
- **Case sensitivity**: Commands are case-insensitive but must be exact matches
- **Captain only**: If captain-only is enabled, only the captain's `!ready` counts
- **Player not recognized**: The player's Steam ID must be in the expected player list

### Game won't start after validation

- **Team names**: Both teams must set their team name in the lobby (not just player slots)
- **Wrong slots**: Players may be on spectator or wrong side
- **Unauthorized players**: Unknown Steam IDs in team slots trigger warnings

### Post-match sync not happening

- **Sync delay**: Default is 5 minutes — wait for it
- **OpenDota availability**: Match data may not be available on OpenDota yet (wait longer)
- **Orchestrator not running**: Ensure the cron job is actually calling `/api/admin/bot/orchestrate`
- **Sync task stuck**: Check `/botSyncTasks` in Firestore for failed tasks

### Bot marked as stale/offline

- **Process crashed**: Restart the bot-worker process
- **Network issue**: The bot's server may have lost internet connection
- **Heartbeat timeout**: Default is 30 minutes — if the bot misses heartbeats for 30 min, it's marked stale

---

## 12. FAQ

**Q: Can I use my personal Steam account as a bot?**  
A: Technically yes, but strongly discouraged. The bot will be logged in 24/7 and you won't be able to use the same account to play games simultaneously.

**Q: What happens if a bot crashes during a match?**  
A: The lobby stays open in Dota 2. Players can continue playing. The bot will be marked as stale after the heartbeat threshold, and the session will transition to `error`. An admin will need to manually handle the post-match sync.

**Q: Can the bot handle multiple games in a BO3/BO5 series?**  
A: Yes. Each game in a series creates a new `LobbySession`. When a game ends, `handleGameEnded()` calls `calculateSeriesResult()` and either finalises the match (winner decided) or calls `scheduleNextGameInSeries()` to create the next game's session automatically. The series score is tracked across sessions via `seriesScore` and `completedGameWinners`. BO2 supports draws (1-1).

**Q: What happens if a standin is approved after the lobby bot already created the session?**  
A: `syncLobbySessionStandins()` is called automatically whenever a standin is approved (both captain approvals and admin appeals). It hot-patches all active pre-game sessions for that match with the updated roster, so the bot will accept the standin in the next validation cycle without needing to re-create the session.

**Q: How does the lobby-closing timeout work?**  
A: There are four independent timeout phases:
1. **Pending stuck** — session never gets a bot assigned (default: cancel after 20 min)
2. **Bot stuck** — bot was assigned but lobby was never created (default: cancel after 5 min)
3. **Lobby open** — two-phase: send one warning at 15 min after lobby creation, then close at 30 min
4. **Ready-check stuck** — both teams readied but game never launched (default: cancel after 10 min)

All thresholds are configurable per tournament in the Admin Bot tab.

**Q: What happens if all bots are busy?**  
A: The session stays in `pending` state until a bot becomes available. The admin monitor shows how many sessions are pending. Consider adding more bot accounts.

**Q: Can players abuse the `!ready` command?**  
A: Only players in the expected roster can trigger ready. Non-team players' messages are ignored. Enable `captainOnly` for stricter control.

**Q: Does the bot need the Dota 2 game installed on the server?**  
A: No. The bot communicates via the Steam network protocol (GC), not by running the actual game. It only needs the `node-dota2` npm package.

**Q: How much bandwidth/resource does a bot use?**  
A: Very low. The Steam connection and Firestore polling use minimal CPU/RAM. A $5/mo VPS can easily run 5+ bot instances.

**Q: Can I run the bot on Windows?**  
A: Yes. The bot-worker is a standard Node.js process and runs on any OS.
