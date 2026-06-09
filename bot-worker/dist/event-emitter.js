"use strict";
// bot-worker/src/event-emitter.ts
// Emits structured events back to Firestore for the Next.js orchestrator to process
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventBridge = void 0;
const logger_js_1 = require("./logger.js");
/**
 * Bridges DotaClient events → Firestore event documents.
 * The orchestrator (Next.js API) polls these events and updates lobby sessions.
 */
class EventBridge {
    db;
    botAccountId;
    dotaClient;
    heartbeatIntervalMs;
    heartbeatInterval = null;
    currentSessionId = null;
    previousPlayers = new Map();
    gameDetected = false;
    gameEndEmitted = false;
    constructor(db, botAccountId, dotaClient, heartbeatIntervalMs = 30000) {
        this.db = db;
        this.botAccountId = botAccountId;
        this.dotaClient = dotaClient;
        this.heartbeatIntervalMs = heartbeatIntervalMs;
    }
    /**
     * Start listening to Dota 2 client events and bridging them to Firestore
     */
    start(sessionId) {
        this.currentSessionId = sessionId || null;
        // Lobby state updates
        this.dotaClient.on('lobbyUpdate', (data) => {
            this.handleLobbyUpdate(data);
        });
        // Chat messages
        this.dotaClient.on('chatMessage', (msg) => {
            this.handleChatMessage(msg);
        });
        // Lobby cleared
        this.dotaClient.on('lobbyCleared', () => {
            this.handleLobbyCleared();
        });
        // Source TV data (for detecting game start/end)
        this.dotaClient.on('sourceTVData', (data) => {
            this.handleSourceTVData(data);
        });
        // Disconnection
        this.dotaClient.on('disconnected', (reason) => {
            this.emitEvent({
                type: 'bot_error',
                sessionId: this.currentSessionId,
                message: `Disconnected from Steam: ${reason}`,
                code: 'STEAM_DISCONNECT',
                timestamp: new Date().toISOString(),
            });
        });
        // Start heartbeat
        this.heartbeatInterval = setInterval(() => this.sendHeartbeat(), this.heartbeatIntervalMs);
        this.sendHeartbeat();
        logger_js_1.logger.info('EventBridge: Started');
    }
    /**
     * Stop listening and clean up
     */
    stop() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        this.dotaClient.removeAllListeners();
        logger_js_1.logger.info('EventBridge: Stopped');
    }
    /**
     * Set the current session ID (when assigned to a new session)
     */
    setSessionId(sessionId) {
        this.currentSessionId = sessionId;
        this.previousPlayers.clear();
        this.gameDetected = false;
        this.gameEndEmitted = false;
    }
    /**
     * Clear the current session (when session is complete)
     */
    clearSession() {
        this.currentSessionId = null;
        this.previousPlayers.clear();
        this.gameDetected = false;
        this.gameEndEmitted = false;
    }
    // ─── Event Handlers ────────────────────────────────────────────────
    async handleLobbyUpdate(data) {
        if (!this.currentSessionId)
            return;
        // Detect player joins/leaves/moves
        const currentPlayerMap = new Map(data.players.map((p) => [p.steamId32, p]));
        // Check for new players
        for (const [id, player] of currentPlayerMap) {
            const prev = this.previousPlayers.get(id);
            if (!prev) {
                // New player joined
                await this.emitEvent({
                    type: 'player_joined',
                    sessionId: this.currentSessionId,
                    steamId32: player.steamId32,
                    slotIndex: player.slot,
                    teamSide: player.team,
                    timestamp: new Date().toISOString(),
                });
            }
            else if (prev.slot !== player.slot || prev.team !== player.team) {
                // Player moved slots
                await this.emitEvent({
                    type: 'player_slot_changed',
                    sessionId: this.currentSessionId,
                    steamId32: player.steamId32,
                    oldSlot: prev.slot,
                    newSlot: player.slot,
                    teamSide: player.team,
                    timestamp: new Date().toISOString(),
                });
            }
        }
        // Check for players who left
        for (const [id, prev] of this.previousPlayers) {
            if (!currentPlayerMap.has(id)) {
                await this.emitEvent({
                    type: 'player_left',
                    sessionId: this.currentSessionId,
                    steamId32: prev.steamId32,
                    timestamp: new Date().toISOString(),
                });
            }
        }
        // Update state
        this.previousPlayers = currentPlayerMap;
        // Emit full lobby state update
        await this.emitEvent({
            type: 'lobby_state_update',
            sessionId: this.currentSessionId,
            players: data.players.map((p) => ({
                steamId32: p.steamId32,
                slotIndex: p.slot,
                teamSide: p.team,
            })),
            radiantTeamName: data.radiantTeamName,
            direTeamName: data.direTeamName,
            timestamp: new Date().toISOString(),
        });
        // ── Game start / end detection from the lobby state machine ──
        // CSODOTALobby.State: UI=0, SERVERSETUP=1, RUN=2, POSTGAME=3, READYUP=4, NOTREADY=5, SERVERASSIGN=6
        const state = data.state;
        if (state !== undefined && state !== null) {
            const inProgress = state === 1 || state === 2 || state === 6;
            if (!this.gameDetected && inProgress) {
                this.gameDetected = true;
                await this.emitEvent({
                    type: 'game_started',
                    sessionId: this.currentSessionId,
                    dotaMatchId: Number(data.matchId) || 0,
                    timestamp: new Date().toISOString(),
                });
            }
            // POSTGAME(3) with a decisive outcome → game ended.
            // EMatchOutcome: RadVictory=2, DireVictory=3.
            if (!this.gameEndEmitted && state === 3 && (data.matchOutcome === 2 || data.matchOutcome === 3)) {
                this.gameEndEmitted = true;
                await this.emitEvent({
                    type: 'game_ended',
                    sessionId: this.currentSessionId,
                    dotaMatchId: Number(data.matchId) || 0,
                    radiantWin: data.matchOutcome === 2,
                    duration: 0,
                    timestamp: new Date().toISOString(),
                });
            }
        }
    }
    async handleChatMessage(msg) {
        if (!this.currentSessionId)
            return;
        // Include a live snapshot of lobby slots so the orchestrator can validate
        // that a team's players are all seated on the correct side before accepting !ready.
        const currentPlayers = this.dotaClient.getCurrentLobbyPlayers().map((p) => ({
            steamId32: p.steamId32,
            teamSide: p.team,
        }));
        await this.emitEvent({
            type: 'chat_message',
            sessionId: this.currentSessionId,
            steamId32: msg.steamId32,
            playerName: msg.playerName,
            message: msg.message,
            currentPlayers,
            timestamp: new Date().toISOString(),
        });
    }
    async handleLobbyCleared() {
        // Game end is detected authoritatively from the POSTGAME lobby state + match_outcome
        // (see handleLobbyUpdate). We intentionally do NOT emit a synthetic game_ended here,
        // since we'd have no real match id or winner — emitting fake data corrupts series scoring.
        if (!this.currentSessionId)
            return;
    }
    async handleSourceTVData() {
        // Game start is detected from the lobby state machine (handleLobbyUpdate), which is
        // more reliable than SourceTV data. This handler is kept as a no-op hook.
    }
    // ─── Heartbeat ─────────────────────────────────────────────────────
    async sendHeartbeat() {
        try {
            // Heartbeats update botAccounts DIRECTLY — they must NOT go through the botEvents
            // queue. A 30s-per-bot event stream floods the queue, and the orchestrator
            // processes events oldest-first with a per-cycle limit, so heartbeats stall the
            // lobby lifecycle events (create/invite/ready/start) behind them. Only liveness
            // fields here — never the lifecycle `status`, which is owned by the orchestrator.
            await this.db.collection('botAccounts').doc(this.botAccountId).update({
                lastHeartbeat: new Date().toISOString(),
                connected: !!this.dotaClient.isConnected,
            });
        }
        catch {
            // Heartbeat failure is non-fatal
        }
    }
    // ─── Firestore Event Writer ────────────────────────────────────────
    async emitEvent(event) {
        try {
            await this.db.collection('botEvents').add({
                botAccountId: this.botAccountId,
                event,
                processed: false,
                createdAt: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_js_1.logger.error('Failed to emit event to Firestore', error);
        }
    }
}
exports.EventBridge = EventBridge;
