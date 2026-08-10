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
