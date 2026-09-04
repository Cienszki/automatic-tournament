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
export declare function toInhouseLobbySettings(settings: ResolvedSettings, published: boolean): InhouseLobbySettings;
