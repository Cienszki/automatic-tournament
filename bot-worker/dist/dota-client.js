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

// node-dota2's createPracticeLobby filters options through Dota2._lobbyOptions (a key
// whitelist) before building CMsgPracticeLobbySetDetails. That whitelist OMITS
// selection_priority_rules, so the field is silently stripped and every lobby is created
// as Manual — a single launchPracticeLobby then starts the game directly with NO coin toss.
// The proto itself DOES have the field (CMsgPracticeLobbySetDetails.selection_priority_rules
// = 46), so we just need it whitelisted. Patch the real dota2 module object that _parseOptions
// reads. Idempotent; non-fatal if the internal shape ever changes.
try {
    const _dota2mod = require('dota2');
    if (_dota2mod._lobbyOptions && _dota2mod._lobbyOptions.selection_priority_rules === undefined) {
        _dota2mod._lobbyOptions.selection_priority_rules = 'number';
        logger_js_1.logger.info('Patched dota2 _lobbyOptions to allow selection_priority_rules (coin toss)');
    }
    // Same story for the per-side draft-time penalty levels (CSODOTALobby.penalty_level_radiant=43,
    // penalty_level_dire=44). Whitelist them so configPracticeLobby can set an admin-issued penalty.
    if (_dota2mod._lobbyOptions && _dota2mod._lobbyOptions.penalty_level_radiant === undefined) {
        _dota2mod._lobbyOptions.penalty_level_radiant = 'number';
        _dota2mod._lobbyOptions.penalty_level_dire = 'number';
        logger_js_1.logger.info('Patched dota2 _lobbyOptions to allow penalty_level_radiant/dire (draft penalty)');
    }
} catch (e) {
    logger_js_1.logger.warn('Could not patch dota2 _lobbyOptions for extra lobby fields', e);
}

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
_everReady = false;             // true once the GC has been ready at least once — distinguishes a reconnect from the first connect
_currentLobby = null;
_allowedPlayers = null;
_selectionPriorityRules = null; // 0=Manual, 1=Automatic (coin toss)
_awaitingCoinToss = false;      // true between the 1st and 2nd launchPracticeLobby
_coinTossTimer = null;
_lastLobbyOptions = null;       // options used at createPracticeLobby, re-sent on updateSeriesScore
    _lobbyChatChannel = null; // "Lobby_<id>" once join is requested, for sending lobby chat
    _lobbyChatJoined = false;  // true once the GC confirms the join (chatJoined event)
    _personaCache = new Map(); // steamId64 → resolved Steam persona name (for kick messages)
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
            let settled = false;
            const finish = (err) => {
                if (settled)
                    return;
                settled = true;
                clearTimeout(timeout);
                this.dota2.removeListener('practiceLobbyUpdate', onUpdate);
                if (err) {
                    logger_js_1.logger.error('Failed to create lobby', err);
                    reject(err);
                }
                else {
                    logger_js_1.logger.info(`Lobby created successfully (id ${this.getCurrentLobbyId() || 'pending'})`);
                    // Join the lobby chat channel now so later send_chat commands work
                    // (sendMessage fails with "channel you have not joined" otherwise).
                    this._joinLobbyChat();
                    // The host bot is auto-seated into a team slot on create; park it in the
                    // broadcaster slot so all 10 playing places stay free for real players.
                    void this._parkSelfOutOfPlay().catch((e) => logger_js_1.logger.warn('Parking the host bot failed', e));
                    resolve();
                }
            };
            // node-dota2's createPracticeLobby callback is unreliable — it often never fires
            // even though the lobby IS created. The authoritative signal that the lobby exists
            // is its cache arriving via practiceLobbyUpdate, so resolve on that.
            const onUpdate = () => finish(null);
            const timeout = setTimeout(() => finish(new Error('Lobby creation timeout (30s)')), 30000);
            const lobbyOptions = {
                game_name: options.name,
                pass_key: options.password,
                game_mode: options.gameMode,
                server_region: options.serverRegion,
                visibility: options.visibility,
                // LobbyDotaTVDelay enum: 10s=0, 120s=1, 300s=2, 900s=3 (NOT seconds/30 — that
                // gives 4 for 120s and the GC rejects the whole create with an enum error).
                dota_tv_delay: options.dotaTvDelay <= 10 ? 0 : options.dotaTvDelay <= 120 ? 1 : options.dotaTvDelay <= 300 ? 2 : 3,
                series_type: options.seriesType,
                allow_cheats: options.cheatsEnabled,
                fill_with_bots: options.fillWithBots,
                allow_spectating: options.allowSpectators,
                pause_setting: options.pauseSetting,
            };
            if (options.leagueId) {
                lobbyOptions.leagueid = options.leagueId;
            }
            // Pre-populate the series score so game 2+ shows e.g. "1 - 0" in the Dota 2
            // lobby UI. Safe to send 0/0 for game 1. radiant_series_wins / dire_series_wins
            // map to CSODOTALobby fields the GC honours when series_type != 0.
            if (options.radiantSeriesWins) {
                lobbyOptions.radiant_series_wins = options.radiantSeriesWins;
            }
            if (options.direSeriesWins) {
                lobbyOptions.dire_series_wins = options.direSeriesWins;
            }
            // Selection priority: Automatic(1) = coin toss (side/pick selection), Manual(0) = none.
            if (options.selectionPriorityRules !== undefined && options.selectionPriorityRules !== null) {
                lobbyOptions.selection_priority_rules = options.selectionPriorityRules;
                this._selectionPriorityRules = options.selectionPriorityRules;
            }
            // Immortal Draft. Valve calls it "player draft", which is why the field is
            // do_player_draft (53) and why searching the protos for "immortal" finds nothing.
            // Only set when requested: node-dota2 filters options through Dota2._lobbyOptions
            // (patched in inhouse/proto-patch.js, and only when the schema really has the field),
            // so on an unpatched build this is dropped rather than throwing. Tournament lobbies
            // never pass it.
            if (options.doPlayerDraft) {
                lobbyOptions.do_player_draft = true;
            }
            // Remember the exact options so updateSeriesScore() can re-send them (a partial
            // SetDetails can make the GC reset unset lobby fields — resend everything to be safe).
            this._lastLobbyOptions = { ...lobbyOptions };
            this.dota2.once('practiceLobbyUpdate', onUpdate);
            this.dota2.createPracticeLobby(lobbyOptions, (err) => {
                // Explicit error → fail. Success here is fine too, but onUpdate usually wins first.
                finish(err || null);
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
        // Make sure we've joined the lobby chat channel, then send to it by name+type.
        // DOTAChannelType_Lobby = 3. sendMessage requires the exact joined channel_name.
        if (!this._lobbyChatChannel)
            this._joinLobbyChat();
        // node-dota2's joinChat is async; sending before the GC confirms the join silently
        // fails ("channel you have not joined"). Wait for the chatJoined confirmation first.
        if (this._lobbyChatChannel && !this._lobbyChatJoined) {
            await this._awaitLobbyChatJoin();
        }
        if (this._lobbyChatChannel) {
            this.dota2.sendMessage(message, this._lobbyChatChannel, 3);
        }
        else {
            this.dota2.sendMessage(message, undefined, 1);
        }
        logger_js_1.logger.debug(`Chat: ${message}`);
    }
    /** Join the current lobby's chat channel so we can post messages in it. */
    _joinLobbyChat() {
        const lobbyId = this.getCurrentLobbyId();
        if (!lobbyId)
            return;
        const channel = 'Lobby_' + lobbyId;
        if (this._lobbyChatChannel === channel)
            return;
        try {
            this._lobbyChatJoined = false; // wait for the GC's chatJoined confirmation before sending
            this.dota2.joinChat(channel, 3); // DOTAChannelType_Lobby
            this._lobbyChatChannel = channel;
            logger_js_1.logger.info('Joining lobby chat channel ' + channel);
        }
        catch (e) {
            logger_js_1.logger.warn('Failed to join lobby chat channel', e);
        }
    }
    /** Resolve once the lobby chat channel join is confirmed by the GC (or after timeout). */
    _awaitLobbyChatJoin(timeoutMs = 8000) {
        if (this._lobbyChatJoined)
            return Promise.resolve(true);
        return new Promise((resolve) => {
            const start = Date.now();
            const iv = setInterval(() => {
                if (this._lobbyChatJoined || Date.now() - start > timeoutMs) {
                    clearInterval(iv);
                    resolve(this._lobbyChatJoined);
                }
            }, 250);
        });
    }
    /**
     * Get the host bot out of every slot that can be dealt into a game.
     *
     * The GC auto-seats whoever creates the lobby onto a team slot, so this has
     * to happen on every create. The unassigned player pool used to be the
     * answer, and for a normal draft it is fine — but under Immortal Draft the
     * GC picks the ten players from radiant + dire + the pool together, so the
     * pool is a playing slot with extra steps. A bot parked there is dealt into
     * the draft and takes a human's place, which is the one thing the lobby
     * exists to prevent.
     *
     * The broadcaster slot sits outside the draft entirely, so that is where the
     * bot belongs. Being a broadcaster does not affect who leads the lobby —
     * that is `leader_id`, a separate field — so it can still configure, kick
     * and launch.
     *
     * Falls back to the player pool if the GC refuses (a lobby with spectating
     * disabled may have no caster slot to take). Being in the pool is bad; being
     * left on a *team* slot, which is where create leaves us, is worse.
     */
    async _parkSelfOutOfPlay() {
        const self = this.getSelfSteamId32();
        try {
            // channel 1 = the first caster slot.
            this.dota2.joinPracticeLobbyBroadcastChannel(1, (err) => {
                if (err)
                    logger_js_1.logger.warn('joinPracticeLobbyBroadcastChannel ack error', err);
            });
        }
        catch (e) {
            logger_js_1.logger.warn('joinPracticeLobbyBroadcastChannel threw', e);
        }
        // Every lobby ack here is unreliable, so believe the snapshot the GC
        // pushes back rather than the callback.
        await new Promise((resolve) => {
            const done = () => { clearTimeout(t); this.dota2.removeListener('practiceLobbyUpdate', done); resolve(); };
            const t = setTimeout(done, 3000);
            this.dota2.once('practiceLobbyUpdate', done);
        });
        const me = this.getCurrentLobbyPlayers().find((p) => p.steamId32 === self);
        if (me && me.team === 'broadcaster') {
            logger_js_1.logger.info('Host bot parked in the broadcaster slot — outside the draft pool');
            return true;
        }
        logger_js_1.logger.warn(`Broadcaster slot not taken (bot is '${me ? me.team : 'unknown'}') — falling back to the unassigned player pool. ` +
            `Under Immortal Draft the bot can now be dealt into the game.`);
        try {
            // joinPracticeLobbyTeam(slot, team) acts on self; team 4 = DOTA_GC_TEAM_PLAYER_POOL.
            this.dota2.joinPracticeLobbyTeam(1, 4);
            logger_js_1.logger.info('Moved host bot to the unassigned player pool');
        }
        catch (e) {
            logger_js_1.logger.warn('Failed to move bot to player pool', e);
        }
        return false;
    }
    async kickPlayer(steamId32) {
        if (!this.isConnected)
            throw new Error('Not connected to Dota 2 GC');
        const accountId = parseInt(steamId32, 10);
        this.dota2.practiceLobbyKick(accountId);
        logger_js_1.logger.debug(`Kicked player ${steamId32}`);
    }
    /**
     * Take a player out of their team slot without removing them from the lobby —
     * the GC's KickFromTeam, which is exactly what the lobby UI's right-click
     * "kick from slot" sends. They land back in the unassigned player pool and can
     * re-seat themselves; only the seat is given up, not the lobby.
     */
    async kickPlayerFromTeam(steamId32) {
        if (!this.isConnected)
            throw new Error('Not connected to Dota 2 GC');
        const accountId = parseInt(steamId32, 10);
        this.dota2.practiceLobbyKickFromTeam(accountId, (err) => {
            if (err)
                logger_js_1.logger.error(`practiceLobbyKickFromTeam(${steamId32}) ack error`, err);
        });
        logger_js_1.logger.debug(`Moved player ${steamId32} out of their team slot`);
    }
    async startGame() {
        if (!this.isConnected)
            throw new Error('Not connected to Dota 2 GC');
        // With Automatic selection priority the first launch opens the coin toss (side /
        // pick-order selection); the game only starts after a SECOND launch, fired once both
        // teams choose (see _maybeFinishCoinToss, driven by practiceLobbyUpdate). With Manual
        // priority a single launch starts the game directly.
        const rules = this._selectionPriorityRules ?? (this._currentLobby ? Number(this._currentLobby.selection_priority_rules) : 0);
        const automatic = Number(rules) === 1;
        if (automatic) {
            // Arm coin-toss handling BEFORE launching. node-dota2's launchPracticeLobby
            // callback is unreliable (often never fires) — we must NOT await/throw on it,
            // or we'd tear down the launch even though the GC opened the toss, and never
            // fire the second launch. The GC still processes the launch; we drive completion
            // off practiceLobbyUpdate, with a 90s fallback so it can never hang at selection.
            this._awaitingCoinToss = true;
            if (this._coinTossTimer)
                clearTimeout(this._coinTossTimer);
            this._coinTossTimer = setTimeout(() => {
                if (this._awaitingCoinToss) {
                    this._awaitingCoinToss = false;
                    logger_js_1.logger.warn('Coin toss timeout (90s) — firing fallback second launch');
                    this._fireLaunch();
                }
            }, 90000);
            logger_js_1.logger.info('Coin toss opened — waiting for both teams to pick side/order, then will relaunch to start');
        }
        // Fire the (first) launch. Fire-and-forget: never block on the unreliable ack.
        this._fireLaunch();
        return { coinToss: automatic };
    }
    /** Send a launchPracticeLobby. Fire-and-forget — the GC ack callback is unreliable. */
    _fireLaunch() {
        try {
            this.dota2.launchPracticeLobby((err) => {
                if (err)
                    logger_js_1.logger.error('launchPracticeLobby returned an error', err);
                else
                    logger_js_1.logger.info('launchPracticeLobby acked');
            });
            logger_js_1.logger.info('launchPracticeLobby sent');
        }
        catch (e) {
            logger_js_1.logger.error('Failed to send launchPracticeLobby', e);
        }
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
    /**
     * Fire a SINGLE launchPracticeLobby to (re)start the game WITHOUT arming the coin toss. Used to
     * resume after Dota aborts a game back to the lobby (a player/caster fails to load): the coin-toss
     * result is already applied to the lobby, so re-tossing would be wrong — one launch restarts it.
     * Also backs the !start failsafe. Fire-and-forget (the launch ack is unreliable), like _fireLaunch.
     */
    async relaunchGame() {
        if (!this.isConnected)
            throw new Error('Not connected to Dota 2 GC');
        this._clearCoinToss(); // ensure no stale coin-toss wait is armed
        logger_js_1.logger.info('Relaunching game (single launch, coin toss preserved)');
        this._fireLaunch();
    }
    async leaveLobby() {
        this._clearCoinToss();
        this._lobbyChatChannel = null;
        this._lobbyChatJoined = false;
        if (!this.isConnected)
            return;
        return new Promise((resolve) => {
            let done = false;
            const finish = () => {
                if (done)
                    return;
                done = true;
                this._currentLobby = null;
                resolve();
            };
            // leavePracticeLobby's callback may never fire if we're not actually in a lobby —
            // don't hang the command queue; resolve after a short timeout regardless.
            const t = setTimeout(finish, 8000);
            this.dota2.leavePracticeLobby((err) => {
                if (err)
                    logger_js_1.logger.warn('Error leaving lobby (non-fatal)', err);
                clearTimeout(t);
                finish();
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
                name: member.name || null,
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
            case 2: return 'broadcaster'; // caster slot — cannot be kicked via practiceLobbyKick
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
    /**
     * Rebuild the CMsgPracticeLobbySetDetails option set from the LIVE lobby cache. Used as a
     * fallback when _lastLobbyOptions is null (e.g. after a crash + reattach, where createLobby
     * wasn't called in this process). Only copies fields whose JS type matches node-dota2's
     * _lobbyOptions whitelist so _parseOptions keeps them.
     */
    _currentLobbyAsOptions() {
        const l = this._currentLobby || {};
        const opts = {};
        const num = (k) => { if (typeof l[k] === 'number') opts[k] = l[k]; };
        const str = (k) => { if (typeof l[k] === 'string') opts[k] = l[k]; };
        const bool = (k) => { if (typeof l[k] === 'boolean') opts[k] = l[k]; };
        str('game_name');
        str('pass_key');
        num('server_region');
        num('game_mode');
        num('series_type');
        num('dota_tv_delay');
        num('leagueid');
        num('pause_setting');
        num('selection_priority_rules');
        bool('allow_cheats');
        bool('fill_with_bots');
        bool('allow_spectating');
        return opts;
    }
    /**
     * Set the lobby's series score (radiant_series_wins / dire_series_wins) + draft penalty for the
     * CURRENT game. MUST be called BEFORE startGame()/the coin toss.
     *
     * IMPORTANT (verified live 2026-07-23, Cienszki test): the GC applies CMsgPracticeLobbySetDetails
     * as a REPLACE, not a merge — any settable field we OMIT is reset to its proto default. So a
     * minimal SetDetails (score only) BLANKS game_name/pass_key and resets series_type +
     * selection_priority_rules → the lobby name goes empty and the coin toss is lost (the reported
     * game-2 breakage). Fix: resend the FULL create options (incl. selection_priority_rules) with the
     * new score/penalty; every re-sent field survives, only the score/penalty change.
     *
     * Also: node-dota2's configPracticeLobby ACK callback is UNRELIABLE — it often never fires even
     * though the GC applied the change. Awaiting it hangs the runner BEFORE startGame() so game 2+
     * never launches (this — not a coin-toss re-init — was the real stall). So we DON'T await the ack;
     * we resolve on the GC pushing the updated snapshot back (practiceLobbyUpdate) or a short timeout.
     */
    async updateSeriesScore(radiantWins, direWins, penaltyLevelRadiant = 0, penaltyLevelDire = 0) {
        if (!this.isConnected)
            throw new Error('Not connected to Dota 2 GC');
        const lobby = this._currentLobby;
        if (!lobby || lobby.lobby_id === undefined || lobby.lobby_id === null) {
            logger_js_1.logger.warn('updateSeriesScore: no current lobby — skipping');
            return;
        }
        const base = (this._lastLobbyOptions && Object.keys(this._lastLobbyOptions).length)
            ? this._lastLobbyOptions
            : this._currentLobbyAsOptions();
        const options = {
            ...base,
            radiant_series_wins: radiantWins,
            dire_series_wins: direWins,
            // Admin-issued draft-time penalty levels (0 = none). Whitelisted in _lobbyOptions above.
            penalty_level_radiant: penaltyLevelRadiant || 0,
            penalty_level_dire: penaltyLevelDire || 0,
        };
        return new Promise((resolve) => {
            let settled = false;
            const finish = (why) => {
                if (settled)
                    return;
                settled = true;
                this.dota2.removeListener('practiceLobbyUpdate', onUpdate);
                clearTimeout(timer);
                logger_js_1.logger.info(`Lobby set: series radiant ${radiantWins} - dire ${direWins}, penalty radiant ${penaltyLevelRadiant || 0} - dire ${penaltyLevelDire || 0} (${why})`);
                resolve();
            };
            const onUpdate = () => finish('lobby update');
            const timer = setTimeout(() => finish('timeout'), 3000);
            this.dota2.once('practiceLobbyUpdate', onUpdate);
            try {
                // Fire-and-forget the ack — only log if it (rarely) comes back with an error.
                this.dota2.configPracticeLobby(lobby.lobby_id, options, (err) => {
                    if (err)
                        logger_js_1.logger.error('configPracticeLobby (series score / penalty) ack error', err);
                });
            }
            catch (e) {
                logger_js_1.logger.error('updateSeriesScore threw', e);
                finish('threw');
            }
        });
    }
    /**
     * Change the lobby's game mode after it has been created (!cm / !ap / !sd / !cd).
     *
     * Both hazards documented on updateSeriesScore apply here for the same reasons,
     * so this deliberately mirrors it rather than sending a tidy one-field message:
     *
     *   1. SetDetails is a REPLACE, not a merge. A minimal {game_mode} would blank
     *      game_name and pass_key and reset series_type + selection_priority_rules —
     *      i.e. switching to Captains Mode would silently wipe the lobby's name and
     *      password out from under everyone trying to find it. Resend everything.
     *   2. configPracticeLobby's ack often never fires even though the GC applied
     *      the change, so we never await it — we resolve on the updated snapshot
     *      coming back, or on a short timeout.
     *
     * Also updates _lastLobbyOptions, because that is the base a later
     * updateSeriesScore resends from: leaving the old mode in there would quietly
     * revert this the next time the series score is written.
     */
    async setGameMode(gameMode) {
        if (!this.isConnected)
            throw new Error('Not connected to Dota 2 GC');
        const lobby = this._currentLobby;
        if (!lobby || lobby.lobby_id === undefined || lobby.lobby_id === null) {
            logger_js_1.logger.warn('setGameMode: no current lobby — skipping');
            return false;
        }
        const base = (this._lastLobbyOptions && Object.keys(this._lastLobbyOptions).length)
            ? this._lastLobbyOptions
            : this._currentLobbyAsOptions();
        const options = { ...base, game_mode: gameMode };
        // Keep the resend base in step, or the next series-score write undoes this.
        this._lastLobbyOptions = { ...options };
        return new Promise((resolve) => {
            let settled = false;
            const finish = (why) => {
                if (settled)
                    return;
                settled = true;
                this.dota2.removeListener('practiceLobbyUpdate', onUpdate);
                clearTimeout(timer);
                logger_js_1.logger.info(`Lobby set: game_mode ${gameMode} (${why})`);
                resolve(true);
            };
            const onUpdate = () => finish('lobby update');
            const timer = setTimeout(() => finish('timeout'), 3000);
            this.dota2.once('practiceLobbyUpdate', onUpdate);
            try {
                this.dota2.configPracticeLobby(lobby.lobby_id, options, (err) => {
                    if (err)
                        logger_js_1.logger.error('configPracticeLobby (game mode) ack error', err);
                });
            }
            catch (e) {
                logger_js_1.logger.error('setGameMode threw', e);
                finish('threw');
            }
        });
    }
    /** The bot's OWN account id (Steam32) once logged in — used so we never kick ourselves. */
    getSelfSteamId32() {
        try {
            const raw = this.steam && this.steam.steamID ? this.steam.steamID.toString() : null;
            if (!raw)
                return null;
            const acct = BigInt(raw) - BigInt('76561197960265728');
            return acct > 0n ? acct.toString() : null;
        }
        catch {
            return null;
        }
    }
    /** Current CSODOTALobby.state as a number, or undefined if not in a lobby. */
    getCurrentLobbyState() {
        const lobby = this._currentLobby;
        if (!lobby || lobby.state === undefined || lobby.state === null)
            return undefined;
        return Number(lobby.state);
    }
    /**
     * Snapshot of the cached lobby's live fields (id, state, match id, outcome) WITHOUT waiting
     * for a fresh practiceLobbyUpdate event. Used by the runner's game-end polls (the matchId==0
     * retry and the OpenDota fallback) to re-read the started match id straight from the SO cache.
     * Returns null if not in a lobby. A Dota match id fits well within Number.MAX_SAFE_INTEGER.
     */
    getCurrentLobbyData() {
        const lobby = this._currentLobby;
        if (!lobby)
            return null;
        return {
            lobbyId: this.getCurrentLobbyId(),
            state: (lobby.state !== undefined && lobby.state !== null) ? Number(lobby.state) : undefined,
            matchId: this.longToString(lobby.match_id),
            matchOutcome: (lobby.match_outcome !== undefined && lobby.match_outcome !== null) ? Number(lobby.match_outcome) : 0,
        };
    }
    /** True if we currently hold a lobby — either freshly created or adopted from cache. */
    hasLobby() {
        return !!(this._currentLobby || (this.dota2 && this.dota2.Lobby));
    }
    /**
     * Resume managing a lobby that already exists in the GC shared-object cache.
     * After a runner crash/restart we log back in and node-dota2 repopulates its
     * lobby cache (dota2.Lobby) from the GC ClientWelcome; its own practiceLobbyUpdate
     * handler also sets this._currentLobby. This adopts whichever is present and
     * rejoins the lobby chat channel so we can keep posting. Returns the lobby id, or
     * null if there is nothing to reattach to.
     *
     * Idempotent: safe to call when already attached (it just re-ensures chat).
     */
    reattachToCachedLobby() {
        const cached = this._currentLobby || (this.dota2 && this.dota2.Lobby) || null;
        if (!cached)
            return null;
        this._currentLobby = cached;
        if (cached.selection_priority_rules !== undefined && cached.selection_priority_rules !== null) {
            this._selectionPriorityRules = Number(cached.selection_priority_rules);
        }
        this._joinLobbyChat();
        const id = this.getCurrentLobbyId();
        logger_js_1.logger.info(`Reattached to cached lobby ${id || 'unknown'}`);
        return id || null;
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
        // Custom-lobby team names live in CSODOTALobby.team_details (repeated
        // CLobbyTeamDetails, each with team_name + team_id). Radiant is team_id 0
        // (DOTA_GC_TEAM_GOOD_GUYS), Dire is team_id 1 (BAD_GUYS).
        // NOTE: CSODOTALobby has NO radiant_team_name/team_name_radiant fields
        // (those belong to spectator/watch messages), so the old lookup was always
        // empty — making the bot think teams never set a lobby name.
        const details = Array.isArray(lobby.team_details) ? lobby.team_details : [];
        const nameForTeam = (teamId, fallbackIdx) => {
            const byId = details.find((d) => d && Number(d.team_id) === teamId);
            const d = byId || details[fallbackIdx];
            return String((d && d.team_name) || '');
        };
        return {
            radiant: nameForTeam(0, 0),
            dire: nameForTeam(1, 1),
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
            // After a GC reconnect the chat-channel membership is gone and _lobbyChatChannel was
            // cleared; the GC may deliver the lobby cache AFTER re-emitting 'ready', so re-join here
            // (idempotent) as soon as the lobby is back so send/receive chat works again.
            if (this._everReady && !this._lobbyChatChannel && this.getCurrentLobbyId()) {
                this._joinLobbyChat();
            }
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
        // Chat channel join confirmation — gates sendChatMessage so we don't post before
        // the GC has actually added us to the Lobby_<id> channel.
        this.dota2.on('chatJoined', (channelData) => {
            if (channelData && channelData.channel_name && channelData.channel_name === this._lobbyChatChannel) {
                this._lobbyChatJoined = true;
                logger_js_1.logger.info('Lobby chat channel joined: ' + channelData.channel_name);
            }
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
        // ── GC session health (the key to surviving a Dota patch / GC restart) ────────────
        // node-dota2 emits 'unready' when it loses the GC session (ConnectionStatus != HAVE_SESSION)
        // and keeps re-sending ClientHello until the GC returns, then re-emits 'ready'. We must
        // track BOTH so isConnected tells the truth and we re-establish chat on recovery. Without
        // this, a GC-only blip left _inDota stale-true (isConnected reported healthy) while every
        // send silently failed and no inbound events arrived → the bot looked frozen forever.
        this.dota2.on('unready', () => {
            logger_js_1.logger.warn('Dota 2: GC session lost (unready) — node-dota2 is re-trying ClientHello');
            this._inDota = false;
            this.emit('gcUnready');
        });
        // Persistent 'ready' (connect() uses a separate once() only to resolve the connect promise).
        // Fires again every time the GC session is regained.
        this.dota2.on('ready', () => {
            this._inDota = true;
            if (this._everReady) {
                logger_js_1.logger.info('Dota 2: GC session regained (ready) — re-joining lobby chat');
                // Channel membership is dropped on a GC restart — force a fresh join of Lobby_<id>.
                this._lobbyChatJoined = false;
                this._lobbyChatChannel = null;
                if (this.getCurrentLobbyId())
                    this._joinLobbyChat();
                this.emit('gcReconnected');
            }
            this._everReady = true;
        });
        // Steam disconnection
        this.steam.on('error', (_eresult) => {
            logger_js_1.logger.warn(`Steam connection error/disconnected`);
            this._connected = false;
            this._inDota = false;
            this.emit('disconnected', 'error');
        });
        // Steam reconnection after loggedOn fires again. A full Steam drop tears down the GC session,
        // so we must RE-LAUNCH the GC handshake (gamesPlayed + dota2.launch) — merely flipping
        // _connected left the GC dead (dota2.launch was never re-called → 'ready' never re-fired).
        this.steam.on('loggedOn', () => {
            if (!this._connected) {
                logger_js_1.logger.info('Steam: Reconnected — re-launching Dota 2 GC handshake');
                this._connected = true;
                try {
                    this.steam.setPersona(steam_user_1.default.EPersonaState.Online);
                    this.steam.gamesPlayed([570]);
                    this.dota2.launch();
                } catch (e) {
                    logger_js_1.logger.error('Failed to re-launch GC after Steam reconnect', e);
                }
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
    /**
     * Resolve a player's CURRENT Steam persona name from a Steam32 id via the Steam network
     * (steam-user.getPersonas). Used for human-readable kick messages when the GC lobby member
     * object doesn't carry a name yet (common right after a player joins). Cached per id, and
     * never throws — returns null on any failure so callers can fall back to the id.
     */
    async getPersonaName(steamId32) {
        const acct = parseInt(steamId32, 10);
        if (!acct)
            return null;
        const steamId64 = this.steam32ToSteam64(acct);
        if (this._personaCache.has(steamId64))
            return this._personaCache.get(steamId64);
        if (!this._connected)
            return null;
        try {
            const result = await this.steam.getPersonas([steamId64]);
            const personas = (result && result.personas) ? result.personas : (result || {});
            let p = personas[steamId64] || personas[String(steamId64)];
            if (!p) {
                const vals = Object.values(personas);
                if (vals.length)
                    p = vals[0];
            }
            const name = p && (p.player_name || p.playerName);
            const clean = (name && String(name).trim()) ? String(name).trim() : null;
            if (clean)
                this._personaCache.set(steamId64, clean);
            return clean;
        }
        catch (e) {
            logger_js_1.logger.warn('getPersonaName failed for ' + steamId32, e);
            return null;
        }
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
exports.DotaClient = DotaClient;
