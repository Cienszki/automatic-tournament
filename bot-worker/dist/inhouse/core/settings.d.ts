import type { InhouseSettings, ResolvedSettings } from './types';
/**
 * DOTA_GameMode values accepted by `!mode`.
 *
 * Note on "All Pick": the modern Dota client's lobby dropdown labelled
 * "All Pick" is DOTA_GAMEMODE_ALL_DRAFT (22), not the legacy
 * DOTA_GAMEMODE_AP (1). Both are exposed — `ap` gives you what players expect.
 */
export declare const GAME_MODES: Record<string, number>;
export declare const GAME_MODE_NAMES: Record<number, string>;
/** EServerRegion values accepted by `!region`. */
export declare const SERVER_REGIONS: Record<string, number>;
export declare const SERVER_REGION_NAMES: Record<number, string>;
/** Valid DotaTV delays, in seconds — the GC only accepts these four. */
export declare const DOTA_TV_DELAYS: readonly [10, 120, 300, 900];
/** DOTALobbyVisibility. */
export declare const LOBBY_VISIBILITY: {
    readonly public: 0;
    readonly friends: 1;
    readonly unlisted: 2;
};
/**
 * Lobby visibility follows publication, and is derived rather than configured.
 *
 * This is load-bearing for the most common way people actually join: they see
 * the game mentioned, open Dota, and find the lobby in the in-game browser
 * without ever touching Discord or the website.
 *
 *   unpublished → Unlisted. Invisible in the browser, so only the people the
 *                 host tells can find it. That is what "choose who to hear
 *                 about it first" means in practice.
 *   published   → Public. Listed in the browser and joinable by anyone with
 *                 the password, which is the whole point of publishing.
 *
 * The password still gates entry in both cases; visibility only controls
 * whether the lobby is *discoverable*.
 */
export declare function lobbyVisibilityFor(published: boolean): number;
/**
 * Baseline settings for an inhouse game. The admin panel overrides these
 * centrally (see docs/admin-panel-notes.md); nothing here is per-game.
 *
 * `leagueId: 0` means "not configured". A game created with leagueId 0 will
 * still run, but the match is NOT publicly retrievable, which breaks the
 * attendance ledger and every match page. The worker logs a loud warning.
 */
export declare const DEFAULT_SETTINGS: ResolvedSettings;
/**
 * Settings a tournament session inherits. Preserves the behaviour that existed
 * before inhouses: Captains Mode, no reservations, no publish flow.
 */
export declare const TOURNAMENT_SETTINGS: ResolvedSettings;
/**
 * Merge zero or more partial settings layers over the mode-appropriate baseline.
 * Later layers win. Undefined/absent fields never clobber an earlier layer.
 *
 * The mode is taken from the LAST layer that specifies one, because the mode
 * decides which baseline applies.
 */
export declare function resolveSettings(...layers: Array<Record<string, unknown> | InhouseSettings | undefined | null>): ResolvedSettings;
/** Snap an arbitrary delay to the nearest valid DotaTV enum value. */
export declare function normalizeDotaTvDelay(seconds: number): number;
export interface SettingChange {
    ok: boolean;
    /** The settings patch to apply, when ok. */
    patch?: Partial<InhouseSettings>;
    /** One-line lobby-chat response. Always present. */
    message: string;
}
/**
 * Parse an initiator setting override from lobby chat.
 * `key` is the command word without the leading `!`.
 *
 * Returns a patch rather than mutating, so the caller decides whether the game
 * is still pre-start (settings are frozen once the match launches).
 */
export declare function parseSettingCommand(key: string, rawArg: string): SettingChange;
/** The settings `!settings` prints, in the order it prints them. */
export declare function formatSettings(s: ResolvedSettings): string;
/** What `!help settings` lists. */
export declare const CHANGEABLE_SETTINGS: readonly ["mode", "region", "delay", "immortal", "firstpick"];
