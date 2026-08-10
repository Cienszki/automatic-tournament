import type { InhouseStore } from './core';
export interface BanGuardHooks {
    /** Remove the player from the Dota lobby. */
    kick: (steamId32: string) => Promise<void>;
    /** Send a one-line notice in lobby chat. Optional — silence is also fine. */
    announce?: (message: string) => Promise<void>;
    /** Report the enforcement so the website can show it happened. */
    report?: (payload: {
        steamId32: string;
        moderationId: string | null;
        reason: string;
    }) => Promise<void>;
}
/**
 * Checks arriving players against the ban index and kicks the banned ones.
 *
 * Results are cached per lobby session: a banned player who keeps rejoining
 * would otherwise generate one Firestore read per attempt, and a determined
 * griefer can rejoin fast. The cache is per-instance and cleared between
 * sessions, so an admin's unban takes effect on the next lobby at the latest —
 * and immediately for anyone not already cached.
 */
export declare class BanGuard {
    private store;
    private hooks;
    private cache;
    private static readonly CACHE_TTL_MS;
    constructor(store: InhouseStore, hooks: BanGuardHooks);
    /** Drop cached decisions. Call when a session ends or an unban is broadcast. */
    reset(): void;
    /** Forget one player, so an unban applies without waiting for the TTL. */
    forget(steamId32: string): void;
    /**
     * Returns true when the player was banned and has been kicked.
     *
     * Fails **open** on a Firestore error: a transient outage should not turn
     * every arriving player into a kick. The other enforcement points still
     * apply, and the error is logged loudly.
     */
    enforce(steamId32: string, playerName?: string | null): Promise<boolean>;
}
