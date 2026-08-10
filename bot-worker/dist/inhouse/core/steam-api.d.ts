export interface SteamMatchPlayer {
    account_id?: number;
    player_slot: number;
    hero_id?: number;
    kills?: number;
    deaths?: number;
    assists?: number;
    leaver_status?: number;
    [key: string]: unknown;
}
export interface SteamMatchDetails {
    match_id: number;
    radiant_win: boolean;
    duration: number;
    start_time: number;
    lobby_type?: number;
    leagueid?: number;
    players: SteamMatchPlayer[];
    [key: string]: unknown;
}
/** `player_slot` < 128 means Radiant — the Valve convention. */
export declare function sideFromSlot(playerSlot: number | undefined): 'radiant' | 'dire';
/**
 * `leaver_status` 0 = stayed to the end, 1 = disconnected, 2+ = abandoned.
 *
 * Worth keeping: an abandon is the difference between "played a game" and "made
 * nine other people waste an hour", and it is the only reliable signal for it.
 */
export declare function abandoned(player: SteamMatchPlayer): boolean;
export declare class SteamApiError extends Error {
    readonly retryable: boolean;
    constructor(message: string, retryable: boolean);
}
/**
 * Fetch match details once.
 *
 * Returns null when the match exists but Valve isn't serving it yet — which
 * happens for a minute or two after a game ends, and is the normal case when
 * polling starts immediately on lobby teardown.
 *
 * Throws `SteamApiError` for configuration problems (missing or rejected key)
 * so they surface instead of looking like an unfinished match forever.
 */
export declare function fetchMatchDetails(matchId: number | string): Promise<SteamMatchDetails | null>;
/**
 * Poll until the match resolves.
 *
 * Starts fast, because a match that just ended usually appears within a minute,
 * and backs off so a match that is never going to resolve costs little.
 */
export declare function waitForMatchDetails(matchId: number | string, options?: {
    maxWaitMs?: number;
    initialDelayMs?: number;
}): Promise<SteamMatchDetails | null>;
