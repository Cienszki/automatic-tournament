"use strict";
// src/inhouse/proto-patch.ts
//
// node-dota2's createPracticeLobby/configPracticeLobby filter every option
// through Dota2._lobbyOptions (a key whitelist) before building
// CMsgPracticeLobbySetDetails — see dota-client.js:66-88, which already
// patches this same whitelist for `selection_priority_rules` and the draft
// penalty fields. That whitelist has never included `visibility` (confirmed:
// zero matches for "visibility" in node_modules/dota2/handlers/lobbies.js),
// even though dota-client.js's own createLobby() unconditionally builds
// `visibility: options.visibility` into the outgoing options
// (dota-client.js:373). The field is silently dropped before it reaches the
// GC, so every lobby is created Public regardless of what's requested.
//
// This has never been hit on the tournament path — tournament lobbies are
// always LOBBY_VISIBILITY.unlisted and nobody varies it — but it is load
// bearing for inhouses: an unpublished lobby that's actually Public defeats
// the whole "host chooses who hears about it first" invariant.
//
// Patching the shared `dota2` module object is idempotent and safe regardless
// of load order or how many times this runs — see the identical reasoning in
// dota-client.js's own patch block, which this mirrors.
//
// Import this before anything calls DotaClient.createLobby()/updateSeriesScore-
// equivalent — conventionally the first line of inhouse-runner.ts, for the same
// reason dota-client.js patches itself at module-load time rather than lazily.
Object.defineProperty(exports, "__esModule", { value: true });
exports.patchLobbyVisibilityWhitelist = patchLobbyVisibilityWhitelist;
exports.patchPlayerDraftWhitelist = patchPlayerDraftWhitelist;
const logger_1 = require("../logger");
function patchLobbyVisibilityWhitelist() {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const dota2mod = require('dota2');
        if (dota2mod._lobbyOptions && dota2mod._lobbyOptions.visibility === undefined) {
            dota2mod._lobbyOptions.visibility = 'number';
            logger_1.logger.info('[InhouseRunner] Patched dota2 _lobbyOptions to allow visibility (public/unlisted)');
        }
    }
    catch (e) {
        logger_1.logger.warn('[InhouseRunner] Could not patch dota2 _lobbyOptions for visibility', e);
    }
}
/**
 * Same whitelist, for Immortal Draft — `do_player_draft` (field 53).
 *
 * Unlike `visibility`, this one is only safe once the *schema* has the field
 * too, which is a Dockerfile patch (Fix 4): protobufjs throws
 * "#do_player_draft is not a field" when a message is built with a field the
 * schema doesn't know, and createPracticeLobby builds every lobby through this
 * same message — including tournament lobbies. Whitelisting an unpatched schema
 * would therefore break lobby creation for the whole bot, not just inhouses.
 *
 * So the schema is asked first, by construction, and a failed check leaves the
 * whitelist alone: Immortal Draft silently degrades to a normal lobby, exactly
 * as it does today, and nothing else changes.
 */
function patchPlayerDraftWhitelist() {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const dota2mod = require('dota2');
        if (!dota2mod._lobbyOptions || dota2mod._lobbyOptions.do_player_draft !== undefined)
            return;
        const Details = dota2mod.schema?.CMsgPracticeLobbySetDetails;
        if (!Details)
            return;
        try {
            new Details({ do_player_draft: true });
        }
        catch {
            logger_1.logger.warn('[InhouseRunner] The lobby schema has no do_player_draft field — Immortal Draft will be ' +
                'ignored and lobbies created normally. The Dockerfile proto patch (Fix 4) did not apply.');
            return;
        }
        dota2mod._lobbyOptions.do_player_draft = 'boolean';
        logger_1.logger.info('[InhouseRunner] Patched dota2 _lobbyOptions to allow do_player_draft (Immortal Draft)');
    }
    catch (e) {
        logger_1.logger.warn('[InhouseRunner] Could not patch dota2 _lobbyOptions for do_player_draft', e);
    }
}
patchLobbyVisibilityWhitelist();
patchPlayerDraftWhitelist();
