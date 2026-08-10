import type { Firestore } from 'firebase-admin/firestore';
import type { AttendanceRecord, BanStatus, GameState, InhouseGame, InhousePlayer, LinkCode, LinkSource, Membership, ModerationKind, ModerationRecord, ReadyEntry, Reservation, ResolvedSettings, SlotCounts, TeamSide, WaitlistEntry } from './types';
export declare const COLLECTIONS: {
    readonly games: "inhouseGames";
    readonly players: "inhousePlayers";
    readonly moderation: "inhouseModeration";
    readonly bans: "inhouseBans";
    readonly attendance: "inhouseAttendance";
    readonly linkCodes: "inhouseLinkCodes";
    readonly readyPool: "inhouseReadyPool";
    readonly config: "inhouseConfig";
    readonly counters: "inhouseCounters";
    readonly memberships: "memberships";
    readonly reservations: "reservations";
    readonly waitlist: "waitlist";
};
/** A full lobby is ten players. Nothing in the system is configurable here. */
export declare const LOBBY_CAPACITY = 10;
/**
 * How many published lobbies may recruit at once before a new one is refused.
 * Overridable from `inhouseConfig/lobby`; two is the considered default.
 */
export declare const DEFAULT_MAX_OPEN_LOBBIES = 2;
export declare class InhouseStore {
    private db;
    constructor(db: Firestore);
    private gameRef;
    private membershipsRef;
    private reservationsRef;
    private waitlistRef;
    /** Active memberships only — `present` is denormalized so no index is needed. */
    private presentQuery;
    /** Live reservations — `active` covers both "not consumed" and "not released". */
    private activeReservationsQuery;
    /**
     * Global admin defaults, written by the website's admin panel.
     * Falls back to code defaults when the document doesn't exist yet, so the
     * system is usable before the admin panel ships.
     */
    getAdminDefaults(): Promise<ResolvedSettings>;
    /**
     * Lobby-level config from `inhouseConfig/lobby`, written by the admin panel.
     *
     * `password` is one shared value for every lobby rather than per-game, so a
     * regular can type the same password every night without reading it off a card
     * first. Null means unset, and the caller generates one.
     *
     * `maxOpenLobbies` caps simultaneously *recruiting published* lobbies.
     * Unpublished ones deliberately don't count: a host quietly filling a private
     * game is not competing for the same players, so it must never block anyone.
     * A third concurrent lobby splits the same people three ways and none of them
     * reach ten.
     *
     * Falls back to code defaults so the system works before the panel writes it.
     */
    getLobbyConfig(): Promise<{
        password: string | null;
        maxOpenLobbies: number;
    }>;
    /**
     * Admin identities, cached briefly.
     *
     * Held in `inhouseConfig/admins` as two arrays so an admin can be recognised
     * from lobby chat (where only a Steam ID is available) as well as from
     * Discord. The admin panel maintains this document.
     */
    private adminCache;
    private static readonly ADMIN_CACHE_TTL_MS;
    isAdmin(ids: {
        discordId?: string | null;
        steamId32?: string | null;
    }): Promise<boolean>;
    /** Drop the admin cache, so a role change applies immediately. */
    invalidateAdminCache(): void;
    /**
     * Queue a command for the lobby worker holding a given Steam account.
     *
     * `createdAt` must be an ISO string: the worker parses it with `new Date()`
     * and expires anything older than five minutes. A Firestore Timestamp here
     * silently produces a command that is never executed.
     */
    enqueueBotCommand(botAccountId: string, command: Record<string, unknown>): Promise<void>;
    getGame(gameId: string): Promise<InhouseGame | null>;
    /**
     * Allocate the next human-readable game number ("#412"). Uses a counter
     * document under a transaction so concurrent creates can't collide.
     */
    private nextGameNumber;
    createGame(input: {
        initiatorDiscordId: string;
        initiatorName: string;
        initiatorSteamId32?: string | null;
        settings: ResolvedSettings;
        scheduledFor?: string | null;
        newcomerFriendly?: boolean;
    }): Promise<InhouseGame>;
    updateGame(gameId: string, patch: Record<string, unknown>): Promise<void>;
    /** Bump the idle clock. Called whenever a player joins or leaves. */
    touchGame(gameId: string): Promise<void>;
    /**
     * Move a game to a new state, refusing transitions out of a terminal state.
     * Returns false when the transition was rejected.
     */
    transitionState(gameId: string, next: GameState, extra?: Record<string, unknown>): Promise<boolean>;
    /** Games still holding a Steam account lease, for recovery on worker restart. */
    listActiveGames(): Promise<InhouseGame[]>;
    /**
     * Games currently recruiting that the public may see.
     *
     * Publishing is what decides who learns about a game *while it is filling* —
     * an unpublished lobby lets the host choose who to tell first. So this is the
     * only listing helper a public "games filling now" surface may use, and it
     * always carries the `published == true` filter.
     *
     * A finished game is a different matter: see `listRecentFinishedGames`.
     */
    listPublishedOpenGames(): Promise<InhouseGame[]>;
    /**
     * Finished games, published or not.
     *
     * Deliberately unfiltered by `published`. Keeping a lobby quiet is about
     * controlling who gets told while there are still slots to fill; once the
     * match has been played that no longer applies, and showing it is how a
     * visitor can tell the community is alive and playing.
     *
     * Only `finished` qualifies — not `cancelled`, `expired` or `abandoned`.
     * A game that never played says nothing good and still leaks that it existed.
     */
    listRecentFinishedGames(limit?: number): Promise<InhouseGame[]>;
    /**
     * Whether a game may be shown on a public surface at all.
     *
     * The single predicate every public read path should use, so the rule lives
     * in one place: visible once published, or once actually played.
     */
    static isPubliclyVisible(game: Pick<InhouseGame, 'published' | 'state'>): boolean;
    /** The game a given bot account is currently executing, if any. */
    findGameByBotAccount(botAccountId: string): Promise<InhouseGame | null>;
    /** Most recently finished game, for `!lastgame`. */
    getMostRecentFinishedGame(): Promise<InhouseGame | null>;
    /**
     * The community stat `!record` prints.
     *
     * Deliberately server-wide rather than per-player: community counters carry
     * no competitive charge and build real belonging, whereas any "top player"
     * framing is the thing §10 exists to prevent. The admin panel writes these.
     */
    getCommunityRecord(): Promise<{
        label: string;
        value: string;
        when: string | null;
    } | null>;
    /**
     * Record a player as present in the lobby. Idempotent — the GC re-sends the
     * full member list on every update, so this is called constantly.
     */
    upsertMembership(gameId: string, m: {
        steamId32: string;
        side: TeamSide;
        slot: number;
        playerName?: string | null;
        discordId?: string | null;
        displayName?: string | null;
    }): Promise<void>;
    /**
     * Mark a player as gone. The row is kept, not deleted: it is the ban-identity
     * record (§2) and the retroactive-credit source (§3).
     */
    markMembershipLeft(gameId: string, steamId32: string): Promise<void>;
    listMemberships(gameId: string, presentOnly?: boolean): Promise<Membership[]>;
    /**
     * The count that matters is everyone who is going to play: unassigned players
     * PLUS anyone already seated on Radiant or Dire, since people sit with their
     * friends and a lobby can legitimately start from any mix.
     *
     *   in_lobby  = { unassigned ∪ radiant ∪ dire }, excluding the bot
     *   committed = |in_lobby| + |{ active reservations whose steam_id ∉ in_lobby }|
     *   slots_open = 10 - committed
     *
     * The `∉ in_lobby` clause is the whole double-count fix: a reservation stops
     * counting the instant its owner actually walks in.
     */
    static computeSlots(memberships: Membership[], reservations: Reservation[]): SlotCounts;
    /** Read both sub-collections and compute the current slot picture. */
    getSlots(gameId: string): Promise<SlotCounts>;
    /** Transaction-internal variant — all reads must happen before any write. */
    private getSlotsInTransaction;
    listActiveReservations(gameId: string): Promise<Reservation[]>;
    /** Every reservation ever made for a game, including consumed and released. */
    listAllReservations(gameId: string): Promise<Reservation[]>;
    /**
     * Hold a slot for a linked player who pressed Join.
     *
     * Race safety is not optional here. The whole operation runs inside a
     * transaction that re-reads the game document and both sub-collections, then
     * re-checks `committed < 10` before writing. Firestore aborts and retries the
     * transaction if any read document changed underneath it, which gives the same
     * guarantee as `SELECT … FOR UPDATE`.
     *
     * Only for linked players: an unlinked player can't be recognised when they
     * walk in, so their reservation could never be consumed and would just burn a
     * slot for the full TTL.
     */
    createReservation(gameId: string, input: {
        discordId: string;
        steamId32: string;
        playerName?: string | null;
        ttlSeconds: number;
    }): Promise<{
        ok: true;
        reservation: Reservation;
        slotsOpen: number;
    } | {
        ok: false;
        reason: 'game_not_open' | 'locked' | 'full' | 'already_reserved' | 'already_in_lobby';
    }>;
    /**
     * Consume the reservation belonging to a Steam ID that just walked into the
     * lobby. Called from the worker's member-joined path.
     */
    /**
     * Consume the reservation belonging to a player who just walked in.
     *
     * Matches on the arriving Steam ID first, then falls back to the person: a
     * reservation made from Discord is keyed on the Discord ID, and someone with
     * several accounts may well reserve on their main and turn up on a smurf.
     * Missing that would leave the slot held until it expired while its owner was
     * already standing in the lobby.
     */
    consumeReservationBySteamId(gameId: string, steamId32: string): Promise<Reservation | null>;
    releaseReservation(gameId: string, discordId: string, reason: NonNullable<Reservation['releaseReason']>): Promise<Reservation | null>;
    /**
     * Release every reservation whose TTL has lapsed.
     * Returns them so the caller can DM the players and promote the waitlist.
     */
    expireLapsedReservations(gameId: string): Promise<Reservation[]>;
    addToWaitlist(gameId: string, entry: {
        discordId: string;
        steamId32?: string | null;
        playerName?: string | null;
    }): Promise<WaitlistEntry>;
    removeFromWaitlist(gameId: string, discordId: string): Promise<void>;
    listWaitlist(gameId: string): Promise<WaitlistEntry[]>;
    /** Pop the head of the waitlist. The caller turns it into a reservation. */
    popWaitlistHead(gameId: string): Promise<WaitlistEntry | null>;
    getPlayer(discordId: string): Promise<InhousePlayer | null>;
    /**
     * Find the person who plays on a given Steam account.
     *
     * `array-contains`, not equality: people have alts, and a lookup that only
     * matched the primary account would treat the same person as a stranger the
     * moment they logged into their other one — and, worse, would let a banned
     * player walk straight back in on a second account.
     */
    findPlayerBySteamId(steamId32: string): Promise<InhousePlayer | null>;
    /**
     * Attach a Steam account to a Discord profile.
     *
     * Additive: a second or third account joins the list rather than replacing
     * the first. The primary stays whatever was linked first, because that is
     * the one whose name people already recognise.
     */
    linkSteamAccount(discordId: string, steamId32: string, linkSource: LinkSource, discordName?: string | null): Promise<{
        ok: boolean;
        reason?: 'claimed_by_other';
        alreadyLinked: boolean;
        total: number;
    }>;
    /**
     * Refresh the cached server nickname.
     *
     * Members rename themselves freely, and this is the name every surface
     * shows, so it is worth writing whenever the gateway sees them. Skips the
     * write when nothing changed — this runs on ordinary interactions.
     */
    touchDiscordName(discordId: string, discordName: string): Promise<void>;
    upsertPlayer(discordId: string, patch: Partial<InhousePlayer>): Promise<InhousePlayer>;
    /**
     * Detach one Steam account from a Discord profile.
     *
     * How a mistaken link gets corrected, and deliberately self-service: the
     * person holding the account types `!unlink` in a lobby and the bot already
     * knows which Steam ID that is. Nobody can unlink anyone else.
     *
     * With several accounts linked, only the named one is removed and the rest
     * stay — someone fixing a typo on their smurf shouldn't lose their main.
     * `steamId32` is omitted only by callers who genuinely mean "all of them".
     *
     * The derived counters are recomputed from the ledger afterwards rather than
     * zeroed. That matters once alts exist: removing one account should leave the
     * games played on the others intact. This looks like it violates "counters
     * never decay" (§10), but it isn't decay — those numbers were attributed from
     * an account that is no longer this person's.
     *
     * `gamesPublished` is kept: publishing is something the Discord account did.
     */
    unlinkSteamAccount(discordId: string, steamId32?: string): Promise<{
        ok: boolean;
        removed: string[];
        remaining: string[];
        gamesDetached: number;
    }>;
    /** Remove a Discord ID from a Steam ID's attendance rows. Returns the count. */
    private detachDiscordIdFromAttendance;
    /** Drop the teammates sub-collection backing `distinctTeammates`. */
    private clearTeammates;
    /**
     * Check whether either identity is banned. A single document get per identity
     * space — cheap enough to sit on every join path without caching.
     *
     * Callers must pass whatever they have. A join from the Discord button knows
     * only the Discord ID; the GC member-joined event knows only the Steam ID.
     */
    checkBan(ids: {
        discordId?: string | null;
        steamId32?: string | null;
    }): Promise<BanStatus>;
    /**
     * Record a warning or ban and, for bans, write the enforcement index entries.
     *
     * Surfaces the identity gap rather than hiding it: banning by Steam ID alone
     * means the Discord role can't be pulled, and banning by Discord ID alone
     * means they could still join a lobby manually with the password.
     */
    createModerationRecord(input: {
        kind: ModerationKind;
        subjectDiscordId?: string | null;
        subjectSteamId32?: string | null;
        subjectName?: string | null;
        reason: string;
        adminId: string;
        sourceGameId?: string | null;
        /** Duration in days. 0 or omitted on a ban means permanent. */
        durationDays?: number;
    }): Promise<ModerationRecord>;
    revokeModerationRecord(moderationId: string, adminId: string): Promise<void>;
    /** Prior bans against either identity, used to pick the next ladder rung. */
    countPriorBans(ids: {
        discordId?: string | null;
        steamId32?: string | null;
    }): Promise<number>;
    /**
     * Write the attendance ledger for a finished match.
     * Idempotent on (gameId, steamId32) so a retried ingestion can't double-count.
     */
    writeAttendance(records: AttendanceRecord[]): Promise<void>;
    listAttendanceForSteamId(steamId32: string): Promise<AttendanceRecord[]>;
    /**
     * Record who a player has now played alongside, and keep `distinctTeammates`
     * in step.
     *
     * Stored as a sub-collection rather than an array so the write is idempotent
     * and doesn't grow a single document without bound. The count is denormalized
     * onto the profile because that is what gets rendered.
     *
     * Note this is a *count*, never a list on any public surface: "recent
     * teammates" would be a reconstruction of who plays with whom, assembled one
     * row at a time, which §10 rules out.
     */
    recordTeammates(discordId: string, teammateSteamIds: string[]): Promise<void>;
    /**
     * Stamp a newly-linked Discord ID onto that Steam ID's historical attendance
     * rows, so retroactive credit (§3) resolves on future reads.
     */
    attachDiscordIdToAttendance(steamId32: string, discordId: string): Promise<void>;
    /**
     * Attendance figures across one or more Steam accounts.
     *
     * Nights and heroes are deduplicated across accounts: playing two games on
     * two different accounts on the same evening is one night, not two.
     */
    aggregateStats(steamIds: string[]): Promise<{
        gamesPlayed: number;
        nightsPlayed: number;
        heroesPlayed: number;
        firstPlayedOn: string | null;
        lastPlayedOn: string | null;
    }>;
    /**
     * Everything a profile needs for whoever plays on a given Steam account.
     *
     * Resolves the person first, then aggregates across *all* their accounts —
     * so someone who walks in on their smurf still sees their real totals, and
     * the website never shows two half-profiles for one person.
     *
     * Works for players who have never linked, which is the majority: most
     * people hear about a game, find the lobby in Dota's browser and play,
     * without ever pressing anything on Discord. Their `inhousePlayers` document
     * does not exist and their counters are never incremented — but the ledger
     * has every game, because attendance is derived from the match roster rather
     * than from signups.
     *
     * Anything ranking or listing players must use this rather than reading
     * `inhousePlayers` directly, or it silently covers only the linked minority
     * and splits people with alts in two.
     */
    getStatsForSteamId(steamId32: string): Promise<{
        steamIds: string[];
        gamesPlayed: number;
        nightsPlayed: number;
        heroesPlayed: number;
        firstPlayedOn: string | null;
        lastPlayedOn: string | null;
        linked: boolean;
        discordId: string | null;
        displayName: string | null;
    }>;
    hasAttendance(gameId: string): Promise<boolean>;
    createLinkCode(input: {
        code: string;
        steamId32: string;
        playerName?: string | null;
        ttlSeconds: number;
    }): Promise<LinkCode>;
    /**
     * Create a link code only if that code is not already taken.
     * Returns false on collision so the caller can retry with a fresh code.
     */
    createLinkCodeIfAbsent(input: {
        code: string;
        steamId32: string;
        playerName?: string | null;
        ttlSeconds: number;
    }): Promise<boolean>;
    /**
     * Redeem a link code. Runs in a transaction so a code can only ever be used
     * once, even if two people race it.
     */
    consumeLinkCode(code: string, discordId: string): Promise<{
        ok: true;
        steamId32: string;
    } | {
        ok: false;
        reason: 'not_found' | 'expired' | 'used';
    }>;
    setReady(entry: Omit<ReadyEntry, 'createdAt'>): Promise<void>;
    clearReady(discordId: string): Promise<void>;
    /** Live ready entries. Expired rows are dropped lazily on read. */
    listReady(): Promise<ReadyEntry[]>;
}
