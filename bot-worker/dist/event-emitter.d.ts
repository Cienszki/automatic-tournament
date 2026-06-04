import type { Firestore } from 'firebase-admin/firestore';
import type { DotaClient } from './dota-client.js';
/**
 * Bridges DotaClient events → Firestore event documents.
 * The orchestrator (Next.js API) polls these events and updates lobby sessions.
 */
export declare class EventBridge {
    private db;
    private botAccountId;
    private dotaClient;
    private heartbeatIntervalMs;
    private heartbeatInterval;
    private currentSessionId;
    private previousPlayers;
    private gameDetected;
    constructor(db: Firestore, botAccountId: string, dotaClient: DotaClient, heartbeatIntervalMs?: number);
    /**
     * Start listening to Dota 2 client events and bridging them to Firestore
     */
    start(sessionId?: string): void;
    /**
     * Stop listening and clean up
     */
    stop(): void;
    /**
     * Set the current session ID (when assigned to a new session)
     */
    setSessionId(sessionId: string): void;
    /**
     * Clear the current session (when session is complete)
     */
    clearSession(): void;
    private handleLobbyUpdate;
    private handleChatMessage;
    private handleLobbyCleared;
    private handleSourceTVData;
    private sendHeartbeat;
    private emitEvent;
}
