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
 * Build the GC-facing lobby settings from a resolved inhouse settings object.
 *
 * **The Dota lobby is always Public, published or not.** `published` used to be
 * mapped onto DOTALobbyVisibility (unpublished → Unlisted), on the reasoning
 * that an unpublished game should be hard to stumble into. In practice that
 * made the in-game lobby behave differently from every other lobby people know
 * — it could not be found in the browser at all, so even the friends the host
 * deliberately sent the name and password to could not get in.
 *
 * `published` means one thing now: whether the game is advertised on the
 * website and the Discord channel. Entry is gated where it has always actually
 * been gated, by the password.
 *
 * `published` is kept as a parameter because callers pass it and it stays part
 * of this mapper's question; it simply no longer changes the answer.
 */
function toInhouseLobbySettings(settings, published) {
    void published;
    return {
        gameMode: settings.gameMode,
        serverRegion: settings.serverRegion,
        visibility: core_1.LOBBY_VISIBILITY.public,
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
        // Only sent when actually asked for: false and undefined are the same lobby,
        // and not sending the field keeps a schema that lacks it out of trouble.
        ...(settings.immortalDraft ? { doPlayerDraft: true } : {}),
    };
}
