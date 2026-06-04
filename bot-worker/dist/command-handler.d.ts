import type { Firestore } from 'firebase-admin/firestore';
import type { DotaClient } from './dota-client.js';
/**
 * Watches the Firestore command queue for a specific bot account
 * and executes commands on the Dota 2 client.
 */
export declare class CommandHandler {
    private db;
    private botAccountId;
    private dotaClient;
    private pollIntervalMs;
    private isProcessing;
    private pollInterval;
    /** Commands older than this (ms) are skipped and marked as expired */
    private static readonly MAX_COMMAND_AGE_MS;
    /** Warn if queue has more than this many pending commands */
    private static readonly QUEUE_SIZE_WARNING;
    constructor(db: Firestore, botAccountId: string, dotaClient: DotaClient, pollIntervalMs?: number);
    /**
     * Start polling for commands
     */
    start(): void;
    /**
     * Stop polling
     */
    stop(): void;
    /**
     * Poll for pending commands and process them sequentially
     */
    private pollAndProcess;
    /**
     * Execute a single command on the Dota 2 client
     */
    private executeCommand;
    /**
     * Write an event document to Firestore for the orchestrator
     */
    private emitEvent;
}
