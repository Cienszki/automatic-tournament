"use strict";
// @dota2inhouse/core
//
// Shared inhouse domain logic. Consumed by two independent codebases:
//
//   - the lobby bot   (this repo: Discord gateway + Steam/Dota workers)
//   - the website     (separate repo: public pages, member surfaces, admin panel)
//
// Everything in here is safety-critical to keep identical across both. Three
// pieces in particular produce bugs that only appear under load if they drift:
//
//   InhouseStore.createReservation        race-safe slot allocation
//   InhouseStore.createModerationRecord   ban record + enforcement index
//   InhouseStore.computeSlots             the in-lobby / reserved double-count fix
//
// That is the whole reason this package exists. Reimplementing any of them on
// one side is how you get a lobby that overbooks at nine players, or a ban that
// silently doesn't enforce.
//
// Deliberately NOT here — worker-only, and dependent on a live Dota connection:
//   ban-guard.ts     kicks a banned Steam ID out of a lobby
//   chat-commands.ts the `!command` surface
//   session.ts       per-game orchestration against the Game Coordinator
//   fun.ts           `!roll`, `!coin`, `!wisdom` and friends
//
// There is no team-balancing or player-rating logic here, and there must not
// be: teams are decided in Dota, not by this system.
Object.defineProperty(exports, "__esModule", { value: true });
exports.setLogSink = exports.logger = exports.LINK_CODE_TTL_SECONDS = exports.issueLinkCode = exports.generateCode = exports.selectAwards = exports.AWARDS = exports.SteamApiError = exports.abandoned = exports.waitForMatchDetails = exports.fetchMatchDetails = exports.sideFromSlot = exports.fetchMatch = exports.backfillOnLink = exports.backfillAwards = exports.writeMatchResult = exports.ingestMatchResult = exports.LEASE_TIMEOUT_MS = exports.poolStatus = exports.releaseAccount = exports.renewLease = exports.leaseAccount = exports.DEFAULT_MAX_OPEN_LOBBIES = exports.LOBBY_CAPACITY = exports.COLLECTIONS = exports.InhouseStore = exports.formatSettings = exports.parseSettingCommand = exports.normalizeDotaTvDelay = exports.resolveSettings = exports.CHANGEABLE_SETTINGS = exports.TOURNAMENT_SETTINGS = exports.DEFAULT_SETTINGS = exports.lobbyVisibilityFor = exports.LOBBY_VISIBILITY = exports.DOTA_TV_DELAYS = exports.SERVER_REGION_NAMES = exports.SERVER_REGIONS = exports.GAME_MODE_NAMES = exports.GAME_MODES = exports.isTerminal = exports.PLAYING_SIDES = exports.TERMINAL_STATES = exports.ACCOUNT_HOLDING_STATES = void 0;
var types_1 = require("./types");
Object.defineProperty(exports, "ACCOUNT_HOLDING_STATES", { enumerable: true, get: function () { return types_1.ACCOUNT_HOLDING_STATES; } });
Object.defineProperty(exports, "TERMINAL_STATES", { enumerable: true, get: function () { return types_1.TERMINAL_STATES; } });
Object.defineProperty(exports, "PLAYING_SIDES", { enumerable: true, get: function () { return types_1.PLAYING_SIDES; } });
Object.defineProperty(exports, "isTerminal", { enumerable: true, get: function () { return types_1.isTerminal; } });
// ─── Settings (§4) ───────────────────────────────────────────────────────────
var settings_1 = require("./settings");
Object.defineProperty(exports, "GAME_MODES", { enumerable: true, get: function () { return settings_1.GAME_MODES; } });
Object.defineProperty(exports, "GAME_MODE_NAMES", { enumerable: true, get: function () { return settings_1.GAME_MODE_NAMES; } });
Object.defineProperty(exports, "SERVER_REGIONS", { enumerable: true, get: function () { return settings_1.SERVER_REGIONS; } });
Object.defineProperty(exports, "SERVER_REGION_NAMES", { enumerable: true, get: function () { return settings_1.SERVER_REGION_NAMES; } });
Object.defineProperty(exports, "DOTA_TV_DELAYS", { enumerable: true, get: function () { return settings_1.DOTA_TV_DELAYS; } });
Object.defineProperty(exports, "LOBBY_VISIBILITY", { enumerable: true, get: function () { return settings_1.LOBBY_VISIBILITY; } });
Object.defineProperty(exports, "lobbyVisibilityFor", { enumerable: true, get: function () { return settings_1.lobbyVisibilityFor; } });
Object.defineProperty(exports, "DEFAULT_SETTINGS", { enumerable: true, get: function () { return settings_1.DEFAULT_SETTINGS; } });
Object.defineProperty(exports, "TOURNAMENT_SETTINGS", { enumerable: true, get: function () { return settings_1.TOURNAMENT_SETTINGS; } });
Object.defineProperty(exports, "CHANGEABLE_SETTINGS", { enumerable: true, get: function () { return settings_1.CHANGEABLE_SETTINGS; } });
Object.defineProperty(exports, "resolveSettings", { enumerable: true, get: function () { return settings_1.resolveSettings; } });
Object.defineProperty(exports, "normalizeDotaTvDelay", { enumerable: true, get: function () { return settings_1.normalizeDotaTvDelay; } });
Object.defineProperty(exports, "parseSettingCommand", { enumerable: true, get: function () { return settings_1.parseSettingCommand; } });
Object.defineProperty(exports, "formatSettings", { enumerable: true, get: function () { return settings_1.formatSettings; } });
// ─── Firestore access ────────────────────────────────────────────────────────
var store_1 = require("./store");
Object.defineProperty(exports, "InhouseStore", { enumerable: true, get: function () { return store_1.InhouseStore; } });
Object.defineProperty(exports, "COLLECTIONS", { enumerable: true, get: function () { return store_1.COLLECTIONS; } });
Object.defineProperty(exports, "LOBBY_CAPACITY", { enumerable: true, get: function () { return store_1.LOBBY_CAPACITY; } });
Object.defineProperty(exports, "DEFAULT_MAX_OPEN_LOBBIES", { enumerable: true, get: function () { return store_1.DEFAULT_MAX_OPEN_LOBBIES; } });
// ─── Steam account leasing (§12) ─────────────────────────────────────────────
var lease_1 = require("./lease");
Object.defineProperty(exports, "leaseAccount", { enumerable: true, get: function () { return lease_1.leaseAccount; } });
Object.defineProperty(exports, "renewLease", { enumerable: true, get: function () { return lease_1.renewLease; } });
Object.defineProperty(exports, "releaseAccount", { enumerable: true, get: function () { return lease_1.releaseAccount; } });
Object.defineProperty(exports, "poolStatus", { enumerable: true, get: function () { return lease_1.poolStatus; } });
Object.defineProperty(exports, "LEASE_TIMEOUT_MS", { enumerable: true, get: function () { return lease_1.LEASE_TIMEOUT_MS; } });
// ─── Result ingestion (§12) ──────────────────────────────────────────────────
var attendance_1 = require("./attendance");
Object.defineProperty(exports, "ingestMatchResult", { enumerable: true, get: function () { return attendance_1.ingestMatchResult; } });
Object.defineProperty(exports, "writeMatchResult", { enumerable: true, get: function () { return attendance_1.writeMatchResult; } });
Object.defineProperty(exports, "backfillAwards", { enumerable: true, get: function () { return attendance_1.backfillAwards; } });
Object.defineProperty(exports, "backfillOnLink", { enumerable: true, get: function () { return attendance_1.backfillOnLink; } });
Object.defineProperty(exports, "fetchMatch", { enumerable: true, get: function () { return attendance_1.fetchMatch; } });
Object.defineProperty(exports, "sideFromSlot", { enumerable: true, get: function () { return attendance_1.sideFromSlot; } });
var steam_api_1 = require("./steam-api");
Object.defineProperty(exports, "fetchMatchDetails", { enumerable: true, get: function () { return steam_api_1.fetchMatchDetails; } });
Object.defineProperty(exports, "waitForMatchDetails", { enumerable: true, get: function () { return steam_api_1.waitForMatchDetails; } });
Object.defineProperty(exports, "abandoned", { enumerable: true, get: function () { return steam_api_1.abandoned; } });
Object.defineProperty(exports, "SteamApiError", { enumerable: true, get: function () { return steam_api_1.SteamApiError; } });
// ─── Silly awards (§10) ──────────────────────────────────────────────────────
var awards_1 = require("./awards");
Object.defineProperty(exports, "AWARDS", { enumerable: true, get: function () { return awards_1.AWARDS; } });
Object.defineProperty(exports, "selectAwards", { enumerable: true, get: function () { return awards_1.selectAwards; } });
// ─── Steam ↔ Discord linking (§3) ────────────────────────────────────────────
var link_codes_1 = require("./link-codes");
Object.defineProperty(exports, "generateCode", { enumerable: true, get: function () { return link_codes_1.generateCode; } });
Object.defineProperty(exports, "issueLinkCode", { enumerable: true, get: function () { return link_codes_1.issueLinkCode; } });
Object.defineProperty(exports, "LINK_CODE_TTL_SECONDS", { enumerable: true, get: function () { return link_codes_1.LINK_CODE_TTL_SECONDS; } });
// ─── Logging ─────────────────────────────────────────────────────────────────
var logger_1 = require("./logger");
Object.defineProperty(exports, "logger", { enumerable: true, get: function () { return logger_1.logger; } });
Object.defineProperty(exports, "setLogSink", { enumerable: true, get: function () { return logger_1.setLogSink; } });
