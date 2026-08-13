import type { ResolvedSettings } from './core/types';
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
export declare function toInhouseLobbySettings(settings: ResolvedSettings, published: boolean): InhouseLobbySettings;
