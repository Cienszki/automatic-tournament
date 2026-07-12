"use strict";
// bot-worker/dist/runner.js
// Lobby Runner — one ephemeral process owns ONE match/series end-to-end, in real time.
//
// This is the heart of the meepow-style rebuild (see bot-worker/REBUILD_PLAN.md).
// The old design streamed every lobby event into a central Firestore queue that a
// cron-polled orchestrator processed; that queue clogged and added latency. Here the
// runner instead consumes node-dota2 events IN-PROCESS and acts on them immediately —
// no botEvents queue, no botCommands queue. It only reads config/rosters from Firestore
// and writes status back as fields on its own session doc.
//
// Spawned by the Conductor:
//   node dist/runner.js --session-id=<id> --bot-id=<id>
//
// Lifecycle (per game, looped for a series):
//   reattach-or-create lobby → invite roster → ready-check → (coin toss) → in_game
//     → post_game → [next game ↺ | finalize → done]
// with side branches late_vote (forfeit/wait) and cancelled (no-show / admin / timeout).
//
// Crash recovery: if this process dies mid-match, the Conductor respawns it with the
// same session+account; on login node-dota2 repopulates its lobby cache from the GC
// ClientWelcome, so we REATTACH to the live lobby instead of creating a new one. Every
// handler re-derives from the current session state, so resuming is safe.

const dotenv = require('dotenv');
dotenv.config();
const { initFirebase } = require('./firebase.js');
const { DotaClient } = require('./dota-client.js');
const { logger } = require('./logger.js');
const L = require('./runner-logic.js');
const { buildExpectedPlayersForGame, buildStandinAssignments } = require('./scheduling.js');

// CSODOTALobby.State enum: UI=0, SERVERSETUP=1, RUN=2, POSTGAME=3, READYUP=4, NOTREADY=5, SERVERASSIGN=6
const LOBBY_STATE = { UI: 0, SERVERSETUP: 1, RUN: 2, POSTGAME: 3, READYUP: 4, NOTREADY: 5, SERVERASSIGN: 6 };
// EMatchOutcome: RAD_VICTORY=2, DIRE_VICTORY=3
const OUTCOME = { RAD_VICTORY: 2, DIRE_VICTORY: 3 };

const TERMINAL_STATES = ['completed', 'cancelled', 'error'];
const HEARTBEAT_MS = 30000;
const LATE_TICK_MS = 15000;
const TIMEOUT_TICK_MS = 30000;
// Fallback game-end detector: while in_game, poll OpenDota for the started match id in case
// the POSTGAME lobby event is lost (transient GC disconnect at game end, or a POSTGAME that
// arrives with match_outcome still 0 before the lobby is destroyed). OpenDota only ingests
// FINISHED matches, so a live game returns 404 and can never false-trigger. 2min keeps the
// request volume low over a 30-60min game while still recovering the series promptly.
const RESULT_POLL_MS = 120000;
// How long to wait after login for the GC to deliver a cached lobby SObject before
// deciding "no lobby in cache → create a fresh one".
const REATTACH_SETTLE_MS = 5000;
// If Steam/GC drops and doesn't recover within this window, exit so the Conductor respawns.
const DISCONNECT_GRACE_MS = 60000;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function now() { return Date.now(); }
function nowIso() { return new Date().toISOString(); }

class Runner {
    constructor(db, sessionId, botAccountId) {
        this.db = db;
        this.sessionId = sessionId;
        this.botAccountId = botAccountId;
        this.sessionRef = db.collection('botLobbySessions').doc(sessionId);
        this.session = null;       // in-memory mirror of the session doc (source of truth = Firestore, but we own lifecycle writes)
        this.botConfig = null;     // tournaments/{id}/config/bot
        this.dota = null;
        this.timers = {};          // named interval/timeout handles
        this.finalizing = false;   // guard against re-entrant finalize/cancel
        this.gameEndHandledFor = null; // dotaMatchId we already processed game-end for (de-dupe POSTGAME spam)
        this.gameEndHandled = false;   // boolean latch — once set, block any further game-end until next lobby
        this.waitingForMatchId = false; // true while the 30-s matchId poll is running
        this.gameStarted = false;  // current-game in_game latch (reset each game)
        this.postgameNoOutcomeLogged = false; // one warn per game when POSTGAME arrives w/ outcome still 0
        this.lastPlayersJson = ''; // de-dupe lastLobbyPlayers field writes
        this.disconnectTimer = null;
        this.sessionUnsub = null;
        this.matchUnsub = null;    // onSnapshot of the match doc (approvedStandins = source of truth)
        this.configUnsub = null;   // onSnapshot of config/bot (whitelist/enforcement/messages live)
        this.welcomedPlayers = new Set(); // steamId32s already greeted (one welcome per player per lobby)
        this.kickedPlayers = new Set();   // steamId32s already kicked this lobby (prevent duplicate kicks + messages)
    }

    // ─── Boot ────────────────────────────────────────────────────────────────
    async run() {
        const snap = await this.sessionRef.get();
        if (!snap.exists) { logger.error(`[Runner] Session ${this.sessionId} not found — exiting`); return 0; }
        this.session = { id: snap.id, ...snap.data() };
        if (TERMINAL_STATES.includes(this.session.state)) {
            logger.info(`[Runner] Session ${this.sessionId} already ${this.session.state} — nothing to do`);
            return 0;
        }

        const botSnap = await this.db.collection('botAccounts').doc(this.botAccountId).get();
        if (!botSnap.exists) { logger.error(`[Runner] Bot account ${this.botAccountId} not found`); return 1; }
        const bot = botSnap.data();
        this.botDocSteamId32 = bot.steamId32 || null; // confirmed precisely after login (getSelfSteamId32)

        this.botConfig = await this.loadBotConfig(this.session.tournamentId);
        if (!this.botConfig) { logger.error(`[Runner] No bot config for tournament ${this.session.tournamentId}`); return 1; }
        this.watchBotConfigDoc(); // keep whitelist/enforcement/messages live after the lobby exists

        // Steam creds: env overrides (local dev) else the account doc (encryptedPassword is base64).
        const username = process.env.STEAM_USERNAME || bot.username;
        const password = process.env.STEAM_PASSWORD ||
            (bot.encryptedPassword ? Buffer.from(bot.encryptedPassword, 'base64').toString('utf-8') : undefined);
        const sharedSecret = process.env.STEAM_GUARD_SHARED_SECRET || bot.steamGuardSharedSecret;

        logger.info(`[Runner] session=${this.sessionId} match=${this.session.matchId} game=${this.session.currentGameNumber} bot=${bot.displayName || username}`);

        this.dota = new DotaClient({ username, password, steamGuardSharedSecret: sharedSecret });
        this.wireDotaEvents();

        await this.updateBotStatus('connecting');
        await this.dota.connect();
        // The host bot sits in the lobby's player pool; record its own Steam32 so enforcement
        // never tries to kick it (the GC ignores kicking the host, but it spams chat otherwise).
        this.botSteamId32 = this.dota.getSelfSteamId32() || this.botDocSteamId32 || null;
        logger.info(`[Runner] Connected to Steam + Dota 2 GC (self=${this.botSteamId32 || 'unknown'})`);

        this.startHeartbeat();
        this.watchSessionDoc();
        this.watchMatchDoc();

        // Reattach (after a crash) or create a fresh lobby.
        await this.reattachOrCreate();

        // reattachOrCreate may finalize synchronously (e.g. the match was already complete on
        // restart → finishUp releases the bot). In that case donePromiseResolve was never wired
        // up yet, so we must return NOW — otherwise we'd arm the timers below and await a promise
        // that never resolves, hanging the process forever (the Conductor never sees the child
        // exit, so the bot stays pinned in its in-memory busy set → "no available bot accounts").
        if (this.finalizing) return this.exitCode ?? 0;

        // Periodic timers that re-derive from session timestamps (safe across restarts).
        this.timers.timeout = setInterval(() => this.checkTimeouts().catch((e) => logger.error('[Runner] timeout check', e)), TIMEOUT_TICK_MS);
        this.timers.late = setInterval(() => this.tickLateArrival().catch((e) => logger.error('[Runner] late tick', e)), LATE_TICK_MS);
        // Fallback game-end poll (self-gates to in_game). Re-armed on every boot, so it also
        // recovers a session that reattached into in_game after a restart and would otherwise
        // wait forever for a POSTGAME that won't re-arrive.
        this.timers.resultPoll = setInterval(() => this.pollExternalGameResult().catch((e) => logger.error('[Runner] result poll', e)), RESULT_POLL_MS);

        // Resolve when the session finishes (finalize / cancel sets this.donePromiseResolve).
        await new Promise((resolve) => { this.donePromiseResolve = resolve; });
        return this.exitCode ?? 0;
    }

    async loadBotConfig(tournamentId) {
        const doc = await this.db.collection('tournaments').doc(tournamentId).collection('config').doc('bot').get();
        return doc.exists ? doc.data() : null;
    }

    /**
     * Keep the bot config live so admin edits after the lobby is created take effect immediately —
     * most importantly the whitelist (a player whitelisted mid-lobby must stop being kicked), plus
     * enforcement toggles and chat messages, all of which are read fresh on each use. Lobby-create
     * settings are only consumed at creation, so a later change to those simply applies next lobby.
     */
    watchBotConfigDoc() {
        if (!this.session?.tournamentId) return;
        const ref = this.db.collection('tournaments').doc(this.session.tournamentId).collection('config').doc('bot');
        this.configUnsub = ref.onSnapshot((snap) => {
            if (!snap.exists || this.finalizing) return;
            this.botConfig = snap.data();
        }, (err) => logger.error('[Runner] config watch error', err));
    }

    // ─── Session doc helpers ───────────────────────────────────────────────────
    /** Merge fields into the in-memory session and persist them to Firestore. */
    async updateSession(fields) {
        Object.assign(this.session, fields);
        try { await this.sessionRef.update({ ...fields, updatedAt: nowIso() }); }
        catch (e) { logger.error('[Runner] Failed to update session', e); }
    }

    async updateBotStatus(status) {
        try {
            await this.db.collection('botAccounts').doc(this.botAccountId).update({
                status, currentSessionId: this.sessionId,
                lastHeartbeat: nowIso(), updatedAt: nowIso(),
            });
        } catch { /* non-fatal */ }
    }

    startHeartbeat() {
        const beat = async () => {
            try {
                await this.db.collection('botAccounts').doc(this.botAccountId).update({
                    lastHeartbeat: nowIso(), connected: !!(this.dota && this.dota.isConnected),
                });
                await this.sessionRef.update({ lastHeartbeat: nowIso() });
            } catch { /* non-fatal */ }
        };
        this.timers.heartbeat = setInterval(beat, HEARTBEAT_MS);
        beat();
    }

    /**
     * Watch our own session doc for EXTERNAL changes (admin cancel, standin sync).
     * The runner owns lifecycle writes, so we react only to:
     *  - state flipped to a terminal state elsewhere → leave + exit.
     *  - radiantTeam/direTeam roster changes (standin approved/revoked) → invite added,
     *    kick removed, update our in-memory allow-list.
     */
    watchSessionDoc() {
        this.sessionUnsub = this.sessionRef.onSnapshot((snap) => {
            if (!snap.exists) return;
            const next = { id: snap.id, ...snap.data() };
            // External cancellation.
            if (TERMINAL_STATES.includes(next.state) && !this.finalizing) {
                logger.warn(`[Runner] Session externally moved to ${next.state} — leaving`);
                this.finishUp(next.state === 'error' ? 1 : 0, next.state, /*alreadyPersisted*/ true);
                return;
            }
            // Roster (standin) sync while the lobby is still accepting players.
            this.reconcileRoster(next).catch((e) => logger.error('[Runner] roster reconcile', e));
            // Adopt any externally-updated roster names but never clobber our lifecycle fields.
            this.session.radiantTeam = next.radiantTeam;
            this.session.direTeam = next.direTeam;
            // Adopt the per-game roster source too, so a standin approved mid-series for a
            // LATER game is applied when that game's lobby is created (recompute reads these).
            if (next.baseRadiantPlayers) this.session.baseRadiantPlayers = next.baseRadiantPlayers;
            if (next.baseDirePlayers) this.session.baseDirePlayers = next.baseDirePlayers;
            if (next.standinAssignments) this.session.standinAssignments = next.standinAssignments;
        }, (err) => logger.error('[Runner] session watch error', err));
    }

    async reconcileRoster(next) {
        const acceptingPlayers = ['lobby_open', 'ready_check'].includes(this.session.state);
        const oldIds = new Set([
            ...this.session.radiantTeam.expectedPlayers.map((p) => p.steamId32),
            ...this.session.direTeam.expectedPlayers.map((p) => p.steamId32),
        ]);
        const newIds = new Set([
            ...next.radiantTeam.expectedPlayers.map((p) => p.steamId32),
            ...next.direTeam.expectedPlayers.map((p) => p.steamId32),
        ]);
        const added = [...newIds].filter((id) => !oldIds.has(id) && id && id !== '0');
        const removed = [...oldIds].filter((id) => !newIds.has(id) && id && id !== '0');

        // Always clear kickedPlayers for newly-added players regardless of GC connectivity.
        // A standin approved while the bot is briefly disconnected must NOT be re-kicked when
        // they rejoin — enforce() checks kickedPlayers BEFORE the authorized-list check.
        for (const id of added) this.kickedPlayers.delete(id);

        if (!acceptingPlayers || !this.dota?.isConnected) return;

        for (const id of added) {
            try { await this.dota.invitePlayer(id); } catch (e) { logger.warn('[Runner] reinvite failed', e); }
        }
        for (const id of removed) { try { await this.dota.kickPlayer(id); } catch (e) { logger.warn('[Runner] kick-removed failed', e); } }
        if (added.length || removed.length) {
            logger.info(`[Runner] Roster synced: +[${added.join(',')}] -[${removed.join(',')}]`);
        }
    }

    /**
     * Watch the MATCH doc so the lobby roster is always derived from the authoritative
     * source — match.approvedStandins — rather than depending on the web app's
     * syncLobbySessionStandins push (which can race or fail when several standins are
     * approved mid-lobby). This guarantees enforcement (who may stay) and the ready/seated
     * check (who must be seated) share ONE source of truth: the approved standins for the
     * CURRENT game.
     */
    watchMatchDoc() {
        if (!this.session?.tournamentId || !this.session?.matchId) return;
        const ref = this.db.collection('tournaments').doc(this.session.tournamentId)
            .collection('matches').doc(this.session.matchId);
        this.matchUnsub = ref.onSnapshot((snap) => {
            if (!snap.exists || this.finalizing) return;
            this.recomputeRosterFromMatch(snap.data()).catch((e) => logger.error('[Runner] match recompute', e));
        }, (err) => logger.error('[Runner] match watch error', err));
    }

    /**
     * Recompute the effective per-game roster from the match's approvedStandins and apply it
     * to the live lobby (invite newly-authorized standins, kick those no longer authorized).
     * No-op on legacy sessions that predate the per-game roster source.
     */
    async recomputeRosterFromMatch(match) {
        const baseR = this.session.baseRadiantPlayers, baseD = this.session.baseDirePlayers;
        if (!Array.isArray(baseR) || !Array.isArray(baseD)) return; // can't recompute without base rosters
        const gameNum = this.session.currentGameNumber || 1;
        const standinAssignments = buildStandinAssignments(match);
        const radiantExpected = buildExpectedPlayersForGame(baseR, standinAssignments, this.session.radiantTeam.teamId, gameNum);
        const direExpected = buildExpectedPlayersForGame(baseD, standinAssignments, this.session.direTeam.teamId, gameNum);

        const oldIds = new Set([
            ...this.session.radiantTeam.expectedPlayers.map((p) => p.steamId32),
            ...this.session.direTeam.expectedPlayers.map((p) => p.steamId32),
        ]);
        const newIds = new Set([...radiantExpected, ...direExpected].map((p) => p.steamId32));
        const rosterChanged = oldIds.size !== newIds.size || [...newIds].some((id) => !oldIds.has(id));
        const assignmentsChanged = JSON.stringify(this.session.standinAssignments || []) !== JSON.stringify(standinAssignments);
        if (!rosterChanged && !assignmentsChanged) return; // nothing to do (match changed for another reason)

        const added = [...newIds].filter((id) => !oldIds.has(id) && id && id !== '0');
        const removed = [...oldIds].filter((id) => !newIds.has(id) && id && id !== '0');

        const radiantTeam = { ...this.session.radiantTeam, expectedPlayers: radiantExpected };
        const direTeam = { ...this.session.direTeam, expectedPlayers: direExpected };
        this.session.radiantTeam = radiantTeam;
        this.session.direTeam = direTeam;
        this.session.standinAssignments = standinAssignments;
        for (const id of added) this.kickedPlayers.delete(id); // a re-authorized player must not stay kicked

        // Persist so the website + any restart see the corrected roster. (The session-doc
        // watcher will see this same state and no-op.)
        await this.updateSession({ radiantTeam, direTeam, standinAssignments });

        const acceptingPlayers = ['lobby_open', 'ready_check'].includes(this.session.state);
        if (acceptingPlayers && this.dota?.isConnected) {
            for (const id of added) { try { await this.dota.invitePlayer(id); } catch (e) { logger.warn('[Runner] match-recompute invite failed', e); } }
            for (const id of removed) { try { await this.dota.kickPlayer(id); } catch (e) { logger.warn('[Runner] match-recompute kick failed', e); } }
        }
        if (added.length || removed.length) {
            logger.info(`[Runner] Roster recomputed from match.approvedStandins: +[${added.join(',')}] -[${removed.join(',')}] (game ${gameNum})`);
        }
    }

    // ─── Lobby create / reattach ────────────────────────────────────────────────
    async reattachOrCreate() {
        // Give the GC a moment to deliver a cached lobby SObject (set on ClientWelcome).
        await sleep(REATTACH_SETTLE_MS);

        // Resuming an in_game/post_game session whose match already finished (e.g. the runner
        // was restarted by a redeploy/crash at or after game end): there is nothing left to run.
        // Release the bot instead of reattaching-and-waiting-forever, and don't fall through to
        // the recreate path (which would reopen a lobby for a completed match).
        if ((this.session.state === 'in_game' || this.session.state === 'post_game') && await this.matchAlreadyComplete()) {
            logger.warn(`[Runner] Resuming '${this.session.state}' session but match ${this.session.matchId} is already complete — finalizing to release bot ${this.botAccountId}`);
            await this.finishUp(0, 'completed');
            return;
        }

        const ourLobby = this.session.dotaLobbyId; // set only once WE created a lobby for this session

        if (this.dota.hasLobby()) {
            if (ourLobby) {
                // Mid-series / post-crash resume — adopt our live lobby and keep going.
                const id = this.dota.reattachToCachedLobby();
                logger.info(`[Runner] Reattached to existing lobby ${id} (session state=${this.session.state})`);
                // Restore the in-game latch so a POSTGAME event arriving right after reconnect
                // (when the game ended while the bot was restarting) triggers handleGameEnded
                // instead of being silently ignored by the gameStarted === false guard.
                if (this.session.state === 'in_game') {
                    this.gameStarted = true;
                    logger.info('[Runner] Restored gameStarted=true for in_game session resume');
                }
                await this.updateBotStatus(this.session.state === 'in_game' ? 'in_game' : 'lobby_active');
                return;
            }
            // Fresh session, but a STALE lobby (from a previous session/crash) is cached on
            // this account. If it's an IN-GAME lobby (e.g. a session cancelled mid-game), the
            // bot can't create a new lobby over it — retrying just crash-loops (the create
            // times out). Route around it: cooldown this bot and bounce the session back to
            // the pool for a clean bot. A non-game stale lobby we can simply leave + recreate.
            const staleId = this.dota.getCurrentLobbyId();
            const cachedState = this.dota.getCurrentLobbyState();
            const inGame = cachedState === LOBBY_STATE.SERVERSETUP || cachedState === LOBBY_STATE.RUN
                || cachedState === LOBBY_STATE.POSTGAME || cachedState === LOBBY_STATE.SERVERASSIGN;
            if (inGame) {
                logger.warn(`[Runner] Bot stuck in a prior in-game lobby ${staleId} (state ${cachedState}) — bouncing session to a clean bot`);
                await this.bounceToCleanBot(`bot stuck in a prior game (lobby ${staleId})`);
                return;
            }
            logger.warn(`[Runner] Leaving stale cached lobby ${staleId} before creating a fresh one`);
            try { await this.dota.leaveLobby(); } catch (e) { logger.warn('[Runner] leave stale lobby failed', e); }
        } else if (ourLobby) {
            logger.warn(`[Runner] Session expected lobby ${ourLobby} but GC cache is empty — recreating for game ${this.session.currentGameNumber}`);
        }
        await this.createLobbyForCurrentGame();
    }

    /**
     * Recompute radiantTeam/direTeam.expectedPlayers for the CURRENT game from the per-game
     * roster source (baseRadiantPlayers/baseDirePlayers + standinAssignments), so a standin
     * limited to specific games only appears in those games. No-op on legacy sessions that
     * predate the per-game fields (keeps using whatever expectedPlayers they already have).
     */
    async recomputeEffectiveRosterForCurrentGame() {
        const { baseRadiantPlayers, baseDirePlayers, standinAssignments } = this.session;
        if (!Array.isArray(baseRadiantPlayers) || !Array.isArray(baseDirePlayers)) return;
        const gameNum = this.session.currentGameNumber || 1;
        const radiantExpected = buildExpectedPlayersForGame(baseRadiantPlayers, standinAssignments, this.session.radiantTeam.teamId, gameNum);
        const direExpected = buildExpectedPlayersForGame(baseDirePlayers, standinAssignments, this.session.direTeam.teamId, gameNum);
        const radiantTeam = { ...this.session.radiantTeam, expectedPlayers: radiantExpected };
        const direTeam = { ...this.session.direTeam, expectedPlayers: direExpected };
        this.session.radiantTeam = radiantTeam;
        this.session.direTeam = direTeam;
        await this.updateSession({ radiantTeam, direTeam });
        logger.info(`[Runner] Effective roster for game ${gameNum}: radiant=${radiantExpected.map((p) => p.steamId32).join(',')} dire=${direExpected.map((p) => p.steamId32).join(',')}`);
    }

    async createLobbyForCurrentGame() {
        const gameNum = this.session.currentGameNumber || 1;
        const baseName = (this.session.lobbyName || 'Match').replace(/ - Game \d+$/, '');
        const lobbyName = gameNum > 1 ? `${baseName} - Game ${gameNum}` : baseName;
        const settings = L.toLobbyCreateSettings(this.botConfig.lobby, this.session);

        // Pick the right players for THIS game before inviting / enforcing.
        await this.recomputeEffectiveRosterForCurrentGame();

        await this.updateSession({ state: 'lobby_creating' });
        await this.updateBotStatus('creating_lobby');

        await this.dota.createLobby({
            name: lobbyName,
            password: this.session.lobbyPassword,
            ...settings,
        });
        const dotaLobbyId = this.dota.getCurrentLobbyId() || 'pending';
        logger.info(`[Runner] Lobby created (${dotaLobbyId}) "${lobbyName}"`);

        this.gameStarted = false;
        this.gameEndHandledFor = null;
        this.gameEndHandled = false;
        this.waitingForMatchId = false;
        this.postgameNoOutcomeLogged = false;
        this.welcomedPlayers.clear(); // greet players freshly in each game's lobby
        this.kickedPlayers.clear();   // reset per-lobby kick memory
        await this.updateSession({
            state: 'lobby_open',
            dotaLobbyId,
            lobbyName,
            lobbyCreatedAt: nowIso(),
            startGameSentAt: null,
            readyCheckStartedAt: null,
            timeoutWarningSentAt: null,
            timeoutHeldNotified: null,
            currentGameDotaMatchId: null, // clear the previous game's id before this game starts
            readyState: { radiantReady: false, direReady: false },
        });
        await this.updateBotStatus('lobby_active');
        await this.inviteRosterAndWelcome();
    }

    /** Invite ONLY the registered roster (+coaches; NOT the whitelist) and post instructions. */
    async inviteRosterAndWelcome() {
        const ids = new Set();
        for (const p of this.session.radiantTeam.expectedPlayers) ids.add(p.steamId32);
        for (const p of this.session.direTeam.expectedPlayers) ids.add(p.steamId32);
        if (this.session.radiantTeam.coachSteamId32) ids.add(this.session.radiantTeam.coachSteamId32);
        if (this.session.direTeam.coachSteamId32) ids.add(this.session.direTeam.coachSteamId32);
        const list = [...ids].filter((id) => id && id !== '0');
        if (list.length) {
            try { await this.dota.invitePlayers(list); }
            catch (e) { logger.warn('[Runner] invite roster failed', e); }
        }
        const readyCmd = this.botConfig.readyCheck?.readyCommands?.[0] ?? '!ready';
        await this.sendChat(`[BOT] ${this.session.lobbyName} — invites sent. Take your team's slots, then type ${readyCmd} once your whole team is seated.`);
    }

    async sendChat(message) {
        try { await this.dota.sendChatMessage(message); }
        catch (e) { logger.warn('[Runner] sendChat failed', e); }
    }

    // ─── DotaClient event wiring ─────────────────────────────────────────────────
    wireDotaEvents() {
        this.dota.on('lobbyUpdate', (data) => this.onLobbyUpdate(data).catch((e) => logger.error('[Runner] lobbyUpdate', e)));
        this.dota.on('chatMessage', (msg) => this.onChatMessage(msg).catch((e) => logger.error('[Runner] chatMessage', e)));
        this.dota.on('lobbyCleared', () => logger.info('[Runner] Lobby cleared/destroyed'));
        this.dota.on('disconnected', () => this.onDisconnected());
    }

    onDisconnected() {
        if (this.finalizing) return;
        logger.warn('[Runner] Disconnected from Steam/Dota — waiting for reconnect');
        if (this.disconnectTimer) return;
        this.disconnectTimer = setTimeout(() => {
            if (!(this.dota && this.dota.isConnected) && !this.finalizing) {
                logger.error('[Runner] Reconnect grace expired — exiting for Conductor respawn');
                this.finishUp(1, this.session.state, true);
            }
        }, DISCONNECT_GRACE_MS);
        // Clear the timer if we recover.
        const checkRecover = setInterval(() => {
            if (this.dota && this.dota.isConnected) {
                clearInterval(checkRecover);
                if (this.disconnectTimer) { clearTimeout(this.disconnectTimer); this.disconnectTimer = null; }
                logger.info('[Runner] Reconnected');
            }
        }, 3000);
    }

    async onLobbyUpdate(data) {
        if (this.finalizing) return;
        // DotaClient emits players with `.team`; the rest of the runner/logic speaks
        // `.teamSide` (the orchestrator's LobbySlotInfo shape). Normalize once here.
        const players = (data.players || []).map((p) => ({ steamId32: p.steamId32, slotIndex: p.slot, teamSide: p.team, name: p.name || null }));

        // Persist occupancy as a FIELD (state, not a stream) — de-duped to avoid churn.
        const playersForDoc = players.map((p) => ({ steamId32: p.steamId32, teamSide: p.teamSide }));
        const json = JSON.stringify(playersForDoc);
        if (json !== this.lastPlayersJson) {
            this.lastPlayersJson = json;
            await this.updateSession({ lastLobbyPlayers: playersForDoc });
        }

        // Enforcement + per-join welcome while the lobby is open / in ready-check.
        if (['lobby_open', 'ready_check'].includes(this.session.state)) {
            await this.welcomeJoinedPlayers(players);
            await this.enforce(players);
        }

        // Game start: lobby entered server setup / run.
        const state = data.state;
        const inProgress = state === LOBBY_STATE.SERVERSETUP || state === LOBBY_STATE.RUN || state === LOBBY_STATE.SERVERASSIGN;
        if (!this.gameStarted && inProgress) {
            this.gameStarted = true;
            const dotaMatchId = Number(data.matchId) || 0;
            // Capture which session-team is on which Dota side NOW (post coin toss), so the
            // game outcome maps to the right team even when they swapped sides.
            const currentGameSides = this.captureGameSides(players);
            // Persist the started match id (may be 0 here; the lobby fills it in shortly, and
            // the result poll re-reads it live). This is what lets the OpenDota fallback and any
            // post-restart recovery find the game to check for its result.
            await this.updateSession({ state: 'in_game', gameStartedAt: nowIso(), currentGameSides, currentGameDotaMatchId: dotaMatchId || null });
            await this.updateBotStatus('in_game');
            this.clearTimer('readyTimeout');
            logger.info(`[Runner] Game ${this.session.currentGameNumber} started (dotaMatchId=${dotaMatchId}) sides=${JSON.stringify(currentGameSides)}`);
        }

        // Once in-game, backfill the match id as soon as the lobby carries a real one (it is
        // frequently 0 in the first in-progress update). The result poll needs it.
        if (this.gameStarted && this.session.state === 'in_game' && !this.session.currentGameDotaMatchId) {
            const liveMatchId = Number(data.matchId) || 0;
            if (liveMatchId > 0) await this.updateSession({ currentGameDotaMatchId: liveMatchId });
        }

        // Diagnostic: a POSTGAME that arrives with a non-decisive outcome is the classic way the
        // event-based game-end is lost (the lobby can be destroyed before a decisive update). Log
        // it once so the miss is visible in the runner logs; the OpenDota poll is the recovery.
        if (this.gameStarted && state === LOBBY_STATE.POSTGAME
            && data.matchOutcome !== OUTCOME.RAD_VICTORY && data.matchOutcome !== OUTCOME.DIRE_VICTORY
            && !this.postgameNoOutcomeLogged) {
            this.postgameNoOutcomeLogged = true;
            logger.warn(`[Runner] POSTGAME with non-decisive outcome=${data.matchOutcome} (matchId=${Number(data.matchId) || 0}) — awaiting a decisive update or the OpenDota fallback`);
        }

        // Game end: POSTGAME with a decisive outcome.
        // Three-layer dedup — any one layer alone is defeatable; together they're airtight:
        //  1. gameStarted: only true while a game is live; reset in createLobbyForCurrentGame.
        //     Blocks stale POSTGAME events from game N arriving after game N+1's lobby is created
        //     (when gameEndHandled and gameEndHandledFor have both been reset to their start values).
        //  2. dotaMatchId > 0: the first POSTGAME update sometimes arrives before the GC writes
        //     the match ID — wait up to 30 s for a real ID before giving up (avoids losing the
        //     game-end entirely when the lobby closes before the ID arrives).
        //  3. gameEndHandled boolean latch: set at the very top of handleGameEnded so any further
        //     POSTGAME event for the same game is ignored even if the matchId changes between events.
        if (this.gameStarted && state === LOBBY_STATE.POSTGAME && (data.matchOutcome === OUTCOME.RAD_VICTORY || data.matchOutcome === OUTCOME.DIRE_VICTORY)) {
            const dotaMatchId = Number(data.matchId) || 0;
            const radiantWin = data.matchOutcome === OUTCOME.RAD_VICTORY;
            if (dotaMatchId === 0 && !this.gameEndHandled && !this.waitingForMatchId) {
                // GC hasn't written the match ID yet. Poll for up to 30 s so we don't lose the
                // game-end if the lobby closes before a real ID arrives.
                this.waitingForMatchId = true;
                logger.info('[Runner] POSTGAME received but matchId=0 — polling for match ID (up to 30s)');
                (async () => {
                    for (let i = 0; i < 30 && !this.gameEndHandled; i++) {
                        await sleep(1000);
                        const lobbyData = this.dota.getCurrentLobbyData?.();
                        const id = lobbyData ? (Number(lobbyData.matchId) || 0) : 0;
                        if (id > 0 && !this.gameEndHandled && this.gameEndHandledFor !== id) {
                            this.gameEndHandledFor = id;
                            this.waitingForMatchId = false;
                            await this.handleGameEnded(id, radiantWin);
                            return;
                        }
                    }
                    this.waitingForMatchId = false;
                    logger.warn('[Runner] Could not obtain matchId after 30 s — game end may be lost');
                })().catch((e) => { this.waitingForMatchId = false; logger.error('[Runner] matchId poll error', e); });
            }
            if (dotaMatchId > 0 && !this.gameEndHandled && this.gameEndHandledFor !== dotaMatchId) {
                this.waitingForMatchId = false;
                this.gameEndHandledFor = dotaMatchId;
                await this.handleGameEnded(dotaMatchId, data.matchOutcome === OUTCOME.RAD_VICTORY);
            }
        }
    }

    /**
     * Best human-readable name for a player, for chat messages: the GC lobby member name if
     * present, else the roster nickname, else a live Steam persona lookup (the GC name is
     * frequently empty right after a join), else the Steam32 id as a last resort.
     */
    async displayNameFor(steamId32, lobbyName) {
        if (lobbyName && String(lobbyName).trim()) return String(lobbyName).trim();
        // getPlayerNickname returns the steamId32 itself when the player is NOT on either
        // roster — which is exactly the unregistered-player case we want to resolve via Steam.
        // So only treat it as a real name when it differs from the id.
        const roster = L.getPlayerNickname(this.session, steamId32);
        if (roster && roster !== steamId32) return roster;
        try {
            const persona = await this.dota.getPersonaName(steamId32);
            if (persona) return persona;
        } catch { /* fall through to id */ }
        return `Steam32:${steamId32}`;
    }

    async enforce(players) {
        // Forget anyone who has actually LEFT the lobby, so a kicked player who REJOINS is kicked
        // again. The kickedPlayers guard exists only to de-dupe the continuous stream of
        // lobbyUpdate events while the SAME player is still present (kick + GC removal are async);
        // it must NOT permanently whitelist a rejoiner. Pruning on absence re-arms enforcement.
        const present = new Set(players.map((p) => p.steamId32));
        for (const id of this.kickedPlayers) if (!present.has(id)) this.kickedPlayers.delete(id);

        // Authorize the bot's own account (it sits in the player pool) so we never kick/flag it.
        const whitelist = [...(this.botConfig.whitelist ?? [])];
        if (this.botSteamId32) whitelist.push({ steamId32: this.botSteamId32 });
        const cfg = this.botConfig.enforcement ?? { autoKickUnauthorized: true, autoKickWrongSlot: false, wrongSlotGracePeriodSeconds: 30 };
        const action = L.evaluateEnforcement(this.session, players, cfg, whitelist);
        for (const kick of action.kickPlayers) {
            if (kick.reason !== 'not_registered') continue;
            // One kick+message per player per lobby. Without this guard, every lobbyUpdate
            // event (fired continuously while the player is still being processed by the GC)
            // produces a duplicate message and a duplicate kick attempt.
            if (this.kickedPlayers.has(kick.steamId32)) continue;
            this.kickedPlayers.add(kick.steamId32);
            try {
                await this.dota.kickPlayer(kick.steamId32);
                // Human-readable name: GC lobby member name → roster nickname → live Steam
                // persona lookup (the GC member name is often empty right after a join) →
                // Steam32 as a last resort.
                const lobbyPlayer = players.find((p) => p.steamId32 === kick.steamId32);
                const displayName = await this.displayNameFor(kick.steamId32, lobbyPlayer?.name);
                const chat = L.getEffectiveChatMessages(this.botConfig, this.botAccountId);
                const tmpl = chat.unauthorizedKickMessage || 'Player {player_name} is not registered for this match and has been removed.';
                await this.sendChat(L.applyPlaceholders(tmpl, { player_name: displayName, team_name: '', missing: '' }));
            } catch (e) { logger.warn('[Runner] kick failed', e); }
        }
        // Once both teams are ready, nudge any team split across both sides.
        if (this.session.state === 'ready_check') {
            const split = L.findSplitTeams(this.session, players);
            for (const teamName of split) {
                await this.sendChat(`[BOT] ${teamName}: your players are split across Radiant and Dire slots. Please sit together on one side before the game starts.`);
            }
        }
    }

    /**
     * Greet each expected player by name with the admin-configured welcome message
     * (config.chatMessages.welcomeMessage, supports {player_name}) the first time they
     * appear in the lobby. Only roster players + coaches are greeted — never the bot,
     * empty slots, or soon-to-be-kicked unregistered randoms. One greeting per player
     * per game lobby (welcomedPlayers is cleared when each new lobby is created).
     */
    async welcomeJoinedPlayers(players) {
        const chat = L.getEffectiveChatMessages(this.botConfig, this.botAccountId);
        const welcome = chat.welcomeMessage;
        if (!welcome) return;
        const authorized = L.getAllAuthorizedSteamIds(this.session); // rosters + coaches (no whitelist greet)
        for (const p of players) {
            const id = p.steamId32;
            if (!id || id === '0' || id === this.botSteamId32) continue;
            if (this.welcomedPlayers.has(id) || !authorized.has(id)) continue;
            this.welcomedPlayers.add(id);
            const name = L.getPlayerNickname(this.session, id);
            await this.sendChat(L.applyPlaceholders(welcome, { player_name: name, team_name: '', missing: '' }));
        }
    }

    // ─── Chat: ready-check, custom commands, late-vote ───────────────────────────
    async onChatMessage(msg) {
        if (this.finalizing) return;
        // Late-arrival forfeit/wait votes (whenever a vote is open).
        if (this.session.lateVote) await this.handleLateVoteChat(msg);
        // Ready/unready only while waiting in the open lobby.
        if (this.session.state === 'lobby_open') await this.handleReadyCheck(msg);
        // Admin-defined custom commands (e.g. "!rules") — reply any time the lobby is live.
        await this.handleCustomCommands(msg);
    }

    async handleCustomCommands(msg) {
        const custom = this.botConfig.chatMessages?.customCommands || [];
        if (!custom.length) return;
        const text = (msg.message || '').trim().toLowerCase();
        for (const c of custom) {
            if (c.trigger && text === c.trigger.toLowerCase()) {
                await this.sendChat(c.response);
                return;
            }
        }
    }

    async handleReadyCheck(msg) {
        const team = L.identifyPlayerTeam(this.session, msg.steamId32);
        if (!team) return; // not a recognized player

        const readyCfg = this.botConfig.readyCheck || { readyCommands: ['!ready'], unreadyCommands: ['!unready'] };
        const chat = L.getEffectiveChatMessages(this.botConfig, this.botAccountId);
        const isReady = L.isReadyCommand(msg.message, readyCfg.readyCommands);
        const isUnready = L.isUnreadyCommand(msg.message, readyCfg.unreadyCommands);
        if (!isReady && !isUnready) return;

        const teamAssignment = team === 'radiant' ? this.session.radiantTeam : this.session.direTeam;
        const playerRecord = [...this.session.radiantTeam.expectedPlayers, ...this.session.direTeam.expectedPlayers]
            .find((p) => p.steamId32 === msg.steamId32);
        const playerName = playerRecord?.nickname ?? msg.playerName;
        const teamName = teamAssignment.teamName;

        if (isReady) {
            // Sides are NOT pre-assigned (coin toss decides). A team is ready when ALL its
            // players are seated TOGETHER on one side — either side is fine, as long as they're
            // not split. We don't require a specific side per player.
            const live = this.dota.getCurrentLobbyPlayers().map((p) => ({ steamId32: p.steamId32, teamSide: p.team }));
            const side = L.teamSeatedSide(teamAssignment, live);
            if (!side) {
                const ids = new Set(teamAssignment.expectedPlayers.map((p) => p.steamId32));
                const seatedIds = new Set(live.filter((p) => ids.has(p.steamId32) && (p.teamSide === 'radiant' || p.teamSide === 'dire')).map((p) => p.steamId32));
                const notSeated = teamAssignment.expectedPlayers.filter((p) => !seatedIds.has(p.steamId32));
                const missingNames = notSeated.length > 0
                    ? notSeated.map((p) => p.nickname).join(', ')
                    : 'players split across Radiant and Dire — sit together on one side';
                await this.sendChat(L.applyPlaceholders(chat.teamNotReadyMessage, { player_name: playerName, team_name: teamName, missing: missingNames }));
                return; // do not mark ready
            }

            // The team's Dota lobby team-name field must be set before they can ready up. The
            // post-game OpenDota import maps each Dota side to a tournament team by this name, so
            // launching with a blank team name breaks the result sync. Players set it in the
            // lobby's team panel before typing ready.
            const readyCmd = readyCfg.readyCommands[0] ?? '!ready';
            const lobbyNames = this.dota.getLobbyTeamNames();
            const sideTeamName = side === 'radiant' ? lobbyNames.radiant : lobbyNames.dire;
            if (!sideTeamName || !String(sideTeamName).trim()) {
                await this.sendChat(`[BOT] ${teamName || 'Your team'}: set your team name in the lobby (the team-name field above your slots) before typing ${readyCmd}.`);
                return; // do not mark ready
            }

            const readyState = { ...this.session.readyState };
            if (team === 'radiant') { readyState.radiantReady = true; readyState.radiantReadyBy = msg.steamId32; }
            else { readyState.direReady = true; readyState.direReadyBy = msg.steamId32; }
            const bothReady = readyState.radiantReady && readyState.direReady;

            // Before launching, the two teams must be on OPPOSITE sides.
            if (bothReady) {
                const rSide = L.teamSeatedSide(this.session.radiantTeam, live);
                const dSide = L.teamSeatedSide(this.session.direTeam, live);
                if (rSide && dSide && rSide === dSide) {
                    await this.updateSession({ readyState });
                    await this.sendChat(`[BOT] Both teams are on the ${rSide.toUpperCase()} side. One team must move to the other side before the match can start.`);
                    return;
                }
            }

            await this.updateSession({
                readyState,
                state: bothReady ? 'ready_check' : this.session.state,
                ...(bothReady ? { readyCheckStartedAt: nowIso() } : {}),
            });

            if (bothReady) {
                await this.sendChat(L.applyPlaceholders(chat.allReadyMessage, { player_name: playerName, team_name: teamName }));
                await this.updateBotStatus('ready_check');
                await this.launchGame();
            } else {
                await this.sendChat(L.applyPlaceholders(chat.teamReadyMessage, { player_name: playerName, team_name: teamName }));
            }
        } else if (isUnready) {
            const readyState = { ...this.session.readyState };
            if (team === 'radiant') { readyState.radiantReady = false; readyState.radiantReadyBy = undefined; }
            else { readyState.direReady = false; readyState.direReadyBy = undefined; }
            await this.updateSession({ readyState, state: 'lobby_open' });
        }
    }

    async launchGame() {
        if (this.session.startGameSentAt) return; // already launched

        // Safety net: never launch with an unnamed team. Both Dota lobby team-name fields must
        // be set (the per-!r gate normally guarantees this, but a player could blank a name after
        // readying). An empty name breaks the OpenDota team→side mapping on result import.
        const launchNames = this.dota.getLobbyTeamNames();
        if (!launchNames.radiant?.trim() || !launchNames.dire?.trim()) {
            await this.sendChat('[BOT] Both teams must set their team name in the lobby before the match can start. Set it, then ready up again.');
            await this.updateSession({ readyState: { radiantReady: false, direReady: false }, state: 'lobby_open' });
            return;
        }

        // ── Pre-launch sweep ──────────────────────────────────────────────────
        // Take a live snapshot rather than the potentially-stale lastLobbyPlayers field.
        // Keep each member's Steam name so kick messages are meaningful to humans.
        const live = this.dota.getCurrentLobbyPlayers().map((p) => ({ steamId32: p.steamId32, teamSide: p.team, name: p.name || null }));

        // Build the authorized set with the bot's own account whitelisted so it is never kicked.
        const wl = [...(this.botConfig.whitelist ?? [])];
        if (this.botSteamId32) wl.push({ steamId32: this.botSteamId32 });
        const authorized = L.getAllAuthorizedSteamIds(this.session, wl);

        // 1. Kick any unauthorized player sitting in a team or spectator slot — but ONLY if
        //    auto-removal is enabled. When the admin unchecks "auto-remove unauthorized", they
        //    take responsibility for who's in the lobby, so the game may start with unauthorized
        //    players present (consistent with the open-lobby enforce() path, which also honors it).
        const autoKick = this.botConfig.enforcement?.autoKickUnauthorized ?? true;
        const toKick = autoKick ? live.filter(
            (p) => p.steamId32 && p.steamId32 !== '0' && !authorized.has(p.steamId32)
                && (p.teamSide === 'radiant' || p.teamSide === 'dire' || p.teamSide === 'spectator')
        ) : [];
        if (toKick.length > 0) {
            logger.warn(`[Runner] Pre-launch: kicking ${toKick.length} unauthorized player(s) before game start`);
            for (const p of toKick) {
                if (this.kickedPlayers.has(p.steamId32)) continue; // enforce() may have already issued it
                this.kickedPlayers.add(p.steamId32);
                try { await this.dota.kickPlayer(p.steamId32); }
                catch (e) { logger.warn('[Runner] pre-launch kick failed', e); }
            }
            const kickedNames = await Promise.all(toKick.map((p) => this.displayNameFor(p.steamId32, p.name)));
            await this.sendChat(`[BOT] Removed unregistered player(s): ${kickedNames.join(', ')}. Check your slots and type !ready again.`);
            await this.updateBotStatus('lobby_active');
            await this.updateSession({
                state: 'lobby_open',
                readyState: { radiantReady: false, direReady: false },
                readyCheckStartedAt: null,
            });
            return;
        }

        // 2. Re-verify that both teams have all their players seated together on one side.
        //    teamSeatedSide returns null when a player is missing from team slots or the team
        //    is split across both sides.
        const rSide = L.teamSeatedSide(this.session.radiantTeam, live);
        const dSide = L.teamSeatedSide(this.session.direTeam, live);

        if (!rSide || !dSide) {
            const issues = [];
            for (const team of [this.session.radiantTeam, this.session.direTeam]) {
                if (L.teamSeatedSide(team, live)) continue;
                const seatedIds = new Set(
                    live
                        .filter((p) => (p.teamSide === 'radiant' || p.teamSide === 'dire')
                            && team.expectedPlayers.some((e) => e.steamId32 === p.steamId32))
                        .map((p) => p.steamId32)
                );
                const missing = team.expectedPlayers.filter((e) => !seatedIds.has(e.steamId32));
                issues.push(
                    missing.length > 0
                        ? `${team.teamName}: missing ${missing.map((p) => p.nickname).join(', ')}`
                        : `${team.teamName}: players split across Radiant and Dire — sit together on one side`
                );
            }
            for (const msg of issues) await this.sendChat(`[BOT] ${msg}`);
            await this.updateBotStatus('lobby_active');
            await this.updateSession({
                state: 'lobby_open',
                readyState: { radiantReady: false, direReady: false },
                readyCheckStartedAt: null,
            });
            return;
        }

        if (rSide === dSide) {
            await this.sendChat(`[BOT] Both teams are on the ${rSide.toUpperCase()} side. One team must move to the other side, then type !ready again.`);
            await this.updateBotStatus('lobby_active');
            await this.updateSession({
                state: 'lobby_open',
                readyState: { radiantReady: false, direReady: false },
                readyCheckStartedAt: null,
            });
            return;
        }

        // ── All checks passed — set the series score for THIS game, then launch ───────────────
        // Teams may swap Radiant/Dire between games, so the lobby's series score must be set from
        // the side each team ACTUALLY sits on now (rSide = the side session.radiantTeam occupies).
        // The score is stored per-team in session.seriesScore; map it onto the live sides. This
        // must happen before startGame()/the coin toss — the GC breaks the lobby otherwise.
        try {
            const radiantSideTeam = rSide === 'radiant' ? this.session.radiantTeam : this.session.direTeam;
            const direSideTeam = rSide === 'radiant' ? this.session.direTeam : this.session.radiantTeam;
            const rWins = (this.session.seriesScore && this.session.seriesScore[radiantSideTeam.teamId]) || 0;
            const dWins = (this.session.seriesScore && this.session.seriesScore[direSideTeam.teamId]) || 0;

            // Admin-issued draft penalties — read fresh from the match doc (may be issued after the
            // session was created), apply for the game about to be played, mapped to each team's
            // current side. Penalty levels: 1=-30s, 2=-70s, 3=-130s draft time.
            const PENALTY_SECONDS = { 1: 30, 2: 70, 3: 130 };
            const gameNumber = (this.session.completedGameIds ? this.session.completedGameIds.length : 0) + 1;
            let penaltyRadiant = 0, penaltyDire = 0;
            const announce = [];
            try {
                const matchSnap = await this.db.collection('tournaments').doc(this.session.tournamentId)
                    .collection('matches').doc(this.session.matchId).get();
                const penalties = (matchSnap.exists && matchSnap.data().draftPenalties) || [];
                const levelFor = (teamId) => {
                    let lvl = 0;
                    for (const p of penalties) {
                        if (p.teamId !== teamId) continue;
                        const applies = !p.games || p.games.length === 0 || p.games.includes(gameNumber);
                        if (applies && Number(p.level) > lvl) lvl = Number(p.level);
                    }
                    return lvl;
                };
                penaltyRadiant = levelFor(radiantSideTeam.teamId);
                penaltyDire = levelFor(direSideTeam.teamId);
                if (penaltyRadiant > 0) announce.push({ name: radiantSideTeam.teamName, sec: PENALTY_SECONDS[penaltyRadiant] || 0 });
                if (penaltyDire > 0) announce.push({ name: direSideTeam.teamName, sec: PENALTY_SECONDS[penaltyDire] || 0 });
            }
            catch (pe) {
                logger.warn('[Runner] Failed to read draft penalties (continuing without)', pe);
            }

            if (rWins > 0 || dWins > 0 || penaltyRadiant > 0 || penaltyDire > 0) {
                await this.dota.updateSeriesScore(rWins, dWins, penaltyRadiant, penaltyDire);
                logger.info(`[Runner] Lobby set before start: Radiant(${radiantSideTeam.teamName}) ${rWins} [pen ${penaltyRadiant}] - ${dWins} [pen ${penaltyDire}] Dire(${direSideTeam.teamName})`);
            }
            for (const a of announce) {
                await this.sendChat(`[BOT] Drużyna ${a.name} ma karę draftu: -${a.sec}s czasu na draft w tej grze.`);
            }
        }
        catch (e) {
            logger.warn('[Runner] Failed to set series score / penalties before start (continuing)', e);
        }

        // ── Launch ────────────────────────────────────────────────────────────
        await this.updateSession({ startGameSentAt: nowIso() });
        const startMsg = this.botConfig.chatMessages?.matchStartMessage;
        if (startMsg) await this.sendChat(startMsg);
        try {
            const { coinToss } = await this.dota.startGame();
            logger.info(`[Runner] start_game dispatched${coinToss ? ' (coin toss — awaiting both captains)' : ''}`);
        } catch (e) {
            logger.error('[Runner] startGame failed', e);
            // Allow another !ready attempt to retry the launch.
            await this.updateSession({ startGameSentAt: null });
        }
    }

    /**
     * Map session-teams to the Dota sides they currently occupy. Returns
     * { radiant: teamId|null, dire: teamId|null }. Fills a missing side by elimination.
     */
    captureGameSides(players) {
        const rTeam = this.session.radiantTeam, dTeam = this.session.direTeam;
        const map = { radiant: null, dire: null };
        const rSide = L.teamSeatedSide(rTeam, players);
        const dSide = L.teamSeatedSide(dTeam, players);
        if (rSide) map[rSide] = rTeam.teamId;
        if (dSide) map[dSide] = dTeam.teamId;
        if (map.radiant && !map.dire) map.dire = (map.radiant === rTeam.teamId) ? dTeam.teamId : rTeam.teamId;
        if (map.dire && !map.radiant) map.radiant = (map.dire === rTeam.teamId) ? dTeam.teamId : rTeam.teamId;
        return map;
    }

    // ─── Series game-end handler ─────────────────────────────────────────────────
    async handleGameEnded(dotaMatchId, radiantWin) {
        this.gameEndHandled = true; // block re-entry from any further POSTGAME events for this game
        const dotaWinnerSide = radiantWin ? 'radiant' : 'dire';
        // Map the Dota-side outcome to a team via the side mapping captured at game start
        // (teams may sit on either side). Fall back to the session label if unknown.
        const sides = this.session.currentGameSides;
        const winnerTeamId = (sides && sides[dotaWinnerSide])
            ? sides[dotaWinnerSide]
            : (radiantWin ? this.session.radiantTeam.teamId : this.session.direTeam.teamId);
        // Record the winner by the SESSION's side label for that team (stable team identity).
        const winnerSide = (winnerTeamId === this.session.radiantTeam.teamId) ? 'radiant' : 'dire';

        const completedGameIds = [...this.session.completedGameIds, dotaMatchId];
        const completedGameWinners = [...this.session.completedGameWinners, winnerSide];
        const seriesScore = { ...this.session.seriesScore };
        seriesScore[winnerTeamId] = (seriesScore[winnerTeamId] || 0) + 1;

        await this.updateSession({
            state: 'post_game',
            gameEndedAt: nowIso(),
            completedGameIds,
            completedGameWinners,
            seriesScore,
        });
        await this.updateBotStatus('post_game');
        logger.info(`[Runner] Game ${this.session.currentGameNumber} ended — ${winnerSide} won (dotaMatchId=${dotaMatchId})`);

        // Schedule the OpenDota/standings import (existing pipeline consumes botSyncTasks).
        await this.scheduleMatchSync(dotaMatchId);

        const result = L.calculateSeriesResult(this.session);
        const scoreText = L.formatSeriesScore(this.session);

        if (result.decided) {
            await this.finalizeSeries(result, scoreText);
        } else {
            await this.advanceToNextGame(winnerSide, scoreText);
        }
    }

    async scheduleMatchSync(dotaMatchId) {
        if (this.botConfig.postMatch?.autoSyncEnabled === false) return;
        const delayMin = this.botConfig.postMatch?.syncDelayMinutes ?? 5;
        const syncAt = new Date(now() + delayMin * 60000).toISOString();
        try {
            await this.db.collection('botSyncTasks').add({
                type: 'sync',
                sessionId: this.sessionId,
                matchId: this.session.matchId,
                tournamentId: this.session.tournamentId,
                dotaMatchId,
                syncAt,
                status: 'pending',
                createdAt: nowIso(),
            });
            logger.info(`[Runner] Scheduled match sync for dotaMatchId=${dotaMatchId} at ${syncAt}`);
        } catch (e) { logger.error('[Runner] Failed to schedule match sync', e); }
    }

    /**
     * Enqueue a per-game forfeit task. The web app drains it and calls forfeitPDLMatchAdmin —
     * the SAME admin action a human would use — so the bot never writes match scores itself.
     * gameNumbers are individual games to flag as walkovers (never a whole-series scope).
     */
    async scheduleForfeit(forfeitedSide, gameNumbers, reason) {
        const forfeitingTeamId = forfeitedSide === 'radiant'
            ? this.session.radiantTeam.teamId : this.session.direTeam.teamId;
        try {
            await this.db.collection('botSyncTasks').add({
                type: 'forfeit',
                sessionId: this.sessionId,
                matchId: this.session.matchId,
                tournamentId: this.session.tournamentId,
                forfeitingTeamId,
                forfeitedGameNumbers: gameNumbers,
                reason: reason || '',
                syncAt: nowIso(), // forfeits need no OpenDota parse delay
                status: 'pending',
                createdAt: nowIso(),
            });
            logger.info(`[Runner] Enqueued forfeit task (match ${this.session.matchId}, games [${gameNumbers.join(',')}], team ${forfeitingTeamId})`);
        } catch (e) { logger.error('[Runner] Failed to enqueue forfeit task', e); }
    }

    async finalizeSeries(result, scoreText) {
        const winnerTeamName = result.winnerId
            ? (result.winnerId === this.session.radiantTeam.teamId ? this.session.radiantTeam.teamName : this.session.direTeam.teamName)
            : null;

        // NOTE: the bot does NOT write match scores/winner. Real game results are imported from
        // OpenDota by the post-game sync (scheduleMatchSync → web-side syncPDLMatchesAdmin), which
        // marks the match complete and recalculates standings — exactly as the admin's
        // "Synchronizuj mecze" button does. The bot only announces the result in lobby chat.
        await this.sendChat(result.isDraw ? `Series complete! Draw: ${scoreText}` : `Series decided! ${winnerTeamName} wins ${scoreText}`);
        logger.info(`[Runner] Series decided for match ${this.session.matchId}: ${scoreText} (winner: ${result.winnerId || 'draw'}) — match doc left to the OpenDota sync`);
        await this.finishUp(0, 'completed');
    }

    async advanceToNextGame(winnerSide, scoreText) {
        const next = L.getNextGameNumber(this.session);
        if (next === null) {
            logger.error('[Runner] getNextGameNumber returned null but series not decided — finalizing defensively');
            await this.finishUp(0, 'completed');
            return;
        }
        const winnerName = winnerSide === 'radiant' ? this.session.radiantTeam.teamName : this.session.direTeam.teamName;
        await this.sendChat(`Game ${this.session.currentGameNumber} complete! ${winnerName} wins. Score: ${scoreText}. Opening lobby for Game ${next}...`);

        // Leave the current lobby before recreating for the next game.
        try { await this.dota.leaveLobby(); } catch (e) { logger.warn('[Runner] leave between games failed', e); }

        // Carry the series score into the next lobby; reset the late-timer baseline to give
        // teams an inter-game break before the next forfeit window opens.
        const interGameBreakMin = this.botConfig.lateArrival?.interGameBreakMinutes ?? 15;
        const scheduledMatchTime = new Date(now() + interGameBreakMin * 60000).toISOString();
        await this.updateSession({
            currentGameNumber: next,
            lobbyRadiantWins: this.session.seriesScore[this.session.radiantTeam.teamId] ?? 0,
            lobbyDireWins: this.session.seriesScore[this.session.direTeam.teamId] ?? 0,
            scheduledMatchTime,
            lateVote: null,
            lateWaitUntil: null,
            currentGameSides: null,
        });

        await this.createLobbyForCurrentGame();
    }

    // ─── Fallback game-end detection (OpenDota poll) ─────────────────────────────
    /**
     * Fallback for a lost POSTGAME lobby event. The primary game-end signal is the POSTGAME
     * update in onLobbyUpdate, but that single push can be missed — a transient GC disconnect
     * at game end, or a POSTGAME whose match_outcome is still 0 when the lobby is destroyed —
     * which strands the whole series, because the NEXT game's lobby is only ever opened from
     * handleGameEnded. This polls OpenDota for the started match id and, once it resolves to a
     * decisive result, drives the SAME handleGameEnded path (advance or finalize). Because the
     * match id is persisted on the session, this also recovers after a process restart.
     */
    async pollExternalGameResult() {
        if (this.finalizing) return;
        if (this.session.state !== 'in_game') return; // only while a game is live (post_game already handled)
        if (this.gameEndHandled) return;              // POSTGAME already won the race

        // Prefer the persisted id; if it wasn't captured yet, read it live from the lobby.
        let matchId = Number(this.session.currentGameDotaMatchId) || 0;
        if (!matchId) {
            const live = this.dota.getCurrentLobbyData?.();
            matchId = live ? (Number(live.matchId) || 0) : 0;
            if (matchId) await this.updateSession({ currentGameDotaMatchId: matchId });
        }
        if (!matchId) return; // no id yet — nothing to poll

        const result = await this.fetchOpenDotaResult(matchId);
        if (!result) return; // not finished / not in OpenDota yet / fetch failed — try again next tick
        // Re-check the latches after the await (a POSTGAME may have landed meanwhile).
        if (this.gameEndHandled || this.gameEndHandledFor === matchId) return;
        this.gameEndHandledFor = matchId;
        this.waitingForMatchId = false;
        logger.warn(`[Runner] Game-end recovered via OpenDota poll (POSTGAME event was missed) — dotaMatchId=${matchId} radiantWin=${result.radiantWin}`);
        await this.handleGameEnded(matchId, result.radiantWin);
    }

    /**
     * Fetch a match's result from OpenDota. Returns { radiantWin } once the match is finished,
     * else null (404 while it isn't ingested yet, non-boolean radiant_win, or any network error).
     * OpenDota only stores FINISHED matches, so a decisive radiant_win is a safe game-over signal.
     */
    async fetchOpenDotaResult(matchId) {
        try {
            const key = process.env.OPENDOTA_API_KEY;
            const url = `https://api.opendota.com/api/matches/${matchId}` + (key ? `?api_key=${key}` : '');
            const res = await fetch(url, { headers: { 'User-Agent': 'dota2-lobby-bot' } });
            if (!res.ok) return null;
            const m = await res.json();
            if (typeof m.radiant_win !== 'boolean') return null; // not resulted yet
            return { radiantWin: m.radiant_win };
        } catch (e) {
            logger.warn(`[Runner] OpenDota result fetch failed for ${matchId}`, e);
            return null;
        }
    }

    // ─── Late-arrival forfeit / wait voting ─────────────────────────────────────
    async tickLateArrival() {
        if (this.finalizing) return;
        const policy = this.botConfig.lateArrival;
        if (!policy?.enabled) return;
        if (!['lobby_open', 'ready_check'].includes(this.session.state)) return;
        if (this.session.startGameSentAt) return;

        // Resolve an open vote whose window has closed.
        if (this.session.lateVote) {
            if (now() >= new Date(this.session.lateVote.closesAt).getTime()) {
                await this.resolveLateVote(policy);
            }
            return; // one vote at a time
        }

        if (!this.session.scheduledMatchTime) return;
        if (this.session.lateWaitUntil && new Date(this.session.lateWaitUntil).getTime() > now()) return;

        const elapsedMin = (now() - new Date(this.session.scheduledMatchTime).getTime()) / 60000;
        let kind = null;
        if (elapsedMin >= policy.seriesForfeitMinutes) kind = 'series';
        else if (elapsedMin >= policy.game1ForfeitMinutes) kind = 'game1';
        if (!kind) return;

        // Presence from the LIVE lobby (not the possibly-stale lastLobbyPlayers field).
        const live = (this.dota.getCurrentLobbyPlayers?.() || []).map((p) => ({ steamId32: p.steamId32, teamSide: p.team }));
        const presence = L.computeTeamPresence(this.session, live);
        const radiantFull = presence.radiant >= this.session.radiantTeam.expectedPlayers.length;
        const direFull = presence.dire >= this.session.direTeam.expectedPlayers.length;

        // Only open a forfeit vote when exactly one team is FULLY present and the other is not.
        // If the present (non-late) team is itself short, do NOT open a vote yet — return and let
        // the next tick (every LATE_TICK_MS) re-check, effectively waiting until they have everyone
        // in the lobby. This guarantees we never ask a half-present team to vote out the other.
        let lateSide = null;
        if (!radiantFull && direFull) lateSide = 'radiant';
        else if (!direFull && radiantFull) lateSide = 'dire';
        if (!lateSide) return;

        await this.openLateVote(policy, kind, lateSide);
    }

    async openLateVote(policy, kind, lateSide) {
        const closesAt = new Date(now() + (policy.votingWindowSeconds || 60) * 1000).toISOString();
        const lateTeamName = lateSide === 'radiant' ? this.session.radiantTeam.teamName : this.session.direTeam.teamName;
        const presentTeamName = lateSide === 'radiant' ? this.session.direTeam.teamName : this.session.radiantTeam.teamName;
        const tmpl = kind === 'series' ? policy.lateSeriesAnnouncementTemplate : policy.lateGame1AnnouncementTemplate;
        const minutes = kind === 'series' ? policy.seriesForfeitMinutes : policy.game1ForfeitMinutes;

        await this.updateSession({ lateVote: { kind, lateSide, openedAt: nowIso(), closesAt, votes: {} } });
        await this.sendChat(`[BOT] ${L.applyLatePlaceholders(tmpl, {
            late_team: lateTeamName, present_team: presentTeamName, minutes: String(minutes),
            wait_cmd: policy.waitCommands[0] ?? '!wait', forfeit_cmd: policy.forfeitCommands[0] ?? '!forfeit',
            window: String(policy.votingWindowSeconds || 60), required: String(policy.requiredVotesForForfeit),
        })}`);
        logger.info(`[Runner] Opened ${kind} late vote against ${lateSide} (${lateTeamName})`);
    }

    async resolveLateVote(policy) {
        const vote = this.session.lateVote;
        const tally = Object.values(vote.votes);
        const forfeitVotes = tally.filter((v) => v === 'forfeit').length;
        const lateTeamName = vote.lateSide === 'radiant' ? this.session.radiantTeam.teamName : this.session.direTeam.teamName;
        const winnerSide = vote.lateSide === 'radiant' ? 'dire' : 'radiant';
        const winnerTeamName = winnerSide === 'radiant' ? this.session.radiantTeam.teamName : this.session.direTeam.teamName;

        if (forfeitVotes >= policy.requiredVotesForForfeit) {
            await this.updateSession({ lateVote: null });
            const msgTmpl = vote.kind === 'series' ? policy.forfeitSeriesTemplate : policy.forfeitGame1Template;
            await this.sendChat(`[BOT] ${L.applyLatePlaceholders(msgTmpl, { winner_team: winnerTeamName, loser_team: lateTeamName })}`);
            await this.handleForfeit(vote.kind, vote.lateSide);
        } else {
            const waitUntil = new Date(now() + (policy.waitExtensionMinutes || 10) * 60000).toISOString();
            await this.updateSession({ lateVote: null, lateWaitUntil: waitUntil });
            const tmpl = tally.length === 0 ? policy.noVoteResultTemplate : policy.waitResultTemplate;
            await this.sendChat(`[BOT] ${L.applyLatePlaceholders(tmpl, {
                present_team: winnerTeamName, extra: String(policy.waitExtensionMinutes || 10),
                votes: String(forfeitVotes), required: String(policy.requiredVotesForForfeit),
            })}`);
        }
    }

    async handleLateVoteChat(msg) {
        const vote = this.session.lateVote;
        if (!vote) return;
        if (now() >= new Date(vote.closesAt).getTime()) return;
        const policy = this.botConfig.lateArrival;
        if (!policy) return;
        // Only the PRESENT (non-late) team may vote.
        const voterTeam = L.identifyPlayerTeam(this.session, msg.steamId32);
        if (!voterTeam || voterTeam === vote.lateSide) return;
        const text = (msg.message || '').trim().toLowerCase();
        const isForfeit = (policy.forfeitCommands || []).some((c) => c.toLowerCase() === text);
        const isWait = (policy.waitCommands || []).some((c) => c.toLowerCase() === text);
        if (!isForfeit && !isWait) return;
        const votes = { ...vote.votes, [msg.steamId32]: isForfeit ? 'forfeit' : 'wait' };
        await this.updateSession({ lateVote: { ...vote, votes } });
    }

    /**
     * Apply a forfeit (from a passed late vote). A game1 forfeit awards +1 and continues
     * the series; a series forfeit finalizes the match for the present team.
     */
    async handleForfeit(forfeitType, forfeitedSide) {
        const winnerSide = forfeitedSide === 'radiant' ? 'dire' : 'radiant';

        if (forfeitType === 'series') {
            // Flag EVERY remaining (unplayed) game as an INDIVIDUAL walkover — never a whole-series
            // scope. forfeitPDLMatchAdmin (run web-side) records them exactly like a manual admin
            // game-level forfeit, which marks the match complete + recalculates standings.
            const remaining = [];
            const total = this.session.totalGames || this.session.currentGameNumber;
            for (let g = this.session.currentGameNumber; g <= total; g++) remaining.push(g);
            const forfeitedGames = [...(this.session.forfeitedGames || []),
                ...remaining.map((gameNumber) => ({ gameNumber, forfeitedTeam: forfeitedSide, winnerTeam: winnerSide }))];
            await this.updateSession({ forfeitedGames });
            await this.scheduleForfeit(forfeitedSide, remaining, 'No-show — series forfeit (late-arrival vote passed)');
            await this.sendChat('Series forfeited. Match closed.');
            logger.info(`[Runner] Series forfeited — ${winnerSide} wins match ${this.session.matchId} (games [${remaining.join(',')}])`);
            await this.finishUp(0, 'completed');
            return;
        }

        // Single-game forfeit → flag THIS game, then continue the series (or finalize if it clinched).
        // Mirror handleGameEnded's bookkeeping (incl. a synthetic completedGameIds entry) so the
        // bot's series-progress math advances/stops correctly for every format.
        const gameNumber = this.session.currentGameNumber;
        const winnerTeamId = winnerSide === 'radiant' ? this.session.radiantTeam.teamId : this.session.direTeam.teamId;
        const completedGameIds = [...this.session.completedGameIds, 0]; // 0 = forfeit (no Dota match)
        const completedGameWinners = [...this.session.completedGameWinners, winnerSide];
        const seriesScore = { ...this.session.seriesScore };
        seriesScore[winnerTeamId] = (seriesScore[winnerTeamId] || 0) + 1;
        const forfeitedGames = [...(this.session.forfeitedGames || []),
            { gameNumber, forfeitedTeam: forfeitedSide, winnerTeam: winnerSide }];
        await this.updateSession({ completedGameIds, completedGameWinners, seriesScore, forfeitedGames });
        await this.scheduleForfeit(forfeitedSide, [gameNumber], `No-show — Game ${gameNumber} forfeit (late-arrival vote passed)`);

        const result = L.calculateSeriesResult(this.session);
        const scoreText = L.formatSeriesScore(this.session);
        if (result.decided) {
            await this.finalizeSeries(result, scoreText);
        } else {
            await this.advanceToNextGame(winnerSide, scoreText);
        }
    }

    /**
     * True if at least one participant registered for this match (a roster player or an
     * approved standin — i.e. anyone in either team's effective expectedPlayers) is
     * currently sitting in the lobby. The bot must never abandon a lobby that still has a
     * registered player in it (e.g. a team waiting for the opponent, including after a
     * passed !wait vote). Whitelist/observers/coaches don't count — only match players.
     */
    anyRegisteredPlayerPresent() {
        if (!this.dota?.isConnected) return false;
        const expectedIds = new Set([
            ...this.session.radiantTeam.expectedPlayers.map((p) => p.steamId32),
            ...this.session.direTeam.expectedPlayers.map((p) => p.steamId32),
        ]);
        return this.dota.getCurrentLobbyPlayers()
            .some((p) => p.steamId32 && p.steamId32 !== '0' && expectedIds.has(p.steamId32));
    }

    // ─── Timeouts (runner-local; pending/bot_assigned timeouts belong to the Conductor) ──
    async checkTimeouts() {
        if (this.finalizing) return;
        const cfg = this.botConfig;
        const ts = now();
        // Respect a granted wait extension.
        if (this.session.lateWaitUntil && new Date(this.session.lateWaitUntil).getTime() > ts) return;

        if (this.session.state === 'lobby_open') {
            const openAt = this.session.lobbyCreatedAt ? new Date(this.session.lobbyCreatedAt).getTime() : new Date(this.session.createdAt).getTime();
            const elapsedMin = (ts - openAt) / 60000;
            const closeMin = cfg.lobbyOpenTimeoutMinutes ?? cfg.lobbyTimeoutMinutes ?? 30;
            const warnMin = cfg.lobbyOpenWarningMinutes ?? 15;
            if (elapsedMin >= closeMin) {
                // Never close while a registered player/standin is still present — they may be
                // waiting for the other team. Only a truly empty/abandoned lobby times out.
                if (this.anyRegisteredPlayerPresent()) {
                    if (!this.session.timeoutHeldNotified) {
                        await this.sendChat('[BOT] Holding the lobby open — registered players are still here. It will stay up until everyone leaves; contact an admin if you need it cancelled.');
                        await this.updateSession({ timeoutHeldNotified: nowIso() });
                    }
                    return;
                }
                await this.cancel(`Lobby no-show: players did not fill within ${Math.round(elapsedMin)} minutes`,
                    `[BOT] Lobby closed — the required players did not join within ${Math.round(closeMin)} minutes. Admin has been notified.`);
                return;
            }
            if (warnMin > 0 && elapsedMin >= warnMin && !this.session.timeoutWarningSentAt) {
                const remaining = Math.round(closeMin - elapsedMin);
                await this.sendChat(`[BOT] Warning: not all players have joined. The lobby will close in ${remaining} minute${remaining !== 1 ? 's' : ''} if the roster is not full and the lobby empties.`);
                await this.updateSession({ timeoutWarningSentAt: nowIso() });
            }
            return;
        }

        if (this.session.state === 'ready_check') {
            const readyTimeoutMin = cfg.readyCheckTimeoutMinutes ?? 10;
            const clockStart = this.session.readyCheckStartedAt ?? this.session.startGameSentAt ?? this.session.lobbyCreatedAt ?? this.session.createdAt;
            const elapsedMin = (ts - new Date(clockStart).getTime()) / 60000;
            if (elapsedMin >= readyTimeoutMin) {
                // Same rule: don't abandon a lobby that still has registered players in it.
                if (this.anyRegisteredPlayerPresent()) return;
                await this.cancel(`Stuck in ready_check for ${Math.round(elapsedMin)} minutes without the game launching`,
                    '[BOT] The match did not start after the ready check. Lobby closed. Please contact an admin.');
            }
            return;
        }

        // In-game watchdog: a game normally ends via the POSTGAME lobby event → handleGameEnded,
        // which advances/finalizes and releases the bot. If that event is missed (the bot was
        // down when the game ended, or a stale reattach that never receives a fresh POSTGAME),
        // the session would otherwise sit in in_game/post_game forever and PIN THE BOT ACCOUNT —
        // eventually starving the pool so every new match is cancelled ("no bot available").
        // No real Dota game lasts anywhere near this long, so finalize to free the bot. The bot
        // never writes match scores (the OpenDota sync does), so ending the session here cannot
        // corrupt results; an admin can force-import any un-synced game.
        if (this.session.state === 'in_game' || this.session.state === 'post_game') {
            // Fast path: if the match is already complete (its games were synced by the
            // OpenDota pipeline), the game-end event was missed — most often because the runner
            // was restarted (redeploy/crash) at/after game end and reattached into in_game,
            // where it waits forever for a POSTGAME that won't re-arrive. Release immediately.
            if (await this.matchAlreadyComplete()) {
                logger.warn(`[Runner] Watchdog: match ${this.session.matchId} already complete but session still '${this.session.state}' — finalizing to release bot ${this.botAccountId}`);
                await this.finishUp(0, 'completed');
                return;
            }
            // Fallback for the rare case where the match never completes: no real Dota game
            // lasts this long, so free the bot rather than pinning it indefinitely.
            const startRef = this.session.gameStartedAt || this.session.gameEndedAt || this.session.updatedAt || this.session.createdAt;
            const elapsedMin = (ts - new Date(startRef).getTime()) / 60000;
            const maxGameMin = cfg.inGameTimeoutMinutes ?? 180;
            if (elapsedMin >= maxGameMin) {
                logger.warn(`[Runner] in_game watchdog: ${Math.round(elapsedMin)}min in '${this.session.state}' with no game-end — finalizing to release bot ${this.botAccountId}`);
                await this.finishUp(0, 'completed');
            }
        }
    }

    /** True if this session's match doc is already marked completed (games synced). */
    async matchAlreadyComplete() {
        if (!this.session?.tournamentId || !this.session?.matchId) return false;
        try {
            const snap = await this.db.collection('tournaments').doc(this.session.tournamentId)
                .collection('matches').doc(this.session.matchId).get();
            return snap.exists && snap.data().status === 'completed';
        } catch { return false; }
    }

    async cancel(reason, chatMsg) {
        if (this.finalizing) return;
        logger.warn(`[Runner] Cancelling session ${this.sessionId}: ${reason}`);
        if (chatMsg) await this.sendChat(chatMsg);
        await this.updateSession({ state: 'cancelled', cancelReason: reason, completedAt: nowIso() });
        await this.finishUp(0, 'cancelled', /*alreadyPersisted*/ true);
    }

    /**
     * The assigned bot can't host this session (e.g. it's stuck in a previous in-game lobby).
     * Put the bot on a long cooldown so the pool skips it until its game clears, and bounce the
     * session back to 'pending' so the Conductor reassigns it to a clean bot. After too many
     * bounces (no clean bot available), give up and mark the session error.
     */
    async bounceToCleanBot(reason) {
        if (this.finalizing) return;
        this.finalizing = true;
        for (const name of Object.keys(this.timers)) this.clearTimer(name);
        if (this.disconnectTimer) { clearTimeout(this.disconnectTimer); this.disconnectTimer = null; }
        if (this.sessionUnsub) { try { this.sessionUnsub(); } catch { /* ignore */ } this.sessionUnsub = null; }
        if (this.matchUnsub) { try { this.matchUnsub(); } catch { /* ignore */ } this.matchUnsub = null; }
        if (this.configUnsub) { try { this.configUnsub(); } catch { /* ignore */ } this.configUnsub = null; }

        const reassignCount = (this.session.reassignCount || 0) + 1;
        const MAX_REASSIGNS = 3;
        try { if (this.dota) await this.dota.leaveLobby(); } catch { /* best-effort */ }

        if (reassignCount > MAX_REASSIGNS) {
            this.exitCode = 1;
            try {
                await this.sessionRef.update({
                    state: 'error',
                    error: { message: `Could not place lobby after ${MAX_REASSIGNS} bot reassignments: ${reason}`, code: 'NO_CLEAN_BOT', timestamp: nowIso() },
                    updatedAt: nowIso(),
                });
            } catch { /* ignore */ }
            logger.error(`[Runner] Session ${this.sessionId} exceeded ${MAX_REASSIGNS} reassignments — marking error`);
        } else {
            this.exitCode = 0;
            // Long cooldown on the stuck bot so the Conductor's pool skips it until its game clears.
            try {
                await this.db.collection('botAccounts').doc(this.botAccountId).update({
                    status: 'idle', busyWithSessionId: null, currentSessionId: null,
                    cooldownUntil: new Date(now() + 30 * 60000).toISOString(), lastStuckAt: nowIso(), updatedAt: nowIso(),
                });
            } catch { /* ignore */ }
            // Bounce the session back to the pool for a different bot.
            try {
                await this.sessionRef.update({ state: 'pending', botAccountId: '', reassignReason: reason, reassignCount, updatedAt: nowIso() });
            } catch { /* ignore */ }
            logger.info(`[Runner] Bounced session ${this.sessionId} to pending (reassign ${reassignCount}/${MAX_REASSIGNS}); bot ${this.botAccountId} on 30min cooldown`);
        }
        try { if (this.dota) await this.dota.disconnect(); } catch { /* ignore */ }
        if (this.donePromiseResolve) this.donePromiseResolve();
    }

    // ─── Teardown ────────────────────────────────────────────────────────────────
    clearTimer(name) { if (this.timers[name]) { clearTimeout(this.timers[name]); clearInterval(this.timers[name]); delete this.timers[name]; } }

    /**
     * Leave the lobby, disconnect, release the account, and resolve run(). `state` is the
     * terminal session state; if not already persisted we write it (completed path).
     */
    async finishUp(exitCode, state, alreadyPersisted = false) {
        if (this.finalizing) return;
        this.finalizing = true;
        this.exitCode = exitCode;
        for (const name of Object.keys(this.timers)) this.clearTimer(name);
        if (this.disconnectTimer) { clearTimeout(this.disconnectTimer); this.disconnectTimer = null; }
        if (this.sessionUnsub) { try { this.sessionUnsub(); } catch { /* ignore */ } this.sessionUnsub = null; }
        if (this.matchUnsub) { try { this.matchUnsub(); } catch { /* ignore */ } this.matchUnsub = null; }
        if (this.configUnsub) { try { this.configUnsub(); } catch { /* ignore */ } this.configUnsub = null; }

        if (!alreadyPersisted && state) {
            try { await this.sessionRef.update({ state, completedAt: nowIso(), updatedAt: nowIso() }); } catch { /* ignore */ }
        }
        // Only release the account on a TERMINAL finish. On a crash/respawn exit (non-terminal
        // state, exitCode 1) the Conductor will respawn this same runner with this same account,
        // so flipping it to idle here would let another session double-claim it.
        if (TERMINAL_STATES.includes(state)) {
            try { await this.db.collection('botAccounts').doc(this.botAccountId).update({ status: 'idle', busyWithSessionId: null, currentSessionId: null, updatedAt: nowIso() }); } catch { /* ignore */ }
        }
        try { if (this.dota) await this.dota.disconnect(); } catch { /* ignore */ }
        logger.info(`[Runner] Finished session ${this.sessionId} → ${state} (exit ${exitCode})`);
        if (this.donePromiseResolve) this.donePromiseResolve();
    }
}

// ─── Entry point ───────────────────────────────────────────────────────────────
function argVal(flag) {
    const a = process.argv.find((x) => x.startsWith(`${flag}=`));
    return a ? a.split('=')[1] : undefined;
}

async function main() {
    const sessionId = argVal('--session-id') || process.env.SESSION_ID;
    const botAccountId = argVal('--bot-id') || process.env.BOT_ACCOUNT_ID;
    if (!sessionId || !botAccountId) {
        logger.error('[Runner] Usage: node dist/runner.js --session-id=<id> --bot-id=<id>');
        process.exit(2);
    }
    if (!process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
        logger.error('[Runner] FIREBASE_SERVICE_ACCOUNT_BASE64 is not set');
        process.exit(1);
    }

    const db = initFirebase();
    const runner = new Runner(db, sessionId, botAccountId);

    let shuttingDown = false;
    const shutdown = async (signal) => {
        if (shuttingDown) return;
        shuttingDown = true;
        logger.info(`[Runner] Received ${signal} — leaving lobby (will reattach on respawn)`);
        // Don't mark the session terminal: a SIGTERM is usually a Conductor redeploy; the
        // match is still live and we want to reattach on respawn. Just disconnect cleanly.
        try { if (runner.dota) await runner.dota.disconnect(); } catch { /* ignore */ }
        process.exit(0);
    };
    process.on('SIGINT', () => void shutdown('SIGINT'));
    process.on('SIGTERM', () => void shutdown('SIGTERM'));

    try {
        const code = await runner.run();
        process.exit(code || 0);
    } catch (err) {
        logger.error('[Runner] Fatal error', err);
        // Record a diagnostic but DON'T flip the session to a terminal 'error' state — a fatal
        // here is often transient (Steam rate-limit, GC hello timeout). Exiting non-zero lets the
        // Conductor respawn with backoff; it owns the crash-loop→error decision after a cap.
        try {
            await db.collection('botLobbySessions').doc(sessionId).update({
                lastRunnerError: { message: err instanceof Error ? err.message : String(err), timestamp: nowIso() },
                updatedAt: nowIso(),
            });
        } catch { /* ignore */ }
        process.exit(1);
    }
}

main();
