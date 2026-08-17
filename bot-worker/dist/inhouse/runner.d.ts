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
    /**
     * True once this process has genuinely let go of the Dota lobby — left it, or
     * seen the GC destroy it.
     *
     * `dotaLobbyId` on the game document doubles as the Conductor's "a Dota lobby
     * may still be live" marker (conductor-hook's closeOrphanedLobbies), so it is
     * cleared on the way out only when this is true. A runner that dies still
     * holding a lobby must leave the marker standing.
     */
    private lobbyReleased;
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
    /** Consecutive heartbeats where the GC had no lobby for us — see reconcileLobby. */
    private lobbyMisses;
    /**
     * When the slot picture last actually changed — the clock both close rules in
     * checkLobbyLifetime run on.
     *
     * Seeded from the persisted `slotSnapshot.updatedAt` rather than from process
     * start, so a Conductor redeploy doesn't hand every dead lobby another five
     * minutes; a lobby that has been empty since yesterday is closed on the first
     * heartbeat after the restart, not five minutes into it.
     */
    private lastSlotChangeMs;
    /** Players on a playing slot as of that change. 0 means the lobby is empty. */
    private playersSeated;
    /** onSnapshot unsubscribe for the game doc — see watchGameDoc. */
    private gameUnsub;
    private finalizing;
    private exitCode;
    private donePromiseResolve;
    constructor(db: Firestore, gameId: string, botAccountId: string);
    run(): Promise<number>;
    /**
     * Destroy a Dota lobby belonging to a game that is already over.
     *
     * The website writes a lobby off when our lease heartbeat goes stale, and
     * sends `end_inhouse_session` best-effort — but if the worker was down, there
     * was no runner to receive that command, and by the time the Conductor is
     * back the command has expired. The game document then says `expired` while
     * the Dota lobby is still sitting in the in-game browser under a name the
     * website is still showing people. That is the state
     * docs/lobby-bot-integration.md §5a calls "worse than the one it replaced",
     * and this process is the only party that can fix it.
     *
     * Deliberately one-shot. The account is released and `dotaLobbyId` cleared
     * whether or not the leave succeeded, because the Conductor rescans every 20
     * seconds and a cleanup that can retry forever is a Steam login loop.
     */
    private closeOrphanedLobby;
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
     * The game launched and then dropped everyone back into the lobby.
     *
     * Dota does this whenever somebody fails to load in: the match is abandoned
     * before it counts, and the lobby is handed back intact. Nothing else notices.
     * Left alone the runner would sit in a state that quietly poisons the next
     * attempt — `matchStarted` latched on, so the retry's real match id would
     * never be recorded and the aborted one would be reported to the website
     * instead; the game stuck at `in_progress` and `locked`; and a lobby that is
     * closed later looking, to `onLobbyCleared`, like a match that was played.
     *
     * So all three are unwound. The chat line matters as much as the unwinding:
     * from inside Dota this looks like the bot died, and somebody has to be told
     * both that a retry is expected of them and who is allowed to call it.
     */
    private onLaunchAborted;
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
     * Leave the Dota lobby, recording whether we actually managed to.
     *
     * The distinction is the whole point: "the game is over" and "the lobby is
     * gone" are different facts, and only the second one makes it safe to stop
     * tracking the lobby (see `lobbyReleased`).
     */
    private releaseLobby;
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
     * Notice that our lobby is gone even when no event told us so.
     *
     * The lease heartbeat above proves this *process* is alive; it says nothing
     * about the lobby. Seen in production: a runner sat renewing its lease for
     * ten minutes with the game still showing `open` on the website and a
     * tournament account leased to it, long after the lobby had disappeared —
     * because 'lobbyCleared' never arrived. It is emitted from node-dota2's
     * `practiceLobbyCleared`, which needs a live GC session to be delivered; lose
     * the session at the wrong moment and the notification is simply missed, with
     * nothing to re-deliver it.
     *
     * So the heartbeat also reconciles belief against the GC's shared-object
     * cache, which is authoritative and survives reconnects. Two consecutive
     * misses rather than one, and only while the GC session is actually up, keeps
     * an ordinary reconnect blip from tearing down a perfectly good lobby.
     */
    private reconcileLobby;
    /**
     * Slots held by someone who pressed Join and hasn't walked in yet.
     *
     * `expiresAt` is re-checked here rather than trusting the array to have been
     * pruned. An empty lobby produces no GC events, so nothing rewrites
     * `slotSnapshot` at the moment a reservation lapses — left untested, one
     * stale entry would hold a dead lobby open forever, which is the failure this
     * whole mechanism exists to prevent.
     */
    private heldSlots;
    /**
     * Close a lobby nobody is using — the five-minute rule (§5a).
     *
     * Runs off `lastSlotChangeMs`, which moves only when the slot picture really
     * moves (see session-logic's two fingerprints). That is the whole mechanism:
     * anything that touches the clock without the lobby actually changing —
     * a heartbeat, a name refresh — resets it on every pass and no empty lobby
     * ever closes again.
     *
     * Two thresholds, one clock. Empty means nobody on radiant/dire/unassigned:
     * spectators and the bot are already excluded upstream by PLAYING_SIDES, so a
     * lobby holding nothing but observers correctly counts as empty here.
     */
    private checkLobbyLifetime;
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
