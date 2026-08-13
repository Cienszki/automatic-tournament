import type { Firestore } from 'firebase-admin/firestore';
import { type Client } from 'discord.js';
import type { GatewayConfig } from './config';
export declare class LobbyBoard {
    private db;
    private client;
    private config;
    private cards;
    private unsubscribe;
    private store;
    constructor(db: Firestore, client: Client, config: GatewayConfig);
    start(): Promise<void>;
    stop(): void;
    private channel;
    /** Post or edit the card for one game. Serialised per game. */
    private upsert;
    private render;
    /** Delete the card for a game that is no longer on the board. */
    private retire;
    /**
     * Delete cards for games that ended while the gateway was down.
     *
     * Without this, a restart leaves a "dołącz!" card for a game that finished
     * hours ago — the snapshot only reports what changed while we were listening,
     * and a game that left the query in the meantime is simply absent rather than
     * reported as removed.
     */
    private removeStaleCards;
    /** Names come from memberships; counts come from the snapshot the worker writes. */
    private buildModel;
}
