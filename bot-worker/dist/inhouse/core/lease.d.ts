import type { Firestore } from 'firebase-admin/firestore';
/**
 * How long a lease survives without a heartbeat before another game may take
 * the account. Generous relative to the worker's 30s heartbeat, so a slow
 * Firestore write never steals a live lobby's account.
 */
export declare const LEASE_TIMEOUT_MS: number;
export interface LeaseResult {
    ok: boolean;
    botAccountId?: string;
    reason?: 'none_available';
}
/**
 * Claim an idle Steam account for a game.
 *
 * Runs in a transaction over the candidate documents so two games created in
 * the same second cannot both claim the same account — which would leave one of
 * them silently without a lobby.
 */
export declare function leaseAccount(db: Firestore, gameId: string): Promise<LeaseResult>;
/** Renew a lease. Called by the worker heartbeat. */
export declare function renewLease(db: Firestore, botAccountId: string, gameId: string): Promise<void>;
/** Return an account to the pool. Safe to call more than once. */
export declare function releaseAccount(db: Firestore, botAccountId: string): Promise<void>;
/**
 * How many accounts are currently leased, and how many exist.
 *
 * Instrument *lobby-open duration* alongside this early: that single number
 * tells you how many accounts you actually need (§12).
 */
export declare function poolStatus(db: Firestore): Promise<{
    total: number;
    leased: number;
}>;
