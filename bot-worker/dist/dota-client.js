"use strict";
// bot-worker/src/dota-client.ts
// Dota 2 client wrapper — manages Steam login and Dota 2 GC connection
//
// This module wraps `steam-user` and `dota2` (node-dota2) to provide
// a clean interface for lobby management.
//
// NOTE: The `dota2` npm package provides protobuf-based communication
// with Valve's Game Coordinator (GC). Key APIs used:
// - Dota2.createPracticeLobby()  — create a custom lobby
// - Dota2.inviteToLobby()        — invite a player by Steam ID
// - Dota2.practiceLobbyKick()    — kick a player
// - Dota2.launchPracticeLobby()  — start the game (coin toss)
// - Dota2.leavePracticeLobby()   — leave/destroy the lobby
// - Dota2.sendMessage()          — send a chat message in lobby
//
// Events emitted by Dota2:
// - 'practiceLobbyUpdate'  — lobby state changed (players join/leave/move)
// - 'practiceLobbyResponse'— response to lobby creation
// - 'chatMessage'          — someone sent a chat message
// - 'sourceTVGamesData'    — live game data (when spectating)
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DotaClient = void 0;
const steam_user_1 = __importDefault(require("steam-user"));
const Dota2 = __importStar(require("dota2"));
const events_1 = require("events");
const logger_js_1 = require("./logger.js");
// Dota 2 GC enums (from node-dota2)
const { EServerRegion, DOTA_GameMode, DOTALobbyVisibility, schema, } = Dota2;
/** Lobby slot mapping */
const SLOT = {
    RADIANT_START: 0,
    RADIANT_END: 4,
    DIRE_START: 5,
    DIRE_END: 9,
    RADIANT_COACH: 10,
    DIRE_COACH: 11,
};
/**
 * Wraps Steam + Dota 2 client for lobby management.
 * Emits high-level events that map to BotEvent types.
 */
class DotaClient extends events_1.EventEmitter {
    config;
    steam;
    dota2;
    _connected = false;
    _inDota = false;
    _currentLobby = null;
    constructor(config) {
        super();
        this.config = config;
        this.steam = new steam_user_1.default();
        this.dota2 = new Dota2.Dota2Client(this.steam, true, true);
        this.setupEventHandlers();
    }
    get isConnected() {
        return this._connected && this._inDota;
    }
    // ─── Connection ─────────────────────────────────────────────────────
    async connect() {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Connection timeout (60s)'));
            }, 60000);
            this.steam.logOn({
                accountName: this.config.username,
                password: this.config.password,
                ...(this.config.steamGuardSharedSecret
                    ? { twoFactorCode: this.config.steamGuardSharedSecret }
                    : {}),
            });
            this.steam.on('loggedOn', () => {
                logger_js_1.logger.info('Steam: Logged in successfully');
                this._connected = true;
                // Set status to Online and launch Dota 2
                this.steam.setPersona(steam_user_1.default.EPersonaState.Online);
                this.steam.gamesPlayed([570]); // Dota 2 App ID
            });
            this.dota2.on('ready', () => {
                logger_js_1.logger.info('Dota 2: GC connection established');
                this._inDota = true;
                clearTimeout(timeout);
                resolve();
            });
            this.steam.on('error', (err) => {
                logger_js_1.logger.error('Steam: Connection error', err);
                this._connected = false;
                clearTimeout(timeout);
                reject(err);
            });
        });
    }
    async disconnect() {
        if (this._currentLobby) {
            try {
                await this.leaveLobby();
            }
            catch {
                // Ignore errors when leaving lobby during disconnect
            }
        }
        this.dota2.exit();
        this.steam.logOff();
        this._connected = false;
        this._inDota = false;
        logger_js_1.logger.info('Disconnected from Steam/Dota 2');
    }
    // ─── Lobby Management ──────────────────────────────────────────────
    async createLobby(options) {
        if (!this.isConnected)
            throw new Error('Not connected to Dota 2 GC');
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Lobby creation timeout (30s)'));
            }, 30000);
            const lobbyOptions = {
                game_name: options.name,
                pass_key: options.password,
                game_mode: options.gameMode,
                server_region: options.serverRegion,
                visibility: options.visibility,
                dota_tv_delay: Math.floor(options.dotaTvDelay / 30), // Convert seconds to Dota TV delay enum
                series_type: options.seriesType,
                allow_cheats: options.cheatsEnabled,
                fill_with_bots: options.fillWithBots,
                allow_spectating: options.allowSpectators,
                pause_setting: options.pauseSetting,
            };
            if (options.leagueId) {
                lobbyOptions.leagueid = options.leagueId;
            }
            this.dota2.createPracticeLobby(lobbyOptions, (err, body) => {
                clearTimeout(timeout);
                if (err) {
                    logger_js_1.logger.error('Failed to create lobby', err);
                    reject(err);
                }
                else {
                    logger_js_1.logger.info('Lobby created successfully');
                    resolve();
                }
            });
        });
    }
    async invitePlayer(steamId32) {
        if (!this.isConnected)
            throw new Error('Not connected to Dota 2 GC');
        // Convert Steam32 ID to Steam64 for the invite
        const accountId = parseInt(steamId32, 10);
        const steamId64 = this.steam32ToSteam64(accountId);
        this.dota2.inviteToLobby(steamId64);
        logger_js_1.logger.debug(`Invited player ${steamId32} (${steamId64})`);
    }
    async invitePlayers(steamId32s) {
        for (const id of steamId32s) {
            await this.invitePlayer(id);
            // Small delay between invites to avoid rate limiting
            await this.sleep(500);
        }
    }
    async sendChatMessage(message) {
        if (!this.isConnected)
            throw new Error('Not connected to Dota 2 GC');
        this.dota2.sendMessage(message, /* channel */ undefined, /* channel_type */ 1);
        logger_js_1.logger.debug(`Chat: ${message}`);
    }
    async kickPlayer(steamId32) {
        if (!this.isConnected)
            throw new Error('Not connected to Dota 2 GC');
        const accountId = parseInt(steamId32, 10);
        this.dota2.practiceLobbyKick(accountId);
        logger_js_1.logger.debug(`Kicked player ${steamId32}`);
    }
    async startGame() {
        if (!this.isConnected)
            throw new Error('Not connected to Dota 2 GC');
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Game start timeout (30s)'));
            }, 30000);
            this.dota2.launchPracticeLobby((err) => {
                clearTimeout(timeout);
                if (err) {
                    logger_js_1.logger.error('Failed to start game', err);
                    reject(err);
                }
                else {
                    logger_js_1.logger.info('Game launch initiated (coin toss)');
                    resolve();
                }
            });
        });
    }
    async leaveLobby() {
        if (!this.isConnected)
            return;
        return new Promise((resolve) => {
            this.dota2.leavePracticeLobby((err) => {
                if (err) {
                    logger_js_1.logger.warn('Error leaving lobby (non-fatal)', err);
                }
                this._currentLobby = null;
                resolve();
            });
        });
    }
    /**
     * Get the current lobby state (players, teams, etc.)
     */
    getCurrentLobbyPlayers() {
        if (!this._currentLobby)
            return [];
        const lobby = this._currentLobby;
        const members = (lobby.all_members || lobby.members || []);
        return members.map((member) => {
            const accountId = Number(member.id || member.account_id || 0);
            const slot = Number(member.slot ?? member.team_slot ?? -1);
            const team = this.slotToTeam(slot);
            return {
                accountId,
                steamId32: String(accountId),
                slot,
                team,
                heroId: member.hero_id ? Number(member.hero_id) : undefined,
            };
        });
    }
    /**
     * Get team names from current lobby
     */
    getLobbyTeamNames() {
        if (!this._currentLobby)
            return { radiant: '', dire: '' };
        const lobby = this._currentLobby;
        return {
            radiant: String(lobby.radiant_team_name || lobby.team_name_radiant || ''),
            dire: String(lobby.dire_team_name || lobby.team_name_dire || ''),
        };
    }
    // ─── Private Helpers ────────────────────────────────────────────────
    setupEventHandlers() {
        // Lobby state updates
        this.dota2.on('practiceLobbyUpdate', (lobby) => {
            this._currentLobby = lobby;
            const players = this.getCurrentLobbyPlayers();
            const teamNames = this.getLobbyTeamNames();
            this.emit('lobbyUpdate', {
                players,
                radiantTeamName: teamNames.radiant,
                direTeamName: teamNames.dire,
            });
        });
        // Chat messages in lobby
        this.dota2.on('chatMessage', (_channel, senderName, message, chatData) => {
            const accountId = Number(chatData.account_id || 0);
            this.emit('chatMessage', {
                accountId,
                steamId32: String(accountId),
                playerName: senderName,
                message,
            });
        });
        // Game state changes (for detecting game start/end)
        this.dota2.on('sourceTVGamesData', (data) => {
            this.emit('sourceTVData', data);
        });
        // Handle being kicked or lobby destroyed
        this.dota2.on('practiceLobbyCleared', () => {
            logger_js_1.logger.info('Lobby was cleared/destroyed');
            this._currentLobby = null;
            this.emit('lobbyCleared');
        });
        // Steam disconnection
        this.steam.on('disconnected', (_eresult, msg) => {
            logger_js_1.logger.warn(`Steam disconnected: ${msg}`);
            this._connected = false;
            this._inDota = false;
            this.emit('disconnected', msg);
        });
        // Steam reconnection
        this.steam.on('loggedOn', () => {
            if (!this._connected) {
                logger_js_1.logger.info('Steam: Reconnected');
                this._connected = true;
            }
        });
    }
    slotToTeam(slot) {
        if (slot >= SLOT.RADIANT_START && slot <= SLOT.RADIANT_END)
            return 'radiant';
        if (slot >= SLOT.DIRE_START && slot <= SLOT.DIRE_END)
            return 'dire';
        if (slot === SLOT.RADIANT_COACH || slot === SLOT.DIRE_COACH) {
            return slot === SLOT.RADIANT_COACH ? 'radiant' : 'dire';
        }
        if (slot >= 12)
            return 'spectator';
        return 'unassigned';
    }
    steam32ToSteam64(accountId) {
        // Steam64 = accountId + 76561197960265728
        const base = BigInt('76561197960265728');
        return String(base + BigInt(accountId));
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
exports.DotaClient = DotaClient;
