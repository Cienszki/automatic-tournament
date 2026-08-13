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

import type { ResolvedSettings } from './core/types';
import { lobbyVisibilityFor } from './core';

/** The subset of LobbyCreateOptions this mapper is responsible for — name/password come from the create command payload, not from settings. */
export interface InhouseLobbySettings {
  gameMode: number;
  serverRegion: number;
  visibility: number;
  dotaTvDelay: number;
  seriesType: number;
  leagueId?: number;
  cheatsEnabled: boolean;
  fillWithBots: boolean;
  allowSpectators: boolean;
  pauseSetting: number;
  selectionPriorityRules?: number;
  /**
   * Immortal Draft. Named for the GC field (`do_player_draft`) rather than for
   * the setting, because that is the only name anything downstream answers to —
   * the whitelist key, the proto field and the Dockerfile patch all use it.
   */
  doPlayerDraft?: boolean;
}

/**
 * Build the GC-facing lobby settings from a resolved inhouse settings object
 * and the game's current `published` flag.
 *
 * Visibility is deliberately derived, never read from `settings` — publishing
 * from the website or `!publish` in lobby chat are the same action, and
 * deriving from `published` here is what keeps a republished/unpublished game
 * consistent no matter which surface changed it.
 */
export function toInhouseLobbySettings(
  settings: ResolvedSettings,
  published: boolean
): InhouseLobbySettings {
  return {
    gameMode: settings.gameMode,
    serverRegion: settings.serverRegion,
    visibility: lobbyVisibilityFor(published),
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
