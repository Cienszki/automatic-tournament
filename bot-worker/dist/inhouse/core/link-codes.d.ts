import type { InhouseStore } from './store';
/** Codes expire quickly — the player is meant to use it during this lobby. */
export declare const LINK_CODE_TTL_SECONDS: number;
export declare function generateCode(length?: number): string;
/**
 * Issue a code for a Steam ID, retrying on collision.
 *
 * With a 31-character alphabet and 4 places there are ~920k codes; collisions
 * against the small set of live codes are vanishingly rare, but a collision
 * would hand one player's link to another, so it is checked rather than assumed.
 */
export declare function issueLinkCode(store: InhouseStore, steamId32: string, playerName: string | null): Promise<string>;
