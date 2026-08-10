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
    /** Bot token + guild for `!link <name>`. Unset degrades to the code flow. */
    private discordToken;
    private discordGuildId;
    private countdownTimer;
    private countdownTicks;
    private launching;
    /** Recovers a launch the GC silently ignored — see armLaunchWatchdog. */
    private launchWatchdog;
    private heartbeatTimer;
    /** onSnapshot unsubscribe for the game doc — see watchGameDoc. */
    private gameUnsub;
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
    /**
     * `!link <discord name>` — resolve the name on the guild and link on the spot.
     *
     * Every failure returns a line the player can act on, because this runs in
     * lobby chat where "something went wrong" is useless. The refusals that
     * matter:
     *
     *   ambiguous  — two people answer to that name. Guessing would attach a
     *                stranger's history to this Steam account, so it is refused
     *                and the candidates are shown.
     *   claimed    — this Steam account already belongs to a different Discord
     *                profile. Silently reassigning would move someone's whole
     *                history, so `linkSteamAccount` refuses and so do we.
     */
    private linkByDiscordName;
    /**
     * `!link-info` — which Discord profile owns this Steam account?
     *
     * Resolved through findPlayerBySteamId, which matches with array-contains,
     * so it answers correctly from any of the person's alts rather than only
     * their primary.
     */
    private linkInfo;
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
    /**
     * Mark the account busy in the field the TOURNAMENT side reads.
     *
     * The two systems track busy-ness differently: inhouses use
     * leasedByGameId + leaseHeartbeatAt, tournaments use
     * busyWithSessionId + a `status` that must be exactly 'idle' for
     * assignPendingSessions to consider an account free. A runner that only
     * renews the lease is invisible to that filter, so the Conductor could hand
     * this same account to a tournament match mid-inhouse — a duplicate Steam
     * login that crash-loops both sides.
     *
     * The website's leaseAccount already sets 'assigned' before we start, so in
     * the normal flow this is a no-op; it exists for every other entry point
     * (manual --bot-id, a respawn after the status was cleared elsewhere).
     */
    private claimAccountStatus;
    /**
     * React to the game being ended from outside this process.
     *
     * The host cancelling on the website, an admin force-releasing the bot
     * account, or the website's stuck-game sweeper all just write a terminal
     * state to the document — they do not, and should not, need to reach this
     * process. `end_inhouse_session` covers the same ground but is explicitly
     * best-effort in the contract, so relying on it alone leaves a runner
     * holding a live lobby and a leased Steam account indefinitely for a game
     * everyone else considers over. The tournament runner watches its session
     * doc for exactly this reason; this is the inhouse equivalent.
     */
    private watchGameDoc;
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
