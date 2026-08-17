"use strict";
// src/inhouse/runner.ts
//
// One ephemeral process owns ONE inhouse lobby end-to-end, in real time —
// the same meepow-style shape dist/runner.js already uses for tournament
// matches (see bot-worker/REBUILD_PLAN.md), applied to a game with no series,
// no fixed roster, and a completely different Firestore surface
// (inhouseGames, not botLobbySessions).
//
// Spawned manually for M1 testing:
//   node dist/inhouse-runner.js --game-id=<id> --bot-id=<id>
// M3 wires the Conductor to spawn this the same way it already spawns
// dist/runner.js children.
//
// Lifecycle: connect → reattach-or-create (waiting on the `create_inhouse_lobby`
// command already queued by the website) → member sync / host handover / ban
// enforcement, driven by GC events → !start countdown → in_progress → match
// end → website webhook → release the account.
//
// Crash recovery: if this process dies (kill -9, OOM, …) without running
// finishUp(), the account lease is simply never released — on restart with
// the same --game-id/--bot-id, node-dota2 repopulates its lobby cache from
// the GC and reattachOrCreate() reattaches instead of creating a duplicate.
// A graceful SIGTERM/SIGINT disconnects without releasing anything either,
// for the same reason dist/runner.js doesn't: the match may still be live.
Object.defineProperty(exports, "__esModule", { value: true });
exports.InhouseRunner = void 0;
const dota_client_1 = require("../dota-client");
const logger_1 = require("../logger");
const store_1 = require("./core/store");
const lease_1 = require("./core/lease");
const link_codes_1 = require("./core/link-codes");
const attendance_1 = require("./core/attendance");
const discord_lookup_1 = require("./discord-lookup");
const types_1 = require("./core/types");
const ban_guard_1 = require("./ban-guard");
const session_logic_1 = require("./session-logic");
const command_queue_1 = require("./command-queue");
const chat_commands_1 = require("./chat-commands");
const lobby_settings_1 = require("./lobby-settings");
const match_webhook_1 = require("./match-webhook");
// CSODOTALobby.State enum (runner.js's own constant, mirrored here).
const LOBBY_STATE = { UI: 0, SERVERSETUP: 1, RUN: 2, POSTGAME: 3, READYUP: 4, NOTREADY: 5, SERVERASSIGN: 6 };
const HEARTBEAT_MS = 30_000;
/** How long to wait after login for the GC to deliver a cached lobby SObject before deciding "nothing to reattach to". */
const REATTACH_SETTLE_MS = 5_000;
/** How long to wait for the website's create_inhouse_lobby command to show up before giving up — it's written synchronously at game creation, well before this process starts, so this is generous, not tight. */
const CREATE_COMMAND_WAIT_MS = 60_000;
/** How long after a launch to conclude the GC ignored it, so `!start` can be retried. Generous: a real launch reaches RUN within seconds. */
const LAUNCH_WATCHDOG_MS = 90_000;
/** Heartbeats (30s each) the GC may report no lobby before we believe it — see reconcileLobby. */
const LOBBY_MISSES_BEFORE_GONE = 2;
/**
 * How long a lobby with nobody on a playing slot stays open.
 *
 * The community owner's rule, and the website's primary complaint
 * (docs/lobby-bot-integration.md §5a): two empty lobbies once sat open for 62
 * and 16 hours, each holding one of five Steam accounts, which with
 * `maxOpenLobbies: 2` refused everyone in the community a lobby for the whole
 * time. A healthy bot keeping a dead lobby alive blocks hosting exactly as
 * effectively as a crashed one.
 *
 * Observers and the bot itself deliberately don't count — `computeSlots`
 * filters on PLAYING_SIDES, so a lobby holding nothing but spectators is empty
 * for this purpose.
 */
const EMPTY_LOBBY_CLOSE_MS = 5 * 60_000;
/**
 * How long a lobby with players actually seated survives with no slot movement
 * at all. Mirrors the website's own backstop threshold so the two agree; the
 * point of doing it here as well is that only this process can destroy the Dota
 * lobby, where the website can only write the game off in Firestore.
 */
const SEATED_IDLE_CLOSE_MS = 3 * 60 * 60_000;
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function nowIso() {
    return new Date().toISOString();
}
/** Steam32 → Steam64. Returns null for anything that isn't a plain account id. */
function toSteamId64(steamId32) {
    if (!steamId32 || !/^\d+$/.test(steamId32))
        return null;
    return (BigInt(steamId32) + 76561197960265728n).toString();
}
class InhouseRunner {
    db;
    gameId;
    botAccountId;
    store;
    game = null;
    dota = null;
    sessionLogic = null;
    banGuard = null;
    commandQueue = null;
    router = null;
    botSteamId32 = null;
    lobbyCreated = false;
    /**
     * True once this process has genuinely let go of the Dota lobby — left it, or
     * seen the GC destroy it.
     *
     * `dotaLobbyId` on the game document doubles as the Conductor's "a Dota lobby
     * may still be live" marker (conductor-hook's closeOrphanedLobbies), so it is
     * cleared on the way out only when this is true. A runner that dies still
     * holding a lobby must leave the marker standing.
     */
    lobbyReleased = false;
    /** Tracked ourselves — dota-client.js's 'lobbyCleared' carries no payload, unlike dota2-lobby-bot's own client. */
    lastKnownMatchId;
    matchStarted = false;
    webhookSecret;
    siteUrl;
    /** Bot token + guild for `!link <name>`. Unset degrades to the code flow. */
    discordToken;
    discordGuildId;
    countdownTimer = null;
    countdownTicks = [];
    launching = false;
    /** Recovers a launch the GC silently ignored — see armLaunchWatchdog. */
    launchWatchdog = null;
    heartbeatTimer = null;
    /** Consecutive heartbeats where the GC had no lobby for us — see reconcileLobby. */
    lobbyMisses = 0;
    /**
     * When the slot picture last actually changed — the clock both close rules in
     * checkLobbyLifetime run on.
     *
     * Seeded from the persisted `slotSnapshot.updatedAt` rather than from process
     * start, so a Conductor redeploy doesn't hand every dead lobby another five
     * minutes; a lobby that has been empty since yesterday is closed on the first
     * heartbeat after the restart, not five minutes into it.
     */
    lastSlotChangeMs = Date.now();
    /** Players on a playing slot as of that change. 0 means the lobby is empty. */
    playersSeated = 0;
    /** onSnapshot unsubscribe for the game doc — see watchGameDoc. */
    gameUnsub = null;
    finalizing = false;
    exitCode = 0;
    donePromiseResolve = null;
    constructor(db, gameId, botAccountId) {
        this.db = db;
        this.gameId = gameId;
        this.botAccountId = botAccountId;
        this.store = new store_1.InhouseStore(db);
        this.webhookSecret = process.env.INHOUSE_BOT_WEBHOOK_SECRET || null;
        this.siteUrl = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://dota2inhouse.pl';
        this.discordToken = process.env.DISCORD_TOKEN || null;
        this.discordGuildId = process.env.DISCORD_GUILD_ID || null;
    }
    // ─── Boot ────────────────────────────────────────────────────────────────
    async run() {
        const initial = await this.store.getGame(this.gameId);
        if (!initial) {
            logger_1.logger.error(`[InhouseRunner] Game ${this.gameId} not found — exiting`);
            return 1;
        }
        this.game = initial;
        // A game that ended without a runner alive to hear about it still leaves a
        // real Dota lobby behind — see closeOrphanedLobby. Only a game with no
        // lobby to its name is genuinely nothing to do.
        const alreadyOver = (0, types_1.isTerminal)(this.game.state);
        if (alreadyOver && !this.game.dotaLobbyId) {
            logger_1.logger.info(`[InhouseRunner] Game ${this.gameId} already ${this.game.state} — nothing to do`);
            return 0;
        }
        // "Empty since" survives the process: the slot snapshot the last runner
        // wrote is the honest start for the close clock (§5a).
        const seenAt = Date.parse(this.game.slotSnapshot?.updatedAt ?? this.game.createdAt);
        this.lastSlotChangeMs = Number.isFinite(seenAt) ? seenAt : Date.now();
        this.playersSeated = this.game.slotSnapshot?.inLobby.length ?? 0;
        const botSnap = await this.db.collection('botAccounts').doc(this.botAccountId).get();
        if (!botSnap.exists) {
            logger_1.logger.error(`[InhouseRunner] Bot account ${this.botAccountId} not found`);
            return 1;
        }
        const bot = botSnap.data();
        const username = process.env.STEAM_USERNAME || bot.username;
        const password = process.env.STEAM_PASSWORD ||
            (bot.encryptedPassword ? Buffer.from(bot.encryptedPassword, 'base64').toString('utf-8') : undefined);
        const sharedSecret = process.env.STEAM_GUARD_SHARED_SECRET || bot.steamGuardSharedSecret;
        if (!password) {
            logger_1.logger.error(`[InhouseRunner] Bot account ${this.botAccountId} has no usable password`);
            return 1;
        }
        logger_1.logger.info(`[InhouseRunner] game=${this.gameId} (#${this.game.gameNumber}) bot=${bot.displayName || username}`);
        this.dota = new dota_client_1.DotaClient({ username, password, steamGuardSharedSecret: sharedSecret });
        // Before wiring anything: this game is over, and the only reason we are
        // here is the lobby it left behind.
        if (alreadyOver)
            return this.closeOrphanedLobby();
        this.wireDotaEvents();
        await this.dota.connect();
        this.botSteamId32 = this.dota.getSelfSteamId32();
        logger_1.logger.info(`[InhouseRunner] Connected to Steam + Dota 2 GC (self=${this.botSteamId32 || 'unknown'})`);
        if (!this.botSteamId32) {
            logger_1.logger.error('[InhouseRunner] Could not resolve the bot\'s own Steam32 id — every slot/host calculation depends on excluding it. Exiting.');
            return 1;
        }
        this.banGuard = new ban_guard_1.BanGuard(this.store, {
            kick: (steamId32) => this.dota.kickPlayer(steamId32),
            announce: (message) => this.dota.sendChatMessage(message),
        });
        this.sessionLogic = new session_logic_1.InhouseSessionLogic(this.game, {
            store: this.store,
            banGuard: this.banGuard,
            kick: (steamId32) => this.dota.kickPlayer(steamId32),
            sendChatMessage: (message) => this.dota.sendChatMessage(message),
            botSteamId32: this.botSteamId32,
            onSlotsChanged: (updatedAt, playersSeated) => {
                const at = Date.parse(updatedAt);
                this.lastSlotChangeMs = Number.isFinite(at) ? at : Date.now();
                this.playersSeated = playersSeated;
            },
        });
        this.commandQueue = new command_queue_1.CommandQueue(this.db, this.botAccountId, this.gameId, {
            createInhouseLobby: (payload) => this.onCreateLobbyCommand(payload),
            invitePlayer: (steamId32) => this.dota.invitePlayer(steamId32),
            kickPlayer: (steamId32) => this.dota.kickPlayer(steamId32),
            sendChat: (message) => this.dota.sendChatMessage(message),
            endSession: (reason) => this.onEndSessionCommand(reason),
        });
        this.commandQueue.start();
        this.router = new chat_commands_1.LobbyCommandRouter(this.store, {
            reply: (message) => this.dota.sendChatMessage(message),
            startCountdown: (opts) => this.startCountdown(opts),
            cancelCountdown: () => this.cancelCountdown(),
            countdownRunning: () => this.countdownTimer !== null,
            isAdmin: (steamId32) => this.store.isAdmin({ steamId32 }),
            issueLinkCode: (steamId32, playerName) => (0, link_codes_1.issueLinkCode)(this.store, steamId32, playerName),
            linkByDiscordName: (steamId32, playerName, query) => this.linkByDiscordName(steamId32, playerName, query),
            linkInfo: (steamId32, playerName) => this.linkInfo(steamId32, playerName),
            siteUrl: this.siteUrl,
            lobbyPlayers: () => this.dota.getCurrentLobbyPlayers().map((p) => ({
                steamId32: p.steamId32,
                name: p.name,
                team: p.team,
                isSelf: p.steamId32 === this.botSteamId32,
            })),
            setGameMode: (mode) => this.dota.setGameMode(mode),
            kick: (steamId32) => this.dota.kickPlayer(steamId32),
            kickFromTeam: (steamId32) => this.dota.kickPlayerFromTeam(steamId32),
        });
        await this.claimAccountStatus();
        this.startHeartbeat();
        this.watchGameDoc();
        await this.reattachOrCreate();
        if (this.finalizing)
            return this.exitCode;
        await new Promise((resolve) => {
            this.donePromiseResolve = resolve;
        });
        return this.exitCode;
    }
    /**
     * Destroy a Dota lobby belonging to a game that is already over.
     *
     * The website writes a lobby off when our lease heartbeat goes stale, and
     * sends `end_inhouse_session` best-effort — but if the worker was down, there
     * was no runner to receive that command, and by the time the Conductor is
     * back the command has expired. The game document then says `expired` while
     * the Dota lobby is still sitting in the in-game browser under a name the
     * website is still showing people. That is the state
     * docs/lobby-bot-integration.md §5a calls "worse than the one it replaced",
     * and this process is the only party that can fix it.
     *
     * Deliberately one-shot. The account is released and `dotaLobbyId` cleared
     * whether or not the leave succeeded, because the Conductor rescans every 20
     * seconds and a cleanup that can retry forever is a Steam login loop.
     */
    async closeOrphanedLobby() {
        const lobbyId = this.game.dotaLobbyId;
        // The lobby we are about to destroy is identified by "whatever this account
        // is holding", so if the account has moved on to another game, that is
        // someone's live lobby and this must not touch it. Normally the lease is
        // null here — the website releases it when it expires a game — so only a
        // lease naming a *different* game is disqualifying.
        try {
            const acct = (await this.db.collection('botAccounts').doc(this.botAccountId).get()).data();
            if (acct?.leasedByGameId && acct.leasedByGameId !== this.gameId) {
                logger_1.logger.warn(`[InhouseRunner] Not closing lobby ${lobbyId}: account ${this.botAccountId} has since been ` +
                    `leased to game ${acct.leasedByGameId}`);
                // Drop the marker anyway, or the Conductor forks a runner for this game
                // on every tick from here on. Nothing is lost: that game's own runner
                // leaves any stale lobby it finds on the account before creating its
                // own, so responsibility for this one has simply passed to it.
                await this.store.updateGame(this.gameId, { dotaLobbyId: null }).catch(() => undefined);
                return 0;
            }
        }
        catch (error) {
            logger_1.logger.warn(`[InhouseRunner] Could not verify the lease on ${this.botAccountId} — not closing`, error);
            return 1;
        }
        logger_1.logger.warn(`[InhouseRunner] Game ${this.gameId} is '${this.game.state}' but still owns Dota lobby ` +
            `${lobbyId} — connecting to close it`);
        // Take the account off the market for the ~20 seconds this takes. The pool
        // is shared with the tournament Conductor, whose assignPendingSessions
        // hands out any account whose `status` is exactly 'idle' — and a cleanup
        // login is invisible to it otherwise, since this game holds no lease. Two
        // processes on one Steam account is LogonSessionReplaced and a crash loop
        // on both sides. releaseAccount at the end puts it back.
        await this.claimAccountStatus();
        let closed = false;
        try {
            await this.dota.connect();
            await sleep(REATTACH_SETTLE_MS);
            if (this.dota.hasLobby()) {
                this.dota.reattachToCachedLobby();
                await this.dota.leaveLobby();
                logger_1.logger.info(`[InhouseRunner] Orphaned lobby ${lobbyId} destroyed (game ${this.gameId})`);
            }
            else {
                logger_1.logger.info(`[InhouseRunner] Lobby ${lobbyId} is already gone from the GC — nothing to close`);
            }
            closed = true;
        }
        catch (error) {
            logger_1.logger.error(`[InhouseRunner] Could not close orphaned lobby ${lobbyId} for game ${this.gameId} — it may ` +
                `still be listed in Dota's lobby browser. This is not retried; close it by hand if it is.`, error);
        }
        try {
            await this.store.updateGame(this.gameId, { dotaLobbyId: null });
        }
        catch (error) {
            logger_1.logger.warn(`[InhouseRunner] Could not clear dotaLobbyId on game ${this.gameId}`, error);
        }
        try {
            await (0, lease_1.releaseAccount)(this.db, this.botAccountId);
        }
        catch (error) {
            logger_1.logger.warn(`[InhouseRunner] Failed to release account ${this.botAccountId}`, error);
        }
        try {
            await this.dota.disconnect();
        }
        catch {
            /* ignore */
        }
        return closed ? 0 : 1;
    }
    // ─── Lobby create / reattach ────────────────────────────────────────────────
    async reattachOrCreate() {
        await sleep(REATTACH_SETTLE_MS);
        const dota = this.dota;
        const ourLobby = this.game.dotaLobbyId;
        if (dota.hasLobby()) {
            if (ourLobby) {
                const id = dota.reattachToCachedLobby();
                logger_1.logger.info(`[InhouseRunner] Reattached to existing lobby ${id} (game state=${this.game.state})`);
                this.lobbyCreated = true;
                if (this.game.state === 'in_progress')
                    this.matchStarted = true;
                return;
            }
            logger_1.logger.warn('[InhouseRunner] A stale cached lobby exists on this account — leaving it before creating a fresh one');
            try {
                await dota.leaveLobby();
            }
            catch (e) {
                logger_1.logger.warn('[InhouseRunner] Failed to leave stale lobby', e);
            }
        }
        else if (ourLobby) {
            logger_1.logger.warn(`[InhouseRunner] Game expected lobby ${ourLobby} but the GC cache is empty — recreating`);
        }
        // No lobby yet — wait for the create_inhouse_lobby command the website
        // already queued at game creation, well before this process started. In
        // the normal case this resolves on the very first poll.
        const deadline = Date.now() + CREATE_COMMAND_WAIT_MS;
        while (!this.lobbyCreated && Date.now() < deadline && !this.finalizing) {
            await this.commandQueue.pollNow();
            if (!this.lobbyCreated && !this.finalizing)
                await sleep(2_000);
        }
        if (!this.lobbyCreated && !this.finalizing) {
            // Ending the process is not enough: the Conductor decides whether to
            // respawn by re-reading the game, so giving up without a terminal state
            // spins forever — runner starts, waits the full timeout, releases the
            // account, gets replaced, repeats. Seen in production burning a
            // tournament account on an ~80s cycle.
            //
            // Which ending depends on whether a lobby ever existed. A game that
            // already carries a dotaLobbyId had one and lost it — the players closed
            // it, and `cancelled` is what happened from their point of view. A game
            // that never had one never got off the ground, which is `failed`.
            const hadLobby = Boolean(this.game?.dotaLobbyId);
            // Either way there is no lobby on this account now: `hadLobby` got here
            // by the GC cache being empty, and the other branch never made one.
            this.lobbyReleased = true;
            logger_1.logger.error(`[InhouseRunner] No lobby for game ${this.gameId} after ${CREATE_COMMAND_WAIT_MS}ms ` +
                `(${hadLobby ? 'previous lobby is gone from the GC' : 'no create_inhouse_lobby command arrived'}) — giving up`);
            await this.finishUp(1, hadLobby ? 'cancelled' : 'failed', hadLobby ? 'Lobby zostało zamknięte' : 'Nie udało się utworzyć lobby');
        }
    }
    /** Hooked into CommandQueue — idempotent, so a duplicate/retried command is safe. */
    async onCreateLobbyCommand(payload) {
        if (this.lobbyCreated || this.finalizing)
            return;
        const game = this.game;
        // The website assigns the lobby name/password before enqueuing this
        // command, nested under `lobby`. A worker that generates its own sends
        // every player looking for a lobby that doesn't exist under that name —
        // only fall back to generating when both the payload and the document
        // are empty.
        const lobbyName = payload.lobby?.name || payload.lobbyName || game.lobbyName || `inhouse-${game.gameNumber}`;
        const lobbyPassword = payload.lobby?.password ||
            payload.lobbyPassword ||
            game.lobbyPassword ||
            String(Math.floor(1000 + Math.random() * 9000));
        if (!game.settings.leagueId) {
            logger_1.logger.warn(`[InhouseRunner] Game ${this.gameId} has no leagueId configured — the match will NOT be ` +
                `publicly retrievable, so attendance, match pages and awards will be empty.`);
        }
        await this.store.transitionState(this.gameId, 'lobby_creating', { botAccountId: this.botAccountId });
        const settings = (0, lobby_settings_1.toInhouseLobbySettings)(game.settings, game.published);
        const created = await this.createLobbyResilient({ name: lobbyName, password: lobbyPassword, ...settings });
        if (!created)
            return; // exhausted retries — createLobbyResilient already tore the process down
        const dotaLobbyId = this.dota.getCurrentLobbyId() || 'pending';
        logger_1.logger.info(`[InhouseRunner] Lobby created (${dotaLobbyId}) "${lobbyName}" for game ${this.gameId}`);
        await this.store.updateGame(this.gameId, {
            dotaLobbyId,
            botAccountId: this.botAccountId,
            ...(game.lobbyName === lobbyName ? {} : { lobbyName }),
            ...(game.lobbyPassword === lobbyPassword ? {} : { lobbyPassword }),
        });
        await this.store.transitionState(this.gameId, 'open');
        await this.sessionLogic.refresh();
        this.game = this.sessionLogic.current;
        // A brand new lobby is empty, and it is empty from *now* — not from
        // whenever the website created the game document, which may have been
        // several minutes ago if the account pool was busy.
        this.lastSlotChangeMs = Date.now();
        this.playersSeated = 0;
        this.lobbyCreated = true;
    }
    /**
     * Retry createLobby up to 4 attempts with backoff — node-dota2's
     * createPracticeLobby can time out or hit Valve's per-account rate limit,
     * and a single failure would otherwise strand the game forever. Mirrors
     * dist/runner.js's createLobbyResilient exactly.
     *
     * On total failure this exits the process non-zero. In M1 (no Conductor)
     * that just ends the manual test run; M3's Conductor integration respawns
     * with a clean GC session the same way it already does for tournaments.
     */
    async createLobbyResilient(opts) {
        const attempts = 4;
        let lastErr;
        const dota = this.dota;
        for (let i = 1; i <= attempts && !this.finalizing; i++) {
            if (dota.getCurrentLobbyId()) {
                logger_1.logger.warn(`[InhouseRunner] Still in a lobby before create (attempt ${i}/${attempts}) — leaving it first`);
                try {
                    await dota.leaveLobby();
                }
                catch {
                    /* best-effort */
                }
                await sleep(2_500);
            }
            try {
                await dota.createLobby(opts);
                if (i > 1)
                    logger_1.logger.info(`[InhouseRunner] Lobby created on attempt ${i}/${attempts}`);
                return true;
            }
            catch (e) {
                lastErr = e;
                const backoff = Math.min(15_000, 3_000 * i);
                logger_1.logger.warn(`[InhouseRunner] createLobby attempt ${i}/${attempts} failed: ${e?.message || e} — retrying in ${backoff}ms`);
                await sleep(backoff);
            }
        }
        if (this.finalizing)
            return false;
        logger_1.logger.error(`[InhouseRunner] createLobby failed after ${attempts} attempts (${lastErr?.message || lastErr}) — exiting`);
        await this.finishUp(1);
        return false;
    }
    // ─── Event wiring ───────────────────────────────────────────────────────────
    wireDotaEvents() {
        const dota = this.dota;
        dota.on('lobbyUpdate', (data) => {
            if (data.matchId)
                this.lastKnownMatchId = data.matchId;
            if (!this.matchStarted && data.state === LOBBY_STATE.RUN && data.matchId) {
                this.matchStarted = true;
                void this.onMatchStarted(Number(data.matchId)).catch((e) => logger_1.logger.error('[InhouseRunner] onMatchStarted failed', e));
            }
            // Launched, then everybody was put back in the lobby — the failed-to-connect
            // case. The flag is cleared here, synchronously, so a burst of updates can
            // only ever trigger one recovery.
            else if (this.matchStarted && data.state === LOBBY_STATE.UI && !this.finalizing) {
                this.matchStarted = false;
                void this.onLaunchAborted().catch((e) => logger_1.logger.error('[InhouseRunner] onLaunchAborted failed', e));
            }
            if (this.sessionLogic) {
                void this.sessionLogic.onLobbyUpdate(data.players).catch((e) => logger_1.logger.error('[InhouseRunner] onLobbyUpdate failed', e));
            }
        });
        dota.on('chatMessage', (msg) => {
            void this.onChatMessage(msg).catch((e) => logger_1.logger.error('[InhouseRunner] onChatMessage failed', e));
        });
        dota.on('lobbyCleared', () => {
            void this.onLobbyCleared().catch((e) => logger_1.logger.error('[InhouseRunner] onLobbyCleared failed', e));
        });
        dota.on('disconnected', (reason) => {
            logger_1.logger.warn(`[InhouseRunner] Steam disconnected: ${reason}`);
        });
        dota.on('gcReconnected', () => {
            logger_1.logger.info('[InhouseRunner] GC session regained');
        });
        dota.on('gcUnready', () => {
            logger_1.logger.warn('[InhouseRunner] GC session lost — node-dota2 is retrying');
        });
    }
    async onChatMessage(msg) {
        if (this.finalizing || !this.sessionLogic || !this.router)
            return;
        await this.sessionLogic.refresh();
        this.game = this.sessionLogic.current;
        await this.router.handle(this.game, msg.steamId32, msg.playerName, msg.message);
    }
    async onMatchStarted(matchId) {
        this.clearCountdown();
        logger_1.logger.info(`[InhouseRunner] Match ${matchId} started for game ${this.gameId}`);
        await this.sessionLogic.onMatchStarted(matchId);
        this.game = this.sessionLogic.current;
    }
    /**
     * The game launched and then dropped everyone back into the lobby.
     *
     * Dota does this whenever somebody fails to load in: the match is abandoned
     * before it counts, and the lobby is handed back intact. Nothing else notices.
     * Left alone the runner would sit in a state that quietly poisons the next
     * attempt — `matchStarted` latched on, so the retry's real match id would
     * never be recorded and the aborted one would be reported to the website
     * instead; the game stuck at `in_progress` and `locked`; and a lobby that is
     * closed later looking, to `onLobbyCleared`, like a match that was played.
     *
     * So all three are unwound. The chat line matters as much as the unwinding:
     * from inside Dota this looks like the bot died, and somebody has to be told
     * both that a retry is expected of them and who is allowed to call it.
     */
    async onLaunchAborted() {
        this.clearCountdown();
        this.launching = false;
        this.lastKnownMatchId = undefined;
        logger_1.logger.warn(`[InhouseRunner] Game ${this.gameId} returned to the lobby after launching — ` +
            `treating it as an aborted start and unlocking for a retry`);
        try {
            await this.store.transitionState(this.gameId, 'ready', { dotaMatchId: null });
        }
        catch (error) {
            logger_1.logger.warn(`[InhouseRunner] Could not move game ${this.gameId} back out of in_progress`, error);
        }
        await this.unlockAfterFailedLaunch();
        await this.dota
            ?.sendChatMessage(`Mecz nie wystartował — ktoś się nie połączył i wróciliście do lobby. ` +
            `${this.game ? (0, chat_commands_1.hostLine)(this.game) : ''} Sprawdźcie sloty i !start jeszcze raz.`)
            .catch(() => undefined);
    }
    /**
     * The GC destroyed the lobby. dota-client.js's 'lobbyCleared' carries no
     * payload (unlike dota2-lobby-bot's own DotaClient), so whether a match was
     * actually played is read from `lastKnownMatchId`, captured from the most
     * recent 'lobbyUpdate' before the clear. Without a match id, nothing was
     * played — the lobby was destroyed some other way (bot kicked, host
     * cancelled, timed out before launch) — and guessing a result here would be
     * wrong, so this just tears the runner down.
     */
    async onLobbyCleared() {
        if (this.finalizing)
            return;
        this.lobbyReleased = true; // the GC destroyed it; there is nothing left to close
        const matchId = this.lastKnownMatchId;
        if (!matchId) {
            // Nobody else will ever close this out. The website's ingest cron only
            // sweeps games that reached a played state, and no match id means no
            // result is coming, so leaving the state alone leaves the game listed as
            // open on the site forever — with its Steam account leased to it. The
            // runner is the only party that knows the lobby is gone, so it has to say so.
            logger_1.logger.info(`[InhouseRunner] Lobby for game ${this.gameId} closed before any match started — cancelling the game`);
            await this.finishUp(0, 'cancelled', 'Lobby zostało zamknięte przed startem meczu');
            return;
        }
        logger_1.logger.info(`[InhouseRunner] Match ${matchId} ended for game ${this.gameId} — handing off to the website`);
        try {
            await this.store.updateGame(this.gameId, { dotaMatchId: Number(matchId) });
        }
        catch (error) {
            logger_1.logger.error(`[InhouseRunner] Could not write dotaMatchId ${matchId} for game ${this.gameId} — the ` +
                `website has no way to find this match now`, error);
        }
        try {
            await (0, match_webhook_1.notifyMatchFinished)({ siteUrl: this.siteUrl, secret: this.webhookSecret }, { gameId: this.gameId, dotaMatchId: Number(matchId) });
        }
        catch (error) {
            logger_1.logger.error(`[InhouseRunner] Match webhook failed for game ${this.gameId}`, error);
        }
        await this.finishUp(0);
    }
    async onEndSessionCommand(reason) {
        // The website has already moved the game to a terminal state before
        // sending this — leave the lobby and release the account, don't
        // transition state ourselves.
        logger_1.logger.info(`[InhouseRunner] end_inhouse_session for game ${this.gameId}: ${reason ?? 'no reason given'}`);
        await this.releaseLobby();
        await this.finishUp(0);
    }
    /**
     * Leave the Dota lobby, recording whether we actually managed to.
     *
     * The distinction is the whole point: "the game is over" and "the lobby is
     * gone" are different facts, and only the second one makes it safe to stop
     * tracking the lobby (see `lobbyReleased`).
     */
    async releaseLobby() {
        if (!this.dota)
            return;
        try {
            await this.dota.leaveLobby();
            this.lobbyReleased = true;
        }
        catch (error) {
            logger_1.logger.warn(`[InhouseRunner] Failed to leave the lobby for game ${this.gameId}`, error);
        }
    }
    // ─── Linking ────────────────────────────────────────────────────────────────
    /**
     * `!link <discord name>` — resolve the name on the guild and link on the spot.
     *
     * Every failure returns a line the player can act on, because this runs in
     * lobby chat where "something went wrong" is useless. The refusals that
     * matter:
     *
     *   ambiguous  — two people answer to that name. Guessing would attach a
     *                stranger's history to this Steam account, so it is refused
     *                and the candidates are shown.
     *   claimed    — this Steam account already belongs to a different Discord
     *                profile. Silently reassigning would move someone's whole
     *                history, so `linkSteamAccount` refuses and so do we.
     */
    async linkByDiscordName(steamId32, playerName, query) {
        const lookup = await (0, discord_lookup_1.findGuildMember)({ token: this.discordToken, guildId: this.discordGuildId }, query);
        if (!lookup.ok) {
            if (lookup.reason === 'ambiguous') {
                return {
                    message: `${playerName}: kilka osób pasuje do "${query}" (${lookup.candidates.join(', ')}) — podaj dokładniejszy nick.`,
                };
            }
            if (lookup.reason === 'not_found') {
                return { message: `${playerName}: nie znalazłem nikogo o nicku "${query}" na Discordzie.` };
            }
            if (lookup.reason === 'not_configured') {
                const base = this.siteUrl.replace(/\/+$/, '');
                return {
                    message: `${playerName}: łączenie po nicku jest niedostępne — wpisz !link i użyj kodu na ${base}/inhouse/link`,
                };
            }
            return { message: `${playerName}: nie udało się sprawdzić Discorda — spróbuj za chwilę.` };
        }
        const { discordId, displayName } = lookup.match;
        const link = await this.store.linkSteamAccount(discordId, steamId32, 'manual', displayName);
        if (!link.ok && link.reason === 'claimed_by_other') {
            return {
                message: `${playerName}: to konto Steam jest już przypisane do innego profilu Discord.`,
            };
        }
        if (link.alreadyLinked) {
            return { message: `${playerName}: to konto jest już połączone z ${displayName}.` };
        }
        // The payoff, and the reason linking is worth doing at all: every inhouse
        // is on record whether or not the player ever linked, so the history is
        // waiting for them the moment they do.
        let found = 0;
        try {
            found = (await (0, attendance_1.backfillOnLink)(this.store, discordId, steamId32)).gamesFound;
        }
        catch (error) {
            logger_1.logger.warn(`[InhouseRunner] Backfill failed for ${discordId}/${steamId32}`, error);
        }
        logger_1.logger.info(`[InhouseRunner] Linked steam ${steamId32} → discord ${discordId} (${displayName})`);
        return {
            message: found
                ? `${playerName}: połączono z ${displayName} — znaleźliśmy ${found} twoich wcześniejszych gier.`
                : `${playerName}: połączono z ${displayName}.`,
        };
    }
    /**
     * `!link-info` — which Discord profile owns this Steam account?
     *
     * Resolved through findPlayerBySteamId, which matches with array-contains,
     * so it answers correctly from any of the person's alts rather than only
     * their primary.
     */
    async linkInfo(steamId32, playerName) {
        let player;
        try {
            player = await this.store.findPlayerBySteamId(steamId32);
        }
        catch (error) {
            logger_1.logger.warn(`[InhouseRunner] link-info lookup failed for ${steamId32}`, error);
            return { message: `${playerName}: nie udało się sprawdzić — spróbuj za chwilę.` };
        }
        if (!player) {
            return {
                message: `${playerName}: to konto nie jest połączone — wpisz !link <twój nick z Discorda>`,
            };
        }
        const name = player.discordName || player.discordId;
        const parts = [`połączony z ${name}`];
        // Only worth saying when there is more than one — the common case is one
        // account and the extra clause is noise.
        if (player.steamIds.length > 1)
            parts.push(`${player.steamIds.length} konta Steam`);
        parts.push(`${player.gamesPlayed} gier`);
        return { message: `${playerName}: ${parts.join(' · ')}` };
    }
    // ─── Countdown and launch ───────────────────────────────────────────────────
    clearCountdown() {
        if (this.countdownTimer)
            clearTimeout(this.countdownTimer);
        this.countdownTimer = null;
        for (const t of this.countdownTicks)
            clearTimeout(t);
        this.countdownTicks = [];
        if (this.launchWatchdog)
            clearTimeout(this.launchWatchdog);
        this.launchWatchdog = null;
    }
    cancelCountdown() {
        if (!this.countdownTimer)
            return false;
        this.clearCountdown();
        return true;
    }
    async startCountdown(opts) {
        if (this.countdownTimer || this.launching)
            return;
        const seconds = Math.max(5, this.game?.settings.startCountdownSeconds ?? 30);
        await this.dota.sendChatMessage(`${opts.byName} started the game. Launching in ${seconds}s — !cancel to abort.`);
        for (const at of [20, 10, 5].filter((t) => t < seconds)) {
            this.countdownTicks.push(setTimeout(() => void this.dota.sendChatMessage(`${at}...`).catch(() => undefined), (seconds - at) * 1000));
        }
        this.countdownTimer = setTimeout(() => void this.launch(opts.force), seconds * 1000);
    }
    async launch(force) {
        this.clearCountdown();
        if (this.launching)
            return;
        this.launching = true;
        try {
            const slots = await this.store.getSlots(this.gameId);
            if (!force && !slots.ready) {
                await this.dota.sendChatMessage('Someone left — start cancelled.');
                this.launching = false;
                return;
            }
            // Even a forced start needs somebody on an actual team slot. The GC
            // silently DISCARDS launchPracticeLobby when radiant and dire are both
            // empty — no error, no ack, no state change — so without this check a
            // force-start from the unassigned player pool looks like it worked while
            // nothing happens. `fillWithBots` does not rescue this: bots fill empty
            // team slots, they don't seat the humans standing in the pool.
            if (slots.radiant.length === 0 && slots.dire.length === 0) {
                await this.dota.sendChatMessage('Nobody is on Radiant or Dire — take a team slot (not the unassigned pool), then !start.');
                this.launching = false;
                return;
            }
            await this.store.updateGame(this.gameId, { locked: true });
            await this.dota.startGame();
            logger_1.logger.info(`[InhouseRunner] Game ${this.gameId} launch initiated (force=${force})`);
            this.armLaunchWatchdog();
        }
        catch (error) {
            this.launching = false;
            await this.unlockAfterFailedLaunch();
            logger_1.logger.error(`[InhouseRunner] Launch failed for game ${this.gameId}`, error);
            await this.dota.sendChatMessage(`Nie udało się wystartować — spróbujcie !start jeszcze raz. ${this.game ? (0, chat_commands_1.hostLine)(this.game) : ''}`).catch(() => undefined);
        }
    }
    /**
     * Recover from a launch the GC accepted but never acted on.
     *
     * `launchPracticeLobby` is fire-and-forget by design (its ack is unreliable —
     * see dota-client.js), so the only evidence a launch actually took is the
     * lobby moving to RUN with a match id. If that never arrives, `launching`
     * would stay true for the life of the process and every later `!start` would
     * silently no-op, with the lobby left locked. Unwind both so the players can
     * simply try again.
     */
    armLaunchWatchdog() {
        if (this.launchWatchdog)
            clearTimeout(this.launchWatchdog);
        this.launchWatchdog = setTimeout(() => {
            this.launchWatchdog = null;
            if (this.matchStarted || this.finalizing)
                return;
            logger_1.logger.warn(`[InhouseRunner] Game ${this.gameId}: launch sent ${LAUNCH_WATCHDOG_MS / 1000}s ago but the ` +
                `match never started — unlocking so !start can be retried`);
            this.launching = false;
            void this.unlockAfterFailedLaunch();
            void this.dota
                ?.sendChatMessage(`Gra nie wystartowała. Sprawdźcie, czy wszyscy siedzą na slotach, i !start jeszcze raz. ` +
                `${this.game ? (0, chat_commands_1.hostLine)(this.game) : ''}`)
                .catch(() => undefined);
        }, LAUNCH_WATCHDOG_MS);
    }
    async unlockAfterFailedLaunch() {
        try {
            await this.store.updateGame(this.gameId, { locked: false });
            await this.sessionLogic?.refresh();
            if (this.sessionLogic)
                this.game = this.sessionLogic.current;
        }
        catch (e) {
            logger_1.logger.warn(`[InhouseRunner] Could not unlock game ${this.gameId} after a failed launch`, e);
        }
    }
    // ─── Heartbeat / lease ──────────────────────────────────────────────────────
    /**
     * Mark the account busy in the field the TOURNAMENT side reads.
     *
     * The two systems track busy-ness differently: inhouses use
     * leasedByGameId + leaseHeartbeatAt, tournaments use
     * busyWithSessionId + a `status` that must be exactly 'idle' for
     * assignPendingSessions to consider an account free. A runner that only
     * renews the lease is invisible to that filter, so the Conductor could hand
     * this same account to a tournament match mid-inhouse — a duplicate Steam
     * login that crash-loops both sides.
     *
     * The website's leaseAccount already sets 'assigned' before we start, so in
     * the normal flow this is a no-op; it exists for every other entry point
     * (manual --bot-id, a respawn after the status was cleared elsewhere).
     */
    async claimAccountStatus() {
        try {
            await this.db.collection('botAccounts').doc(this.botAccountId).update({
                status: 'assigned',
                // Omitted rather than nulled when unknown — this also runs before login
                // on the orphan-cleanup path, and blanking a good id would undo the
                // whole point of writing it.
                ...(this.botSteamId32 ? { steamId32: this.botSteamId32 } : {}),
                // §5a(6): the pool ships with these empty, so the website has to take
                // "the bot is never in a player slot" on trust. Written here rather
                // than at provisioning because this is the only place the account's own
                // Steam id is known for certain — it comes back from the logged-in GC
                // session, not from configuration.
                ...(toSteamId64(this.botSteamId32) ? { steamId: toSteamId64(this.botSteamId32) } : {}),
                updatedAt: new Date().toISOString(),
            });
        }
        catch (e) {
            logger_1.logger.warn(`[InhouseRunner] Could not mark ${this.botAccountId} assigned`, e);
        }
    }
    /**
     * React to the game being ended from outside this process.
     *
     * The host cancelling on the website, an admin force-releasing the bot
     * account, or the website's stuck-game sweeper all just write a terminal
     * state to the document — they do not, and should not, need to reach this
     * process. `end_inhouse_session` covers the same ground but is explicitly
     * best-effort in the contract, so relying on it alone leaves a runner
     * holding a live lobby and a leased Steam account indefinitely for a game
     * everyone else considers over. The tournament runner watches its session
     * doc for exactly this reason; this is the inhouse equivalent.
     */
    watchGameDoc() {
        this.gameUnsub = this.db
            .collection('inhouseGames')
            .doc(this.gameId)
            .onSnapshot((snap) => {
            if (!snap.exists || this.finalizing)
                return;
            const next = snap.data();
            if (!(0, types_1.isTerminal)(next.state))
                return;
            logger_1.logger.warn(`[InhouseRunner] Game ${this.gameId} was moved to '${next.state}' externally — leaving the lobby`);
            void (async () => {
                await this.releaseLobby();
                await this.finishUp(0);
            })();
        }, (err) => logger_1.logger.error(`[InhouseRunner] Game watch failed for ${this.gameId}`, err));
    }
    startHeartbeat() {
        const beat = async () => {
            try {
                await (0, lease_1.renewLease)(this.db, this.botAccountId, this.gameId);
            }
            catch (e) {
                logger_1.logger.warn(`[InhouseRunner] Failed to renew lease on ${this.botAccountId}`, e);
            }
            // Order matters: a lobby that is already gone is not a lobby to close.
            if (this.reconcileLobby())
                return;
            await this.checkLobbyLifetime();
        };
        this.heartbeatTimer = setInterval(() => void beat(), HEARTBEAT_MS);
        void beat();
    }
    /**
     * Notice that our lobby is gone even when no event told us so.
     *
     * The lease heartbeat above proves this *process* is alive; it says nothing
     * about the lobby. Seen in production: a runner sat renewing its lease for
     * ten minutes with the game still showing `open` on the website and a
     * tournament account leased to it, long after the lobby had disappeared —
     * because 'lobbyCleared' never arrived. It is emitted from node-dota2's
     * `practiceLobbyCleared`, which needs a live GC session to be delivered; lose
     * the session at the wrong moment and the notification is simply missed, with
     * nothing to re-deliver it.
     *
     * So the heartbeat also reconciles belief against the GC's shared-object
     * cache, which is authoritative and survives reconnects. Two consecutive
     * misses rather than one, and only while the GC session is actually up, keeps
     * an ordinary reconnect blip from tearing down a perfectly good lobby.
     */
    reconcileLobby() {
        if (this.finalizing || !this.lobbyCreated || !this.dota)
            return false;
        if (!this.dota.isConnected) {
            this.lobbyMisses = 0; // GC is down; its cache tells us nothing right now.
            return false;
        }
        if (this.dota.hasLobby()) {
            this.lobbyMisses = 0;
            return false;
        }
        this.lobbyMisses += 1;
        if (this.lobbyMisses < LOBBY_MISSES_BEFORE_GONE) {
            logger_1.logger.warn(`[InhouseRunner] Lobby for game ${this.gameId} is missing from the GC cache ` +
                `(${this.lobbyMisses}/${LOBBY_MISSES_BEFORE_GONE}) — confirming before ending the game`);
            return false;
        }
        logger_1.logger.warn(`[InhouseRunner] Lobby for game ${this.gameId} is gone and no lobbyCleared event arrived — ` +
            `ending the game so the website and the account pool stop waiting on it`);
        void this.onLobbyCleared().catch((e) => logger_1.logger.error('[InhouseRunner] Reconciled lobby teardown failed', e));
        return true;
    }
    /**
     * Slots held by someone who pressed Join and hasn't walked in yet.
     *
     * `expiresAt` is re-checked here rather than trusting the array to have been
     * pruned. An empty lobby produces no GC events, so nothing rewrites
     * `slotSnapshot` at the moment a reservation lapses — left untested, one
     * stale entry would hold a dead lobby open forever, which is the failure this
     * whole mechanism exists to prevent.
     */
    heldSlots(now = Date.now()) {
        const reserved = this.game?.slotSnapshot?.reserved;
        if (!reserved?.length)
            return 0;
        return reserved.filter((r) => {
            const until = Date.parse(r.expiresAt ?? '');
            return Number.isFinite(until) && until > now;
        }).length;
    }
    /**
     * Close a lobby nobody is using — the five-minute rule (§5a).
     *
     * Runs off `lastSlotChangeMs`, which moves only when the slot picture really
     * moves (see session-logic's two fingerprints). That is the whole mechanism:
     * anything that touches the clock without the lobby actually changing —
     * a heartbeat, a name refresh — resets it on every pass and no empty lobby
     * ever closes again.
     *
     * Two thresholds, one clock. Empty means nobody on radiant/dire/unassigned:
     * spectators and the bot are already excluded upstream by PLAYING_SIDES, so a
     * lobby holding nothing but observers correctly counts as empty here.
     */
    async checkLobbyLifetime() {
        if (this.finalizing || !this.lobbyCreated || !this.dota)
            return;
        // A start is in flight — the slots aren't moving because the game is about
        // to launch, which is the opposite of an abandoned lobby.
        if (this.launching || this.countdownTimer)
            return;
        // Read the state rather than trusting the cached copy: `this.game` is only
        // refreshed by the events that touch it, and open↔ready flips under a
        // filling lobby. A failed read is not evidence that a lobby is dead.
        try {
            await this.sessionLogic.refresh();
            this.game = this.sessionLogic.current;
        }
        catch (error) {
            logger_1.logger.warn(`[InhouseRunner] Could not re-read game ${this.gameId} for the idle check`, error);
            return;
        }
        if (this.game.state !== 'open' && this.game.state !== 'ready')
            return;
        const idleMs = Date.now() - this.lastSlotChangeMs;
        const empty = this.playersSeated === 0;
        // A live reservation holds the lobby open, mirroring the website's own rule
        // (their sweep.ts `heldSlots`, answering the question our reply asked).
        // Both clocks are five minutes, so without this they race: someone presses
        // Join on an empty lobby, the site tells them their slot is held for five
        // minutes, and we close the lobby underneath them while they load Dota. We
        // are the side that actually destroys the lobby, so we are the side that
        // must not.
        if (empty && this.heldSlots() > 0)
            return;
        if (idleMs < (empty ? EMPTY_LOBBY_CLOSE_MS : SEATED_IDLE_CLOSE_MS))
            return;
        const minutes = Math.round(idleMs / 60_000);
        logger_1.logger.info(`[InhouseRunner] Closing game ${this.gameId}: ${empty ? 'empty' : `${this.playersSeated} seated, no slot activity`} ` +
            `for ${minutes} min`);
        await this.dota
            .sendChatMessage(empty
            ? 'Nikogo tu nie ma od dłuższej chwili — zamykam lobby.'
            : 'W lobby nic się nie dzieje od kilku godzin — zamykam je.')
            .catch(() => undefined);
        // The lobby has to actually be destroyed, not merely written off: a lobby
        // the website has forgotten but Dota still lists is worse than one it
        // knows about.
        await this.releaseLobby();
        await this.finishUp(0, 'expired', empty ? `Puste lobby przez ${minutes} min` : `Brak aktywności w lobby przez ${minutes} min`);
    }
    // ─── Teardown ────────────────────────────────────────────────────────────────
    /**
     * Leave the lobby, disconnect, release the account, and resolve run().
     *
     * M1 always releases the account on any finish — there is no Conductor yet
     * to distinguish a clean finish from a crash worth respawning with the same
     * lease, the way dist/runner.js's finishUp does for tournaments. A `kill -9`
     * bypasses this entirely (that's the point of the crash/reattach test), so
     * the lease is only ever released here on a graceful path. M3 should revisit
     * this once the Conductor can actually respawn with the same account.
     */
    async finishUp(exitCode, endState, endReason) {
        if (this.finalizing)
            return;
        this.finalizing = true;
        this.exitCode = exitCode;
        // Before releasing the account, not after. The Conductor decides whether an
        // exit was a finish or a crash by re-reading the game, so a game that is
        // still non-terminal when this process dies gets a replacement runner —
        // which would open a second lobby. Writing the state first closes that gap.
        // transitionState refuses to overwrite an already-terminal state, so the
        // website winning the race (or watchGameDoc having fired) is a no-op here.
        if (endState) {
            try {
                await this.store.transitionState(this.gameId, endState, {
                    endedAt: new Date().toISOString(),
                    ...(endReason ? { endReason } : {}),
                });
            }
            catch (e) {
                logger_1.logger.error(`[InhouseRunner] Could not mark game ${this.gameId} as ${endState} — the website will ` +
                    `keep showing it as live until its sweeper catches it`, e);
            }
        }
        // Only once the lobby is genuinely gone — see `lobbyReleased`. Left set,
        // the Conductor's orphan sweep picks the lobby up and closes it; cleared
        // early, nobody ever does and it stays listed in Dota's lobby browser.
        if (this.lobbyReleased) {
            try {
                await this.store.updateGame(this.gameId, { dotaLobbyId: null });
            }
            catch (e) {
                logger_1.logger.warn(`[InhouseRunner] Could not clear dotaLobbyId on game ${this.gameId}`, e);
            }
        }
        if (this.heartbeatTimer)
            clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
        this.clearCountdown();
        this.commandQueue?.stop();
        this.sessionLogic?.stop();
        if (this.gameUnsub) {
            try {
                this.gameUnsub();
            }
            catch {
                /* ignore */
            }
            this.gameUnsub = null;
        }
        try {
            await (0, lease_1.releaseAccount)(this.db, this.botAccountId);
        }
        catch (e) {
            logger_1.logger.warn(`[InhouseRunner] Failed to release account ${this.botAccountId}`, e);
        }
        try {
            if (this.dota)
                await this.dota.disconnect();
        }
        catch {
            /* ignore */
        }
        logger_1.logger.info(`[InhouseRunner] Finished game ${this.gameId} (exit ${exitCode})`);
        if (this.donePromiseResolve)
            this.donePromiseResolve();
    }
    /** Graceful shutdown path — SIGINT/SIGTERM. Disconnects without releasing the account or touching game state, since the process may simply be restarting. */
    async shutdown() {
        if (this.heartbeatTimer)
            clearInterval(this.heartbeatTimer);
        this.clearCountdown();
        this.commandQueue?.stop();
        this.sessionLogic?.stop();
        try {
            if (this.dota)
                await this.dota.disconnect();
        }
        catch {
            /* ignore */
        }
    }
}
exports.InhouseRunner = InhouseRunner;
