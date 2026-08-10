import type { Firestore } from 'firebase-admin/firestore';
export interface InhouseLobbyCommandPayload {
    gameId: string;
    lobby?: {
        name?: string | null;
        password?: string | null;
    };
    /** Legacy flat shape some older queued commands may still use. */
    lobbyName?: string | null;
    lobbyPassword?: string | null;
}
export interface CommandQueueHooks {
    /** `create_inhouse_lobby` — must check internally whether a lobby already exists and no-op if so. */
    createInhouseLobby: (payload: InhouseLobbyCommandPayload) => Promise<void>;
    invitePlayer: (steamId32: string) => Promise<void>;
    kickPlayer: (steamId32: string) => Promise<void>;
    sendChat: (message: string) => Promise<void>;
    /** `end_inhouse_session` — the website has already moved the game to a terminal state; leave + release, don't re-transition it. */
    endSession: (reason: string | null) => Promise<void>;
}
/**
 * Watches one bot account's command queue for the duration of one inhouse
 * game. Only commands whose `gameId` matches the game this runner owns are
 * processed — a residual command from a previous lease of this account is
 * left alone (and will simply expire).
 */
export declare class CommandQueue {
    private db;
    private botAccountId;
    private gameId;
    private hooks;
    private interval;
    private polling;
    constructor(db: Firestore, botAccountId: string, gameId: string, hooks: CommandQueueHooks);
    start(): void;
    stop(): void;
    /** Run one poll immediately and wait for it — used at startup so the first `create_inhouse_lobby` isn't waiting on the next tick. */
    pollNow(): Promise<void>;
    private poll;
    private processOne;
    private dispatch;
    private markDone;
}
