"use strict";
// src/inhouse/lobby-settings.ts
//
// Maps an inhouseGames document's `settings` (already resolved by the website
// at creation — see runner.ts, never re-resolved here) onto the shape
// dota-client.js's createLobby()/LobbyCreateOptions expects.
//
// This is a genuinely different mapper from the tournament path's
// runner-logic.js's toLobbyCreateSettings, not a shared one: that mapper
// expects string keys from admin-typed config ('all_pick', 'europe_west', …)
// and does its own string→enum lookup. inhouseGames.settings is already
// GC-native numbers (gameMode: 22, serverRegion: 3, …) — resolved once by the
// website's `resolveSettings()` (packages/core/src/settings.ts) — so this is
// a near-identity pass-through, not a translation layer.
Object.defineProperty(exports, "__esModule", { value: true });
exports.toInhouseLobbySettings = toInhouseLobbySettings;
const core_1 = require("./core");
/**
 * Build the GC-facing lobby settings from a resolved inhouse settings object
 * and the game's current `published` flag.
 *
 * Visibility is deliberately derived, never read from `settings` — publishing
 * from the website or `!publish` in lobby chat are the same action, and
 * deriving from `published` here is what keeps a republished/unpublished game
 * consistent no matter which surface changed it.
 */
function toInhouseLobbySettings(settings, published) {
    return {
        gameMode: settings.gameMode,
        serverRegion: settings.serverRegion,
        visibility: (0, core_1.lobbyVisibilityFor)(published),
        dotaTvDelay: settings.dotaTvDelay,
        // Inhouses are single games, never a series — 0 = none, matching the
        // tournament path's own DOTA_GC series_type enum.
        seriesType: 0,
        leagueId: settings.leagueId || undefined,
        cheatsEnabled: settings.cheatsEnabled,
        fillWithBots: settings.fillWithBots,
        allowSpectators: settings.allowSpectators,
        pauseSetting: settings.pauseSetting,
        selectionPriorityRules: settings.selectionPriorityRules,
    };
}
