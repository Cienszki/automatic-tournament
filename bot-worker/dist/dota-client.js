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
const SteamTotp = require("steam-totp");
const Dota2 = __importStar(require("dota2"));
const events_1 = require("events");
const logger_js_1 = require("./logger.js");

/**
 * Creates a shim that makes steam-user look like an old steam.SteamClient
 * so that dota2@7 (which requires the old steam API) works with steam-user.
 *
 * dota2@7 needs from steamClient:
 *   - steamClient.steamID (string) — set after login
 *   - steamClient.send({msg, proto}, body) — send messages to Steam
 *   - steamClient.on('message', handler) — receive messages from Steam
 *
 * steam-user exposes:
 *   - steamUser.steamID.toString() — Steam64 ID
 *   - steamUser.sendToGC(appid, msgType, protoHeader, payload) — send GC msg
 *   - steamUser.on('receivedFromGC', (appid, msgType, payload) => ...) — receive GC msg
 *
 * The dota2 SteamGameCoordinator wraps steamClient and:
 *   - On send: packs payload into CMsgGCClient and calls steamClient.send({msg: ClientToGC}, packed)
 *   - On receive: listens for steamClient 'message' events with msg==ClientFromGC and unpacks CMsgGCClient
 * But steam-user already handles the CMsgGCClient layer internally — it unpacks it and exposes
 * (msgType, payload) directly via receivedFromGC. So the shim must:
 *   - When dota2 calls shim.send({msg:ClientToGC}, cmsgGCClientBuffer):
 *       decode CMsgGCClient from buffer → extract msgType+payload → call steamUser.sendToGC
 *   - When steamUser emits receivedFromGC(appid, msgType, payload):
 *       re-pack into CMsgGCClient buffer → emit 'message' on shim with header {msg:ClientFromGC}
 */
function createSteamClientShim(steamUserInstance) {
    const shim = new events_1.EventEmitter();
    const PROTO_MASK = 0x80000000;
    // EMsg.ClientToGC / EMsg.ClientFromGC MUST come from the SAME `steam` package
    // node-dota2 uses — not hardcoded legacy constants. This build of `steam` uses
    // 5452/5453; the old hardcoded 4157/4228 silently dropped every GC message in BOTH
    // directions (send check failed; receive handler key mismatched), so the GC handshake
    // could never complete.
    const steamEMsg = require('steam').EMsg;
    const EMsg_ClientToGC = steamEMsg.ClientToGC;
    const EMsg_ClientFromGC = steamEMsg.ClientFromGC;
    // Use the SAME schema node-dota2's SteamGameCoordinator uses to DECODE these buffers:
    // require('steam').Internal. node-dota2 bundles steam-resources 1.2.0, but
    // require('steam-resources') here resolves to a DIFFERENT version (1.2.2) at the repo
    // root. Encoding CMsgGCClient with one version and decoding it with another can make
    // node-dota2 silently drop every GC reply (mis-read appid → early `return`). Sharing
    // one schema guarantees the encode→decode round-trip is symmetric.
    let schema;
    try {
        schema = require('steam').Internal;
        if (!schema || !schema.CMsgGCClient) {
            throw new Error('steam.Internal.CMsgGCClient unavailable');
        }
    } catch (e) {
        schema = require('steam-resources').Internal;
    }

    // steamID property — dota2 reads this to build proto headers
    Object.defineProperty(shim, 'steamID', {
        get: () => steamUserInstance.steamID ? steamUserInstance.steamID.toString() : null,
        enumerable: true,
    });

    // send() — called by SteamGameCoordinator when dota2 sends a GC message.
    // The body is a CMsgGCClient-encoded buffer.
    // IMPORTANT: CMsgGCClient.payload = [MsgGCHdrProtoBuf bytes (8+N)][actual body]
    // steam-user.sendToGC() also prepends its own header, so we must STRIP the old
    // header from gcMsg.payload before calling sendToGC to avoid double-headers.
    shim.send = function(header, body) {
        if (header.msg === EMsg_ClientToGC) {
            try {
                // steam-resources CMsgGCClient has: appid, msgtype, payload (ByteBuffer)
                const gcMsg = schema.CMsgGCClient.decode(body);
                const rawMsgType = gcMsg.msgtype >>> 0;
                const isProto = !!(rawMsgType & PROTO_MASK);
                const cleanMsgType = rawMsgType & ~PROTO_MASK;
                // Convert ByteBuffer payload to Node.js Buffer
                // payload = [MsgGCHdrProtoBuf: 4 bytes msgType | 4 bytes headerLen | headerLen bytes proto][body]
                const payloadBuf = (gcMsg.payload && gcMsg.payload.toBuffer)
                    ? gcMsg.payload.toBuffer()
                    : Buffer.from(gcMsg.payload || []);
                let actualBody;
                if (isProto && payloadBuf.length >= 8) {
                    // MsgGCHdrProtoBuf: [4 bytes msgType|MASK LE][4 bytes headerLen LE][headerLen bytes][body]
                    const headerLen = payloadBuf.readInt32LE(4);
                    actualBody = payloadBuf.slice(8 + Math.max(0, headerLen));
                } else if (!isProto && payloadBuf.length >= 18) {
                    // MsgGCHdr is fixed 18 bytes
                    actualBody = payloadBuf.slice(18);
                } else {
                    actualBody = payloadBuf.length > 0 ? payloadBuf : Buffer.alloc(0);
                }
                if (process.env.GC_DEBUG === '1') {
                    logger_js_1.logger.info(`[GC→] send appid=${gcMsg.appid} msgType=${cleanMsgType} proto=${isProto} bodyLen=${actualBody.length}`);
                }
                steamUserInstance.sendToGC(gcMsg.appid, cleanMsgType, isProto ? {} : null, actualBody);
            } catch (e) {
                logger_js_1.logger.error('Shim: failed to forward send to GC', e);
            }
        }
        // Other EMsg types (ClientGamesPlayed etc.) are ignored —
        // steam-user handles those via gamesPlayed() which we call separately.
    };

    // Forward GC messages from steam-user to dota2's SteamGameCoordinator.
    // steam-user already stripped the CMsgGCClient wrapper AND the MsgGCHdrProtoBuf
    // header, so `payload` here is just the raw message body.
    // We must RE-ADD the 8-byte MsgGCHdrProtoBuf header before wrapping in CMsgGCClient,
    // because SteamGameCoordinator.decode() calls MsgGCHdrProtoBuf.decode(CMsgGCClient.payload)
    // which advances the ByteBuffer offset by 8, so the subsequent toBuffer() call
    // returns just the body — which dota2 handlers then decode directly.
    steamUserInstance.on('receivedFromGC', (appid, msgType, payload) => {
        try {
            if (process.env.GC_DEBUG === '1') {
                logger_js_1.logger.info(`[GC←] recv appid=${appid} msgType=${msgType} payloadLen=${payload ? payload.length : 0}`);
                // Decode connection-status pushes so we can see exactly what the GC says
                // about our session (HAVE_SESSION / NO_SESSION / queued / ...).
                try {
                    const baseMsg = Dota2.schema.EGCBaseClientMsg;
                    if (baseMsg && msgType === baseMsg.k_EMsgGCClientConnectionStatus) {
                        const cs = Dota2.schema.CMsgConnectionStatus.decode(payload);
                        const name = Object.keys(Dota2.schema.GCConnectionStatus)
                            .find((k) => Dota2.schema.GCConnectionStatus[k] === cs.status);
                        logger_js_1.logger.info(`[GC←] connection status = ${cs.status} (${name})`);
                    }
                } catch (probeErr) {
                    logger_js_1.logger.warn('[GC←] status probe decode failed: ' + (probeErr && probeErr.message));
                }
            }
            // steam-user always strips PROTO_MASK before emitting receivedFromGC
            const msgTypeWithMask = (msgType | PROTO_MASK) >>> 0;
            // Reconstruct MsgGCHdrProtoBuf: [4 bytes msgType|MASK LE][4 bytes headerLen=0 LE]
            const hdr = Buffer.alloc(8);
            hdr.writeUInt32LE(msgTypeWithMask, 0);
            hdr.writeInt32LE(0, 4); // empty CMsgProtoBufHeader (0 bytes)
            const fullPayload = Buffer.concat([hdr, payload]);
            const gcClientBuf = new schema.CMsgGCClient({
                appid,
                msgtype: msgTypeWithMask,
                payload: fullPayload,
            }).toBuffer();
            shim.emit('message', { msg: EMsg_ClientFromGC }, gcClientBuf);
        } catch (e) {
            logger_js_1.logger.error('Shim: failed to forward receivedFromGC', e);
        }
    });

    return shim;
}
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
    steam;      // steam-user instance (handles actual Steam connection)
    steamShim;  // shim making steam-user look like old steam.SteamClient for dota2
    dota2;
    _connected = false;
    _inDota = false;
    _currentLobby = null;
    _allowedPlayers = null;
    _selectionPriorityRules = null; // 0=Manual, 1=Automatic (coin toss)
    _awaitingCoinToss = false;      // true between the 1st and 2nd launchPracticeLobby
    _coinTossTimer = null;
    constructor(config) {
        super();
        this.config = config;
        this.steam = new steam_user_1.default();
        // Create the compatibility shim, then pass it to dota2 as the "steamClient"
        this.steamShim = createSteamClientShim(this.steam);
        // GC_DEBUG=1 enables node-dota2's own silly-level logging ("Sending ClientHello",
        // "Dota2 fromGC: <name>", "Received client welcome") — invaluable for diagnosing
        // GC handshake failures. Off by default so production logs stay clean.
        const gcDebug = process.env.GC_DEBUG === '1';
        this.dota2 = new Dota2.Dota2Client(this.steamShim, gcDebug, gcDebug);
        this.setupEventHandlers();
    }
    get isConnected() {
        return this._connected && this._inDota;
    }
    // ─── Connection ─────────────────────────────────────────────────────
    async connect() {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Connection timeout (90s)'));
            }, 90000);
            const logOnOptions = {
                accountName: this.config.username,
                password: this.config.password,
            };
            if (this.config.steamGuardSharedSecret) {
                logOnOptions.twoFactorCode = SteamTotp.generateAuthCode(this.config.steamGuardSharedSecret);
            }
            this.steam.logOn(logOnOptions);
            this.steam.once('loggedOn', () => {
                logger_js_1.logger.info('Steam: Logged in successfully');
                this._connected = true;
                this.steam.setPersona(steam_user_1.default.EPersonaState.Online);
                // Tell Steam we are playing Dota 2 (app 570).
                // steam-user handles this directly (no old-steam .send() needed).
                this.steam.gamesPlayed([570]);
                // dota2.launch() starts sending ClientHello to GC via the shim.
                // The shim forwards these via steamUser.sendToGC() and routes
                // receivedFromGC() back as 'message' events that dota2 can decode.
                this.dota2.launch();
            });
            this.dota2.once('ready', () => {
                logger_js_1.logger.info('Dota 2: GC connection established');
                this._inDota = true;
                clearTimeout(timeout);
                resolve();
            });
            this.steam.once('error', (err) => {
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
            // Selection priority: Automatic(1) = coin toss (side/pick selection), Manual(0) = none.
            if (options.selectionPriorityRules !== undefined && options.selectionPriorityRules !== null) {
                lobbyOptions.selection_priority_rules = options.selectionPriorityRules;
                this._selectionPriorityRules = options.selectionPriorityRules;
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
        // First launch. With Automatic selection priority this opens the coin toss
        // (side / pick-order selection); the game only actually starts after a SECOND
        // launch, which we fire automatically once both teams have chosen (see
        // _maybeFinishCoinToss, driven by practiceLobbyUpdate). With Manual priority a
        // single launch starts the game directly.
        await this._launchPracticeLobby();
        const rules = this._selectionPriorityRules ?? (this._currentLobby ? Number(this._currentLobby.selection_priority_rules) : 0);
        const automatic = Number(rules) === 1;
        if (automatic) {
            this._awaitingCoinToss = true;
            logger_js_1.logger.info('Coin toss opened — waiting for both teams to pick side/order, then will relaunch to start');
            // Safety net: if we somehow miss the "both chose" update, relaunch anyway
            // after 90s so an official match can't hang forever at side selection.
            if (this._coinTossTimer)
                clearTimeout(this._coinTossTimer);
            this._coinTossTimer = setTimeout(() => {
                if (this._awaitingCoinToss) {
                    this._awaitingCoinToss = false;
                    logger_js_1.logger.warn('Coin toss timeout (90s) — firing fallback second launch');
                    this.dota2.launchPracticeLobby((err) => {
                        if (err)
                            logger_js_1.logger.error('Fallback second launch failed', err);
                    });
                }
            }, 90000);
        }
        return { coinToss: automatic };
    }
    /** Fire a single launchPracticeLobby and resolve when the GC ack's it. */
    _launchPracticeLobby() {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Game start timeout (30s)'));
            }, 30000);
            this.dota2.launchPracticeLobby((err) => {
                clearTimeout(timeout);
                if (err) {
                    logger_js_1.logger.error('Failed to launch lobby', err);
                    reject(err);
                }
                else {
                    logger_js_1.logger.info('launchPracticeLobby sent');
                    resolve();
                }
            });
        });
    }
    /**
     * When awaiting a coin toss, watch the lobby for both teams' selection choices.
     * Once the priority AND non-priority teams have each chosen (choice != Invalid),
     * fire the second launch to actually start the game.
     */
    _maybeFinishCoinToss(lobby) {
        if (!this._awaitingCoinToss || !lobby)
            return;
        const state = Number(lobby.state);
        // Game already moved into setup/run — stop waiting, don't double-launch.
        if (state === 1 || state === 2 || state === 6) {
            this._clearCoinToss();
            return;
        }
        const prio = Number(lobby.series_current_priority_team_choice ?? 0);
        const nonPrio = Number(lobby.series_current_non_priority_team_choice ?? 0);
        // DOTASelectionPriorityChoice_Invalid = 0. Both non-zero → both teams chose.
        if (prio !== 0 && nonPrio !== 0) {
            this._clearCoinToss();
            logger_js_1.logger.info('Coin toss complete (both teams chose) — firing second launch to start the game');
            this.dota2.launchPracticeLobby((err) => {
                if (err)
                    logger_js_1.logger.error('Second launch (post coin toss) failed', err);
                else
                    logger_js_1.logger.info('Game starting after coin toss');
            });
        }
    }
    _clearCoinToss() {
        this._awaitingCoinToss = false;
        if (this._coinTossTimer) {
            clearTimeout(this._coinTossTimer);
            this._coinTossTimer = null;
        }
    }
    async leaveLobby() {
        this._clearCoinToss();
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
            // CSODOTALobbyMember.id is the Steam64 ID (fixed64) — convert to Steam32.
            const steamId32 = this.memberSteamId32(member);
            const slot = Number(member.slot ?? member.team_slot ?? -1);
            // Prefer the explicit GC team field; fall back to slot ranges.
            const team = (member.team !== undefined && member.team !== null)
                ? this.gcTeamToSide(Number(member.team))
                : this.slotToTeam(slot);
            return {
                accountId: Number(steamId32) || 0,
                steamId32,
                slot,
                team,
                heroId: member.hero_id ? Number(member.hero_id) : undefined,
            };
        });
    }
    /** Convert a lobby member's Steam64 id to a Steam32 account id string. */
    memberSteamId32(member) {
        if (member.account_id !== undefined && member.account_id !== null)
            return String(member.account_id >>> 0);
        const raw = member.id;
        if (raw === undefined || raw === null)
            return '0';
        try {
            const id64 = BigInt(raw.toString());
            const acct = id64 - BigInt('76561197960265728');
            return acct > 0n ? acct.toString() : '0';
        }
        catch {
            return '0';
        }
    }
    /** Map a DOTA_GC_TEAM value to our team-side string. */
    gcTeamToSide(gcTeam) {
        // GOOD_GUYS=0, BAD_GUYS=1, BROADCASTER=2, SPECTATOR=3, PLAYER_POOL=4
        switch (gcTeam) {
            case 0: return 'radiant';
            case 1: return 'dire';
            case 2:
            case 3: return 'spectator';
            default: return 'unassigned';
        }
    }
    /** Current Dota 2 lobby id as a string, or undefined if not in a lobby. */
    getCurrentLobbyId() {
        const lobby = this._currentLobby;
        if (!lobby || lobby.lobby_id === undefined || lobby.lobby_id === null)
            return undefined;
        return this.longToString(lobby.lobby_id);
    }
    /** Safely stringify a protobuf Long / number / string id. */
    longToString(v) {
        if (v === undefined || v === null)
            return undefined;
        try {
            return v.toString();
        }
        catch {
            return undefined;
        }
    }
    /**
     * Record the rosters/whitelist the orchestrator considers authorized.
     * Enforcement (kicks) is driven by the orchestrator, so this is stored for
     * reference only — but it lets the 'set_teams' command succeed cleanly.
     */
    setAllowedPlayers(teamA, teamB, whitelist) {
        this._allowedPlayers = {
            teamA: teamA || [],
            teamB: teamB || [],
            whitelist: whitelist || [],
        };
        logger_js_1.logger.debug(`Allowed players updated: ${(teamA || []).length}+${(teamB || []).length} players, ${(whitelist || []).length} whitelisted`);
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
        // Diagnostics: surface GC messages node-dota2 received but had no handler for,
        // and GC hello timeouts (ClientHello sent, no ClientWelcome yet). These are the
        // two key signals when the GC handshake never completes.
        this.dota2.on('unhandled', (kMsg, name) => {
            // The GC routinely pushes messages node-dota2 has no handler for (event points,
            // extra caches, ...). Harmless — only surface them under GC_DEBUG to avoid noise.
            if (process.env.GC_DEBUG === '1')
                logger_js_1.logger.warn(`GC unhandled message: ${kMsg} (${name})`);
        });
        this.dota2.on('hellotimeout', () => {
            logger_js_1.logger.warn('GC hello timeout — ClientHello sent but no ClientWelcome from the Game Coordinator');
        });
        // Lobby state updates
        this.dota2.on('practiceLobbyUpdate', (lobby) => {
            this._currentLobby = lobby;
            // Coin toss: if we're between the two launches, check whether both teams
            // have chosen yet and fire the second launch when they have.
            this._maybeFinishCoinToss(lobby);
            const players = this.getCurrentLobbyPlayers();
            const teamNames = this.getLobbyTeamNames();
            this.emit('lobbyUpdate', {
                players,
                radiantTeamName: teamNames.radiant,
                direTeamName: teamNames.dire,
                lobbyId: this.getCurrentLobbyId(),
                state: (lobby.state !== undefined && lobby.state !== null) ? Number(lobby.state) : undefined,
                matchId: this.longToString(lobby.match_id),
                matchOutcome: (lobby.match_outcome !== undefined && lobby.match_outcome !== null) ? Number(lobby.match_outcome) : 0,
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
        this.steam.on('error', (_eresult) => {
            logger_js_1.logger.warn(`Steam connection error/disconnected`);
            this._connected = false;
            this._inDota = false;
            this.emit('disconnected', 'error');
        });
        // Steam reconnection after loggedOn fires again
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
