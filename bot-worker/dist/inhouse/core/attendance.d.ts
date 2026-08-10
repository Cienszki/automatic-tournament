import type { InhouseStore } from './store';
import type { AttendanceRecord, InhouseGame } from './types';
import { type Award } from './awards';
import { type SteamMatchDetails } from './steam-api';
export interface OpenDotaPlayer {
    account_id?: number;
    player_slot?: number;
    hero_id?: number;
    personaname?: string;
    [key: string]: unknown;
}
export interface OpenDotaMatch {
    match_id: number;
    radiant_win: boolean;
    duration: number;
    start_time: number;
    /** Present once the replay has been parsed. Many award metrics need it. */
    version?: number | null;
    players: OpenDotaPlayer[];
    [key: string]: unknown;
}
/** `player_slot` < 128 means Radiant. This is the OpenDota/Valve convention. */
export declare function sideFromSlot(playerSlot: number | undefined): 'radiant' | 'dire';
export declare function fetchMatch(matchId: number): Promise<OpenDotaMatch | null>;
export interface IngestOptions {
    /** Give up waiting for the Steam API after this long. Default 20 minutes. */
    maxWaitMs?: number;
    /** First poll delay. Default 15s, backing off to 2 min. */
    initialDelayMs?: number;
    /**
     * Also chase OpenDota for the parsed data the silly awards need.
     * Default true. Runs in the background and never delays the ledger.
     */
    fetchAwards?: boolean;
}
export interface IngestResult {
    gameId: string;
    matchId: number;
    attendance: AttendanceRecord[];
    awards: Award[];
    radiantWin: boolean;
    durationSeconds: number;
    /** True once OpenDota's parsed data has been folded in. */
    parsed: boolean;
    /** Steam IDs that abandoned the match, for the host and admins only. */
    abandoners: string[];
}
/**
 * Resolve a finished match and write everything derived from it.
 *
 * Called when the GC tears the lobby down, which is the match-end signal.
 *
 * Safe to call more than once for the same game: the ledger write is keyed on
 * (gameId, steamId32) and a pre-check short-circuits a completed ingestion, so
 * a retried job can't double-count anyone's attendance.
 */
export declare function ingestMatchResult(store: InhouseStore, game: InhouseGame, matchId: number, options?: IngestOptions): Promise<IngestResult | null>;
/**
 * The write half of ingestion, split out so it can be driven from a webhook or
 * an admin re-run.
 */
export declare function writeMatchResult(store: InhouseStore, game: InhouseGame, match: SteamMatchDetails): Promise<IngestResult>;
/**
 * Chase OpenDota for the parsed replay and fold the silly awards in.
 *
 * Entirely optional. Every metric the awards use — couriers lost, time spent
 * dead, tangos bought — only exists after the replay parses, and plenty of
 * matches never do. Nothing waits on this and nothing breaks without it.
 */
export declare function backfillAwards(store: InhouseStore, gameId: string, matchId: number, maxWaitMs?: number): Promise<Award[]>;
/**
 * Retroactive credit (§3).
 *
 * Because every inhouse is a league match, the full roster is on record. When
 * someone finally links, backfill their entire history — nothing else converts
 * a stubborn holdout as reliably as showing them what they've already earned.
 */
export declare function backfillOnLink(store: InhouseStore, discordId: string, steamId32: string): Promise<{
    gamesFound: number;
    nightsFound: number;
    heroesFound: number;
}>;
