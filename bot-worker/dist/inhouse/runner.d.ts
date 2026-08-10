import type { Firestore } from 'firebase-admin/firestore';
export declare class InhouseRunner {
    private db;
    private gameId;
    private botAccountId;
    private store;
    private game;
    private dota;
    private sessionLogic;
    private banGuard;
    private commandQueue;
    private router;
    private botSteamId32;
    private lobbyCreated;
    /** Tracked ourselves — dota-client.js's 'lobbyCleared' carries no payload, unlike dota2-lobby-bot's own client. */
    private lastKnownMatchId;
    private matchStarted;
    private webhookSecret;
    private siteUrl;
    private countdownTimer;
    private countdownTicks;
    private launching;
    /** Recovers a launch the GC silently ignored — see armLaunchWatchdog. */
    private launchWatchdog;
    private heartbeatTimer;
    private finalizing;
    private exitCode;
    private donePromiseResolve;
    constructor(db: Firestore, gameId: string, botAccountId: string);
    run(): Promise<number>;
    private reattachOrCreate;
    /** Hooked into CommandQueue — idempotent, so a duplicate/retried command is safe. */
    private onCreateLobbyCommand;
    /**
     * Retry createLobby up to 4 attempts with backoff — node-dota2's
     * createPracticeLobby can time out or hit Valve's per-account rate limit,
     * and a single failure would otherwise strand the game forever. Mirrors
     * dist/runner.js's createLobbyResilient exactly.
     *
     * On total failure this exits the process non-zero. In M1 (no Conductor)
     * that just ends the manual test run; M3's Conductor integration respawns
     * with a clean GC session the same way it already does for tournaments.
     */
    private createLobbyResilient;
    private wireDotaEvents;
    private onChatMessage;
    private onMatchStarted;
    /**
     * The GC destroyed the lobby. dota-client.js's 'lobbyCleared' carries no
     * payload (unlike dota2-lobby-bot's own DotaClient), so whether a match was
     * actually played is read from `lastKnownMatchId`, captured from the most
     * recent 'lobbyUpdate' before the clear. Without a match id, nothing was
     * played — the lobby was destroyed some other way (bot kicked, host
     * cancelled, timed out before launch) — and guessing a result here would be
     * wrong, so this just tears the runner down.
     */
    private onLobbyCleared;
    private onEndSessionCommand;
    private clearCountdown;
    private cancelCountdown;
    private startCountdown;
    private launch;
    /**
     * Recover from a launch the GC accepted but never acted on.
     *
     * `launchPracticeLobby` is fire-and-forget by design (its ack is unreliable —
     * see dota-client.js), so the only evidence a launch actually took is the
     * lobby moving to RUN with a match id. If that never arrives, `launching`
     * would stay true for the life of the process and every later `!start` would
     * silently no-op, with the lobby left locked. Unwind both so the players can
     * simply try again.
     */
    private armLaunchWatchdog;
    private unlockAfterFailedLaunch;
    private startHeartbeat;
    /**
     * Leave the lobby, disconnect, release the account, and resolve run().
     *
     * M1 always releases the account on any finish — there is no Conductor yet
     * to distinguish a clean finish from a crash worth respawning with the same
     * lease, the way dist/runner.js's finishUp does for tournaments. A `kill -9`
     * bypasses this entirely (that's the point of the crash/reattach test), so
     * the lease is only ever released here on a graceful path. M3 should revisit
     * this once the Conductor can actually respawn with the same account.
     */
    private finishUp;
    /** Graceful shutdown path — SIGINT/SIGTERM. Disconnects without releasing the account or touching game state, since the process may simply be restarting. */
    shutdown(): Promise<void>;
}
