import { InhouseStore } from './core/store';
import type { InhouseGame, SlotCounts } from './core/types';
export interface CommandContext {
    game: InhouseGame;
    steamId32: string;
    playerName: string;
    args: string[];
    rest: string;
}
export interface CommandHooks {
    reply: (message: string) => Promise<void>;
    /** Begin the abortable pre-launch countdown. */
    startCountdown: (opts: {
        force: boolean;
        byName: string;
    }) => Promise<void>;
    /** Abort a running countdown. Returns false when nothing was running. */
    cancelCountdown: () => boolean;
    countdownRunning: () => boolean;
    isAdmin: (steamId32: string) => Promise<boolean>;
}
export declare class LobbyCommandRouter {
    private store;
    private hooks;
    private limiter;
    private commands;
    constructor(store: InhouseStore, hooks: CommandHooks);
    /** Returns true when the message was a command the router consumed. */
    handle(game: InhouseGame, steamId32: string, playerName: string, message: string): Promise<boolean>;
    private permitted;
    private add;
    private register;
    private status;
    private start;
    private cancel;
    private help;
}
/** `!status` output: `8/10 — need 2. 1 slot reserved (2:14 left).` */
export declare function formatStatus(slots: SlotCounts, game: InhouseGame): string;
export declare function formatCountdown(ms: number): string;
