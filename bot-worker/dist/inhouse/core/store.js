"use strict";
// src/inhouse/store.ts
// Firestore data-access layer for the inhouse system.
//
// This is the ONLY module that knows collection names and document shapes.
// Both processes go through it:
//   - the lobby worker  (authoritative for who is physically in the lobby)
//   - the Discord bot   (authoritative for reservations, waitlist, publishing)
//
// Two invariants worth stating up front:
//
//  1. Reservation creation is race-safe. Three people clicking Join at 9/10 is a
//     daily occurrence, so `createReservation` re-reads and re-checks the slot
//     count inside a Firestore transaction. Overbooking produces exactly the
//     experience reservations exist to prevent.
//
//  2. Ban checks are an authorization boundary, not a UI state. `inhouseBans`
//     is a denormalized lookup index keyed by identity so every join path can
//     check with a single document get, on the hot path, without a query.
Object.defineProperty(exports, "__esModule", { value: true });
exports.InhouseStore = exports.DEFAULT_MAX_OPEN_LOBBIES = exports.LOBBY_CAPACITY = exports.COLLECTIONS = void 0;
const types_1 = require("./types");
const settings_1 = require("./settings");
const logger_1 = require("./logger");
exports.COLLECTIONS = {
    games: 'inhouseGames',
    players: 'inhousePlayers',
    moderation: 'inhouseModeration',
    bans: 'inhouseBans',
    attendance: 'inhouseAttendance',
    linkCodes: 'inhouseLinkCodes',
    readyPool: 'inhouseReadyPool',
    config: 'inhouseConfig',
    counters: 'inhouseCounters',
    // Sub-collections of a game document
    memberships: 'memberships',
    reservations: 'reservations',
    waitlist: 'waitlist',
};
/** A full lobby is ten players. Nothing in the system is configurable here. */
exports.LOBBY_CAPACITY = 10;
/**
 * How many published lobbies may recruit at once before a new one is refused.
 * Overridable from `inhouseConfig/lobby`; two is the considered default.
 */
exports.DEFAULT_MAX_OPEN_LOBBIES = 2;
const now = () => new Date().toISOString();
/** Sentinel used to abort a link-code transaction on collision. */
class CodeTakenError extends Error {
    constructor() {
        super('link code already taken');
    }
}
/** Ban index keys. Two identity spaces, two keys, either one is sufficient. */
const discordBanKey = (discordId) => `d_${discordId}`;
const steamBanKey = (steamId32) => `s_${steamId32}`;
class InhouseStore {
    db;
    constructor(db) {
        this.db = db;
    }
    // ─── Refs ──────────────────────────────────────────────────────────────────
    gameRef(gameId) {
        return this.db.collection(exports.COLLECTIONS.games).doc(gameId);
    }
    membershipsRef(gameId) {
        return this.gameRef(gameId).collection(exports.COLLECTIONS.memberships);
    }
    reservationsRef(gameId) {
        return this.gameRef(gameId).collection(exports.COLLECTIONS.reservations);
    }
    waitlistRef(gameId) {
        return this.gameRef(gameId).collection(exports.COLLECTIONS.waitlist);
    }
    /** Active memberships only — `present` is denormalized so no index is needed. */
    presentQuery(gameId) {
        return this.membershipsRef(gameId).where('present', '==', true);
    }
    /** Live reservations — `active` covers both "not consumed" and "not released". */
    activeReservationsQuery(gameId) {
        return this.reservationsRef(gameId).where('active', '==', true);
    }
    // ─── Admin defaults ────────────────────────────────────────────────────────
    /**
     * Global admin defaults, written by the website's admin panel.
     * Falls back to code defaults when the document doesn't exist yet, so the
     * system is usable before the admin panel ships.
     */
    async getAdminDefaults() {
        try {
            const snap = await this.db.collection(exports.COLLECTIONS.config).doc('global').get();
            return (0, settings_1.resolveSettings)(snap.exists ? snap.data() : undefined);
        }
        catch (error) {
            logger_1.logger.warn(`Failed to read admin defaults, using code defaults: ${String(error)}`);
            return (0, settings_1.resolveSettings)();
        }
    }
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
    async getLobbyConfig() {
        try {
            const snap = await this.db.collection(exports.COLLECTIONS.config).doc('lobby').get();
            const data = (snap.exists ? snap.data() : {});
            const password = typeof data.password === 'string' && data.password.trim()
                ? data.password.trim()
                : null;
            const max = Number(data.maxOpenLobbies);
            return {
                password,
                maxOpenLobbies: Number.isFinite(max) && max > 0 ? Math.floor(max) : exports.DEFAULT_MAX_OPEN_LOBBIES,
            };
        }
        catch (error) {
            logger_1.logger.warn(`Failed to read lobby config, using defaults: ${String(error)}`);
            return { password: null, maxOpenLobbies: exports.DEFAULT_MAX_OPEN_LOBBIES };
        }
    }
    /**
     * Admin identities, cached briefly.
     *
     * Held in `inhouseConfig/admins` as two arrays so an admin can be recognised
     * from lobby chat (where only a Steam ID is available) as well as from
     * Discord. The admin panel maintains this document.
     */
    adminCache = null;
    static ADMIN_CACHE_TTL_MS = 60_000;
    async isAdmin(ids) {
        if (!this.adminCache || Date.now() - this.adminCache.at > InhouseStore.ADMIN_CACHE_TTL_MS) {
            try {
                const snap = await this.db.collection(exports.COLLECTIONS.config).doc('admins').get();
                const data = snap.exists ? snap.data() ?? {} : {};
                this.adminCache = {
                    discordIds: new Set((data.discordIds ?? [])),
                    steamIds: new Set((data.steamIds ?? []).map(String)),
                    at: Date.now(),
                };
            }
            catch (error) {
                logger_1.logger.warn(`Admin list read failed: ${String(error)}`);
                // Fail closed: an unreadable admin list must not grant admin powers.
                this.adminCache = { discordIds: new Set(), steamIds: new Set(), at: Date.now() };
            }
        }
        if (ids.steamId32 && this.adminCache.steamIds.has(ids.steamId32))
            return true;
        if (ids.discordId && this.adminCache.discordIds.has(ids.discordId))
            return true;
        // Fall back to the linked identity, so an admin listed only by Discord ID
        // is still recognised when they type `!kick` in a lobby.
        if (ids.steamId32 && !ids.discordId) {
            const player = await this.findPlayerBySteamId(ids.steamId32);
            if (player && this.adminCache.discordIds.has(player.discordId))
                return true;
        }
        return false;
    }
    /** Drop the admin cache, so a role change applies immediately. */
    invalidateAdminCache() {
        this.adminCache = null;
    }
    // ─── Worker command queue ──────────────────────────────────────────────────
    /**
     * Queue a command for the lobby worker holding a given Steam account.
     *
     * `createdAt` must be an ISO string: the worker parses it with `new Date()`
     * and expires anything older than five minutes. A Firestore Timestamp here
     * silently produces a command that is never executed.
     */
    async enqueueBotCommand(botAccountId, command) {
        await this.db
            .collection('botCommands')
            .doc(botAccountId)
            .collection('queue')
            .add({
            botAccountId,
            command,
            status: 'pending',
            createdAt: now(),
        });
    }
    // ─── Games ─────────────────────────────────────────────────────────────────
    async getGame(gameId) {
        const snap = await this.gameRef(gameId).get();
        return snap.exists ? snap.data() : null;
    }
    /**
     * Allocate the next human-readable game number ("#412"). Uses a counter
     * document under a transaction so concurrent creates can't collide.
     */
    async nextGameNumber() {
        const ref = this.db.collection(exports.COLLECTIONS.counters).doc('games');
        return this.db.runTransaction(async (tx) => {
            const snap = await tx.get(ref);
            const current = snap.exists ? Number(snap.data()?.value ?? 0) : 0;
            const next = current + 1;
            tx.set(ref, { value: next, updatedAt: now() }, { merge: true });
            return next;
        });
    }
    async createGame(input) {
        const ref = this.db.collection(exports.COLLECTIONS.games).doc();
        const gameNumber = await this.nextGameNumber();
        const ts = now();
        const game = {
            id: ref.id,
            gameNumber,
            mode: input.settings.mode,
            state: 'draft',
            initiatorDiscordId: input.initiatorDiscordId,
            initiatorSteamId32: input.initiatorSteamId32 ?? null,
            initiatorName: input.initiatorName,
            published: false,
            publishedAt: null,
            publishedByDiscordId: null,
            locked: false,
            settings: input.settings,
            botAccountId: null,
            dotaLobbyId: null,
            lobbyName: null,
            lobbyPassword: null,
            dotaMatchId: null,
            newcomerFriendly: input.newcomerFriendly ?? false,
            scheduledFor: input.scheduledFor ?? null,
            discord: {
                hostPanelChannelId: null,
                hostPanelMessageId: null,
                cardChannelId: null,
                cardMessageId: null,
                voiceChannelId: null,
                scheduledEventId: null,
            },
            createdAt: ts,
            updatedAt: ts,
            endedAt: null,
            endReason: null,
            lastActivityAt: ts,
            nudgedAt: null,
        };
        await ref.set(game);
        logger_1.logger.info(`Inhouse game created: ${ref.id} (#${gameNumber}) by ${input.initiatorName}`);
        return game;
    }
    async updateGame(gameId, patch) {
        await this.gameRef(gameId).update({ ...patch, updatedAt: now() });
    }
    /** Bump the idle clock. Called whenever a player joins or leaves. */
    async touchGame(gameId) {
        await this.gameRef(gameId).update({ lastActivityAt: now(), updatedAt: now() });
    }
    /**
     * Move a game to a new state, refusing transitions out of a terminal state.
     * Returns false when the transition was rejected.
     */
    async transitionState(gameId, next, extra = {}) {
        return this.db.runTransaction(async (tx) => {
            const ref = this.gameRef(gameId);
            const snap = await tx.get(ref);
            if (!snap.exists)
                return false;
            const game = snap.data();
            if ((0, types_1.isTerminal)(game.state)) {
                logger_1.logger.warn(`Refusing ${game.state} → ${next} for game ${gameId}: already terminal`);
                return false;
            }
            if (game.state === next)
                return true;
            const patch = { ...extra, state: next, updatedAt: now() };
            if ((0, types_1.isTerminal)(next))
                patch.endedAt = now();
            tx.update(ref, patch);
            logger_1.logger.info(`Game ${gameId}: ${game.state} → ${next}`);
            return true;
        });
    }
    /** Games still holding a Steam account lease, for recovery on worker restart. */
    async listActiveGames() {
        const snap = await this.db
            .collection(exports.COLLECTIONS.games)
            .where('state', 'in', ['lobby_creating', 'open', 'ready', 'in_progress'])
            .get();
        return snap.docs.map((d) => d.data());
    }
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
    async listPublishedOpenGames() {
        const snap = await this.db
            .collection(exports.COLLECTIONS.games)
            .where('published', '==', true)
            .where('state', 'in', ['open', 'ready'])
            .get();
        return snap.docs.map((d) => d.data());
    }
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
    async listRecentFinishedGames(limit = 20) {
        const snap = await this.db
            .collection(exports.COLLECTIONS.games)
            .where('state', '==', 'finished')
            .orderBy('endedAt', 'desc')
            .limit(limit)
            .get();
        return snap.docs.map((d) => d.data());
    }
    /**
     * Whether a game may be shown on a public surface at all.
     *
     * The single predicate every public read path should use, so the rule lives
     * in one place: visible once published, or once actually played.
     */
    static isPubliclyVisible(game) {
        return game.published || game.state === 'finished';
    }
    /** The game a given bot account is currently executing, if any. */
    async findGameByBotAccount(botAccountId) {
        const snap = await this.db
            .collection(exports.COLLECTIONS.games)
            .where('botAccountId', '==', botAccountId)
            .where('state', 'in', ['lobby_creating', 'open', 'ready', 'in_progress'])
            .limit(1)
            .get();
        return snap.empty ? null : snap.docs[0].data();
    }
    /** Most recently finished game, for `!lastgame`. */
    async getMostRecentFinishedGame() {
        const snap = await this.db
            .collection(exports.COLLECTIONS.games)
            .where('state', '==', 'finished')
            .orderBy('endedAt', 'desc')
            .limit(1)
            .get();
        return snap.empty ? null : snap.docs[0].data();
    }
    /**
     * The community stat `!record` prints.
     *
     * Deliberately server-wide rather than per-player: community counters carry
     * no competitive charge and build real belonging, whereas any "top player"
     * framing is the thing §10 exists to prevent. The admin panel writes these.
     */
    async getCommunityRecord() {
        const snap = await this.db.collection(exports.COLLECTIONS.config).doc('records').get();
        if (!snap.exists)
            return null;
        const records = (snap.data()?.entries ?? []);
        if (!records.length)
            return null;
        const chosen = records[Math.floor(Math.random() * records.length)];
        return { label: chosen.label, value: chosen.value, when: chosen.when ?? null };
    }
    // ─── Memberships ───────────────────────────────────────────────────────────
    /**
     * Record a player as present in the lobby. Idempotent — the GC re-sends the
     * full member list on every update, so this is called constantly.
     */
    async upsertMembership(gameId, m) {
        const ref = this.membershipsRef(gameId).doc(m.steamId32);
        const snap = await ref.get();
        if (!snap.exists) {
            const record = {
                steamId32: m.steamId32,
                discordId: m.discordId ?? null,
                playerName: m.playerName ?? null,
                displayName: m.displayName ?? null,
                side: m.side,
                slot: m.slot,
                joinedAt: now(),
                leftAt: null,
                present: true,
            };
            await ref.set(record);
            return;
        }
        const patch = { side: m.side, slot: m.slot, present: true, leftAt: null };
        if (m.playerName)
            patch.playerName = m.playerName;
        if (m.discordId)
            patch.discordId = m.discordId;
        if (m.displayName)
            patch.displayName = m.displayName;
        await ref.update(patch);
    }
    /**
     * Mark a player as gone. The row is kept, not deleted: it is the ban-identity
     * record (§2) and the retroactive-credit source (§3).
     */
    async markMembershipLeft(gameId, steamId32) {
        const ref = this.membershipsRef(gameId).doc(steamId32);
        const snap = await ref.get();
        if (!snap.exists)
            return;
        await ref.update({ present: false, leftAt: now() });
    }
    async listMemberships(gameId, presentOnly = true) {
        const snap = presentOnly
            ? await this.presentQuery(gameId).get()
            : await this.membershipsRef(gameId).get();
        return snap.docs.map((d) => d.data());
    }
    // ─── Slot accounting (§7.1) ────────────────────────────────────────────────
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
    static computeSlots(memberships, reservations) {
        const nowMs = Date.now();
        const playing = memberships.filter((m) => types_1.PLAYING_SIDES.includes(m.side));
        const inLobby = playing.map((m) => m.steamId32);
        const inLobbySet = new Set(inLobby);
        // People already present, by Discord identity. Someone can reserve on one
        // Steam account and walk in on another — without this their reservation
        // keeps counting and the lobby looks full one player early.
        const presentDiscordIds = new Set(playing.map((m) => m.discordId).filter((id) => Boolean(id)));
        const pendingReservations = reservations.filter((r) => r.consumedAt === null &&
            r.releasedAt === null &&
            Date.parse(r.expiresAt) > nowMs &&
            !inLobbySet.has(r.steamId32) &&
            !presentDiscordIds.has(r.discordId));
        const committed = inLobby.length + pendingReservations.length;
        return {
            inLobby,
            pendingReservations,
            committed,
            slotsOpen: Math.max(0, exports.LOBBY_CAPACITY - committed),
            ready: inLobby.length >= exports.LOBBY_CAPACITY,
            radiant: playing.filter((m) => m.side === 'radiant').map((m) => m.steamId32),
            dire: playing.filter((m) => m.side === 'dire').map((m) => m.steamId32),
            unassigned: playing.filter((m) => m.side === 'unassigned').map((m) => m.steamId32),
        };
    }
    /** Read both sub-collections and compute the current slot picture. */
    async getSlots(gameId) {
        const [members, reservations] = await Promise.all([
            this.listMemberships(gameId, true),
            this.listActiveReservations(gameId),
        ]);
        return InhouseStore.computeSlots(members, reservations);
    }
    /** Transaction-internal variant — all reads must happen before any write. */
    async getSlotsInTransaction(tx, gameId) {
        const [memberSnap, resSnap] = await Promise.all([
            tx.get(this.presentQuery(gameId)),
            tx.get(this.activeReservationsQuery(gameId)),
        ]);
        return InhouseStore.computeSlots(memberSnap.docs.map((d) => d.data()), resSnap.docs.map((d) => d.data()));
    }
    // ─── Reservations (§7.1) ───────────────────────────────────────────────────
    async listActiveReservations(gameId) {
        const snap = await this.activeReservationsQuery(gameId).get();
        return snap.docs.map((d) => d.data());
    }
    /** Every reservation ever made for a game, including consumed and released. */
    async listAllReservations(gameId) {
        const snap = await this.reservationsRef(gameId).get();
        return snap.docs.map((d) => d.data());
    }
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
    async createReservation(gameId, input) {
        return this.db.runTransaction(async (tx) => {
            const gameRef = this.gameRef(gameId);
            const reservationRef = this.reservationsRef(gameId).doc(input.discordId);
            // ── All reads first ──
            const [gameSnap, existingSnap] = await Promise.all([tx.get(gameRef), tx.get(reservationRef)]);
            if (!gameSnap.exists)
                return { ok: false, reason: 'game_not_open' };
            const game = gameSnap.data();
            if (game.state !== 'open')
                return { ok: false, reason: 'game_not_open' };
            if (game.locked)
                return { ok: false, reason: 'locked' };
            const slots = await this.getSlotsInTransaction(tx, gameId);
            if (slots.inLobby.includes(input.steamId32)) {
                return { ok: false, reason: 'already_in_lobby' };
            }
            if (existingSnap.exists) {
                const existing = existingSnap.data();
                const stillLive = existing.consumedAt === null &&
                    existing.releasedAt === null &&
                    Date.parse(existing.expiresAt) > Date.now();
                if (stillLive)
                    return { ok: false, reason: 'already_reserved' };
            }
            if (slots.committed >= exports.LOBBY_CAPACITY) {
                return { ok: false, reason: 'full' };
            }
            // ── Writes ──
            const createdAt = now();
            const reservation = {
                discordId: input.discordId,
                steamId32: input.steamId32,
                playerName: input.playerName ?? null,
                createdAt,
                expiresAt: new Date(Date.now() + input.ttlSeconds * 1000).toISOString(),
                consumedAt: null,
                releasedAt: null,
                releaseReason: null,
                active: true,
            };
            tx.set(reservationRef, reservation);
            tx.update(gameRef, { lastActivityAt: createdAt, updatedAt: createdAt });
            return {
                ok: true,
                reservation,
                // -1 because the reservation we just wrote isn't in the snapshot we read.
                slotsOpen: Math.max(0, exports.LOBBY_CAPACITY - slots.committed - 1),
            };
        });
    }
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
    async consumeReservationBySteamId(gameId, steamId32) {
        const direct = await this.activeReservationsQuery(gameId)
            .where('steamId32', '==', steamId32)
            .limit(1)
            .get();
        let doc = direct.empty ? null : direct.docs[0];
        if (!doc) {
            const player = await this.findPlayerBySteamId(steamId32);
            if (!player)
                return null;
            // Reservations are keyed by Discord ID, so this is a direct get.
            const byPerson = await this.reservationsRef(gameId).doc(player.discordId).get();
            const record = byPerson.exists ? byPerson.data() : null;
            if (!record?.active)
                return null;
            doc = byPerson;
        }
        const ts = now();
        await doc.ref.update({ consumedAt: ts, active: false });
        logger_1.logger.info(`Reservation consumed: game=${gameId} steam=${steamId32}`);
        return { ...doc.data(), consumedAt: ts };
    }
    async releaseReservation(gameId, discordId, reason) {
        const ref = this.reservationsRef(gameId).doc(discordId);
        const snap = await ref.get();
        if (!snap.exists)
            return null;
        const reservation = snap.data();
        if (reservation.consumedAt || reservation.releasedAt)
            return null;
        const ts = now();
        await ref.update({ releasedAt: ts, releaseReason: reason, active: false });
        return { ...reservation, releasedAt: ts, releaseReason: reason };
    }
    /**
     * Release every reservation whose TTL has lapsed.
     * Returns them so the caller can DM the players and promote the waitlist.
     */
    async expireLapsedReservations(gameId) {
        const active = await this.listActiveReservations(gameId);
        const nowMs = Date.now();
        const lapsed = active.filter((r) => r.consumedAt === null && r.releasedAt === null && Date.parse(r.expiresAt) <= nowMs);
        for (const r of lapsed) {
            await this.reservationsRef(gameId)
                .doc(r.discordId)
                .update({ releasedAt: now(), releaseReason: 'expired', active: false });
        }
        if (lapsed.length) {
            logger_1.logger.info(`Expired ${lapsed.length} reservation(s) for game ${gameId}`);
        }
        return lapsed;
    }
    // ─── Waitlist ──────────────────────────────────────────────────────────────
    async addToWaitlist(gameId, entry) {
        const ref = this.waitlistRef(gameId).doc(entry.discordId);
        const existing = await ref.get();
        if (existing.exists)
            return existing.data();
        // Position is a timestamp so ordering survives concurrent inserts without a
        // counter; ties are impossible in practice and harmless if they happen.
        const record = {
            discordId: entry.discordId,
            steamId32: entry.steamId32 ?? null,
            playerName: entry.playerName ?? null,
            position: Date.now(),
            createdAt: now(),
        };
        await ref.set(record);
        return record;
    }
    async removeFromWaitlist(gameId, discordId) {
        await this.waitlistRef(gameId).doc(discordId).delete();
    }
    async listWaitlist(gameId) {
        const snap = await this.waitlistRef(gameId).orderBy('position', 'asc').get();
        return snap.docs.map((d) => d.data());
    }
    /** Pop the head of the waitlist. The caller turns it into a reservation. */
    async popWaitlistHead(gameId) {
        const snap = await this.waitlistRef(gameId).orderBy('position', 'asc').limit(1).get();
        if (snap.empty)
            return null;
        const entry = snap.docs[0].data();
        await snap.docs[0].ref.delete();
        return entry;
    }
    // ─── Players ───────────────────────────────────────────────────────────────
    async getPlayer(discordId) {
        const snap = await this.db.collection(exports.COLLECTIONS.players).doc(discordId).get();
        return snap.exists ? snap.data() : null;
    }
    /**
     * Find the person who plays on a given Steam account.
     *
     * `array-contains`, not equality: people have alts, and a lookup that only
     * matched the primary account would treat the same person as a stranger the
     * moment they logged into their other one — and, worse, would let a banned
     * player walk straight back in on a second account.
     */
    async findPlayerBySteamId(steamId32) {
        const snap = await this.db
            .collection(exports.COLLECTIONS.players)
            .where('steamIds', 'array-contains', steamId32)
            .limit(1)
            .get();
        return snap.empty ? null : snap.docs[0].data();
    }
    /**
     * Attach a Steam account to a Discord profile.
     *
     * Additive: a second or third account joins the list rather than replacing
     * the first. The primary stays whatever was linked first, because that is
     * the one whose name people already recognise.
     */
    async linkSteamAccount(discordId, steamId32, linkSource, discordName) {
        const owner = await this.findPlayerBySteamId(steamId32);
        if (owner && owner.discordId !== discordId) {
            return { ok: false, reason: 'claimed_by_other', alreadyLinked: false, total: 0 };
        }
        const player = await this.getPlayer(discordId);
        const steamIds = player?.steamIds ?? [];
        if (steamIds.includes(steamId32)) {
            return { ok: true, alreadyLinked: true, total: steamIds.length };
        }
        const next = [...steamIds, steamId32];
        await this.upsertPlayer(discordId, {
            steamIds: next,
            steamId32: next[0],
            linkedAt: player?.linkedAt ?? now(),
            linkSource: player?.linkSource ?? linkSource,
            ...(discordName ? { discordName } : {}),
        });
        logger_1.logger.info(`Linked steam ${steamId32} to ${discordId} (${next.length} account(s) total)`);
        return { ok: true, alreadyLinked: false, total: next.length };
    }
    /**
     * Refresh the cached server nickname.
     *
     * Members rename themselves freely, and this is the name every surface
     * shows, so it is worth writing whenever the gateway sees them. Skips the
     * write when nothing changed — this runs on ordinary interactions.
     */
    async touchDiscordName(discordId, discordName) {
        const player = await this.getPlayer(discordId);
        if (!player || player.discordName === discordName)
            return;
        await this.db.collection(exports.COLLECTIONS.players).doc(discordId).update({ discordName });
    }
    async upsertPlayer(discordId, patch) {
        const ref = this.db.collection(exports.COLLECTIONS.players).doc(discordId);
        const snap = await ref.get();
        if (!snap.exists) {
            const player = {
                discordId,
                discordName: null,
                steamIds: [],
                steamId32: null,
                linkedAt: null,
                linkSource: null,
                pingOptIn: [],
                region: null,
                gamesPlayed: 0,
                gamesPublished: 0,
                nightsPlayed: 0,
                distinctTeammates: 0,
                heroesPlayed: 0,
                firstSeenAt: now(),
                lastPlayedAt: null,
                noShowCount: 0,
                lastNoShowAt: null,
                ...patch,
            };
            await ref.set(player);
            return player;
        }
        await ref.update({ ...patch });
        return { ...snap.data(), ...patch };
    }
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
    async unlinkSteamAccount(discordId, steamId32) {
        const player = await this.getPlayer(discordId);
        const linked = player?.steamIds ?? [];
        if (!linked.length)
            return { ok: false, removed: [], remaining: [], gamesDetached: 0 };
        const removed = steamId32 ? linked.filter((id) => id === steamId32) : [...linked];
        if (!removed.length)
            return { ok: false, removed: [], remaining: linked, gamesDetached: 0 };
        const remaining = linked.filter((id) => !removed.includes(id));
        let gamesDetached = 0;
        for (const id of removed) {
            gamesDetached += await this.detachDiscordIdFromAttendance(id, discordId);
        }
        // Teammates are rebuilt from the remaining accounts' history, so the old
        // set has to go first or it would keep people they only met on the
        // detached account.
        await this.clearTeammates(discordId);
        const totals = await this.aggregateStats(remaining);
        await this.db.collection(exports.COLLECTIONS.players).doc(discordId).update({
            steamIds: remaining,
            steamId32: remaining[0] ?? null,
            linkedAt: remaining.length ? (player?.linkedAt ?? null) : null,
            linkSource: remaining.length ? (player?.linkSource ?? null) : null,
            gamesPlayed: totals.gamesPlayed,
            nightsPlayed: totals.nightsPlayed,
            heroesPlayed: totals.heroesPlayed,
            distinctTeammates: 0,
            lastPlayedAt: totals.lastPlayedOn,
        });
        logger_1.logger.info(`Unlinked ${removed.join(', ')} from ${discordId} ` +
            `(${remaining.length} account(s) remaining, ${gamesDetached} rows detached)`);
        return { ok: true, removed, remaining, gamesDetached };
    }
    /** Remove a Discord ID from a Steam ID's attendance rows. Returns the count. */
    async detachDiscordIdFromAttendance(steamId32, discordId) {
        const snap = await this.db
            .collection(exports.COLLECTIONS.attendance)
            .where('steamId32', '==', steamId32)
            .get();
        const rows = snap.docs.filter((d) => d.data().discordId === discordId);
        for (let i = 0; i < rows.length; i += 450) {
            const batch = this.db.batch();
            for (const doc of rows.slice(i, i + 450))
                batch.update(doc.ref, { discordId: null });
            await batch.commit();
        }
        return rows.length;
    }
    /** Drop the teammates sub-collection backing `distinctTeammates`. */
    async clearTeammates(discordId) {
        const collection = this.db
            .collection(exports.COLLECTIONS.players)
            .doc(discordId)
            .collection('teammates');
        // Paged rather than fetched whole: a regular accumulates hundreds of these.
        for (;;) {
            const snap = await collection.limit(450).get();
            if (snap.empty)
                return;
            const batch = this.db.batch();
            for (const doc of snap.docs)
                batch.delete(doc.ref);
            await batch.commit();
        }
    }
    // ─── Moderation (§2) ───────────────────────────────────────────────────────
    /**
     * Check whether either identity is banned. A single document get per identity
     * space — cheap enough to sit on every join path without caching.
     *
     * Callers must pass whatever they have. A join from the Discord button knows
     * only the Discord ID; the GC member-joined event knows only the Steam ID.
     */
    async checkBan(ids) {
        const keys = [];
        if (ids.discordId)
            keys.push({ key: discordBanKey(ids.discordId), on: 'discord' });
        if (ids.steamId32)
            keys.push({ key: steamBanKey(ids.steamId32), on: 'steam' });
        if (!keys.length)
            return { banned: false, record: null, matchedOn: null };
        const snaps = await this.db.getAll(...keys.map(({ key }) => this.db.collection(exports.COLLECTIONS.bans).doc(key)));
        for (let i = 0; i < snaps.length; i++) {
            const snap = snaps[i];
            if (!snap.exists)
                continue;
            const entry = snap.data();
            // A lapsed ban is not a ban. Clean the index up opportunistically.
            if (entry.expiresAt && Date.parse(entry.expiresAt) <= Date.now()) {
                void snap.ref.delete().catch(() => undefined);
                continue;
            }
            const modSnap = await this.db.collection(exports.COLLECTIONS.moderation).doc(entry.moderationId).get();
            const record = modSnap.exists ? modSnap.data() : null;
            if (record?.revokedAt) {
                void snap.ref.delete().catch(() => undefined);
                continue;
            }
            return { banned: true, record, matchedOn: keys[i].on };
        }
        return { banned: false, record: null, matchedOn: null };
    }
    /**
     * Record a warning or ban and, for bans, write the enforcement index entries.
     *
     * Surfaces the identity gap rather than hiding it: banning by Steam ID alone
     * means the Discord role can't be pulled, and banning by Discord ID alone
     * means they could still join a lobby manually with the password.
     */
    async createModerationRecord(input) {
        const discordId = input.subjectDiscordId ?? null;
        const steamId32 = input.subjectSteamId32 ?? null;
        if (!discordId && !steamId32) {
            throw new Error('createModerationRecord requires at least one identity');
        }
        const ref = this.db.collection(exports.COLLECTIONS.moderation).doc();
        const expiresAt = input.kind === 'ban' && input.durationDays && input.durationDays > 0
            ? new Date(Date.now() + input.durationDays * 86400_000).toISOString()
            : null;
        const record = {
            id: ref.id,
            kind: input.kind,
            subjectDiscordId: discordId,
            subjectSteamId32: steamId32,
            subjectName: input.subjectName ?? null,
            reason: input.reason,
            adminId: input.adminId,
            sourceGameId: input.sourceGameId ?? null,
            createdAt: now(),
            expiresAt,
            revokedAt: null,
            revokedBy: null,
            identityGap: discordId && steamId32 ? 'none' : discordId ? 'no_steam' : 'no_discord',
        };
        await ref.set(record);
        if (input.kind === 'ban') {
            // A ban follows the PERSON, not the account they happened to be on.
            // Indexing only the offending Steam ID would let anyone evade it by
            // logging into their alt, which is the single easiest way to make the
            // whole moderation system pointless.
            const steamIds = new Set(steamId32 ? [steamId32] : []);
            const owner = discordId
                ? await this.getPlayer(discordId)
                : steamId32
                    ? await this.findPlayerBySteamId(steamId32)
                    : null;
            for (const id of owner?.steamIds ?? [])
                steamIds.add(id);
            const batch = this.db.batch();
            const indexEntry = { moderationId: ref.id, expiresAt, createdAt: record.createdAt };
            const banDiscordId = discordId ?? owner?.discordId ?? null;
            if (banDiscordId) {
                batch.set(this.db.collection(exports.COLLECTIONS.bans).doc(discordBanKey(banDiscordId)), indexEntry);
            }
            for (const id of steamIds) {
                batch.set(this.db.collection(exports.COLLECTIONS.bans).doc(steamBanKey(id)), indexEntry);
            }
            await batch.commit();
            logger_1.logger.warn(`Ban recorded: discord=${banDiscordId ?? '—'} steam=[${[...steamIds].join(', ') || '—'}] ` +
                `gap=${record.identityGap} expires=${expiresAt ?? 'never'}`);
        }
        return record;
    }
    async revokeModerationRecord(moderationId, adminId) {
        const ref = this.db.collection(exports.COLLECTIONS.moderation).doc(moderationId);
        const snap = await ref.get();
        if (!snap.exists)
            return;
        const record = snap.data();
        await ref.update({ revokedAt: now(), revokedBy: adminId });
        // Clear every key the ban wrote, including alts — otherwise an unban
        // restores one account and silently leaves the others locked out.
        const owner = record.subjectDiscordId
            ? await this.getPlayer(record.subjectDiscordId)
            : record.subjectSteamId32
                ? await this.findPlayerBySteamId(record.subjectSteamId32)
                : null;
        const steamIds = new Set(record.subjectSteamId32 ? [record.subjectSteamId32] : []);
        for (const id of owner?.steamIds ?? [])
            steamIds.add(id);
        const batch = this.db.batch();
        const banDiscordId = record.subjectDiscordId ?? owner?.discordId ?? null;
        if (banDiscordId) {
            batch.delete(this.db.collection(exports.COLLECTIONS.bans).doc(discordBanKey(banDiscordId)));
        }
        for (const id of steamIds) {
            batch.delete(this.db.collection(exports.COLLECTIONS.bans).doc(steamBanKey(id)));
        }
        await batch.commit();
    }
    /** Prior bans against either identity, used to pick the next ladder rung. */
    async countPriorBans(ids) {
        const queries = [];
        if (ids.discordId) {
            queries.push(this.db
                .collection(exports.COLLECTIONS.moderation)
                .where('kind', '==', 'ban')
                .where('subjectDiscordId', '==', ids.discordId)
                .get()
                .then((s) => s.size));
        }
        if (ids.steamId32) {
            queries.push(this.db
                .collection(exports.COLLECTIONS.moderation)
                .where('kind', '==', 'ban')
                .where('subjectSteamId32', '==', ids.steamId32)
                .get()
                .then((s) => s.size));
        }
        if (!queries.length)
            return 0;
        // Max rather than sum: a record carrying both identities would double-count.
        return Math.max(...(await Promise.all(queries)));
    }
    // ─── Attendance (§10, §12) ─────────────────────────────────────────────────
    /**
     * Write the attendance ledger for a finished match.
     * Idempotent on (gameId, steamId32) so a retried ingestion can't double-count.
     */
    async writeAttendance(records) {
        if (!records.length)
            return;
        const batch = this.db.batch();
        for (const r of records) {
            const ref = this.db.collection(exports.COLLECTIONS.attendance).doc(`${r.gameId}__${r.steamId32}`);
            batch.set(ref, r);
        }
        await batch.commit();
        logger_1.logger.info(`Attendance written: ${records.length} row(s) for game ${records[0].gameId}`);
    }
    async listAttendanceForSteamId(steamId32) {
        const snap = await this.db
            .collection(exports.COLLECTIONS.attendance)
            .where('steamId32', '==', steamId32)
            .get();
        return snap.docs.map((d) => d.data());
    }
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
    async recordTeammates(discordId, teammateSteamIds) {
        if (!teammateSteamIds.length)
            return;
        const collection = this.db
            .collection(exports.COLLECTIONS.players)
            .doc(discordId)
            .collection('teammates');
        const refs = teammateSteamIds.map((id) => collection.doc(id));
        const existing = await this.db.getAll(...refs);
        const fresh = teammateSteamIds.filter((_, i) => !existing[i].exists);
        if (!fresh.length)
            return;
        const batch = this.db.batch();
        for (const steamId32 of fresh) {
            batch.set(collection.doc(steamId32), { steamId32, firstPlayedAt: now() });
        }
        await batch.commit();
        const total = (await collection.count().get()).data().count;
        await this.db.collection(exports.COLLECTIONS.players).doc(discordId).update({ distinctTeammates: total });
    }
    /**
     * Stamp a newly-linked Discord ID onto that Steam ID's historical attendance
     * rows, so retroactive credit (§3) resolves on future reads.
     */
    async attachDiscordIdToAttendance(steamId32, discordId) {
        const snap = await this.db
            .collection(exports.COLLECTIONS.attendance)
            .where('steamId32', '==', steamId32)
            .get();
        if (snap.empty)
            return;
        // Firestore caps a batch at 500 writes.
        const docs = snap.docs.filter((d) => d.data().discordId !== discordId);
        for (let i = 0; i < docs.length; i += 450) {
            const batch = this.db.batch();
            for (const doc of docs.slice(i, i + 450))
                batch.update(doc.ref, { discordId });
            await batch.commit();
        }
        logger_1.logger.info(`Attached ${discordId} to ${docs.length} historical attendance rows`);
    }
    /**
     * Attendance figures across one or more Steam accounts.
     *
     * Nights and heroes are deduplicated across accounts: playing two games on
     * two different accounts on the same evening is one night, not two.
     */
    async aggregateStats(steamIds) {
        if (!steamIds.length) {
            return { gamesPlayed: 0, nightsPlayed: 0, heroesPlayed: 0, firstPlayedOn: null, lastPlayedOn: null };
        }
        const histories = await Promise.all(steamIds.map((id) => this.listAttendanceForSteamId(id)));
        const all = histories.flat();
        const nights = new Set(all.map((r) => r.playedOn));
        const heroes = new Set(all.filter((r) => r.heroId !== null).map((r) => r.heroId));
        const days = [...nights].sort();
        return {
            gamesPlayed: all.length,
            nightsPlayed: nights.size,
            heroesPlayed: heroes.size,
            firstPlayedOn: days[0] ?? null,
            lastPlayedOn: days[days.length - 1] ?? null,
        };
    }
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
    async getStatsForSteamId(steamId32) {
        const player = await this.findPlayerBySteamId(steamId32);
        const steamIds = player?.steamIds?.length ? player.steamIds : [steamId32];
        const totals = await this.aggregateStats(steamIds);
        return {
            steamIds,
            ...totals,
            linked: player !== null,
            discordId: player?.discordId ?? null,
            displayName: player?.discordName ?? null,
        };
    }
    async hasAttendance(gameId) {
        const snap = await this.db
            .collection(exports.COLLECTIONS.attendance)
            .where('gameId', '==', gameId)
            .limit(1)
            .get();
        return !snap.empty;
    }
    // ─── Link codes (§3) ───────────────────────────────────────────────────────
    async createLinkCode(input) {
        const record = {
            code: input.code,
            steamId32: input.steamId32,
            playerName: input.playerName ?? null,
            createdAt: now(),
            expiresAt: new Date(Date.now() + input.ttlSeconds * 1000).toISOString(),
            consumedAt: null,
            consumedByDiscordId: null,
        };
        await this.db.collection(exports.COLLECTIONS.linkCodes).doc(input.code).set(record);
        return record;
    }
    /**
     * Create a link code only if that code is not already taken.
     * Returns false on collision so the caller can retry with a fresh code.
     */
    async createLinkCodeIfAbsent(input) {
        const ref = this.db.collection(exports.COLLECTIONS.linkCodes).doc(input.code);
        try {
            await this.db.runTransaction(async (tx) => {
                const snap = await tx.get(ref);
                if (snap.exists) {
                    const existing = snap.data();
                    const live = !existing.consumedAt && Date.parse(existing.expiresAt) > Date.now();
                    if (live)
                        throw new CodeTakenError();
                }
                tx.set(ref, {
                    code: input.code,
                    steamId32: input.steamId32,
                    playerName: input.playerName ?? null,
                    createdAt: now(),
                    expiresAt: new Date(Date.now() + input.ttlSeconds * 1000).toISOString(),
                    consumedAt: null,
                    consumedByDiscordId: null,
                });
            });
            return true;
        }
        catch (error) {
            if (error instanceof CodeTakenError)
                return false;
            throw error;
        }
    }
    /**
     * Redeem a link code. Runs in a transaction so a code can only ever be used
     * once, even if two people race it.
     */
    async consumeLinkCode(code, discordId) {
        const ref = this.db.collection(exports.COLLECTIONS.linkCodes).doc(code.trim().toUpperCase());
        return this.db.runTransaction(async (tx) => {
            const snap = await tx.get(ref);
            if (!snap.exists)
                return { ok: false, reason: 'not_found' };
            const record = snap.data();
            if (record.consumedAt)
                return { ok: false, reason: 'used' };
            if (Date.parse(record.expiresAt) <= Date.now())
                return { ok: false, reason: 'expired' };
            tx.update(ref, { consumedAt: now(), consumedByDiscordId: discordId });
            return { ok: true, steamId32: record.steamId32 };
        });
    }
    // ─── Ready pool (§9) ───────────────────────────────────────────────────────
    async setReady(entry) {
        await this.db
            .collection(exports.COLLECTIONS.readyPool)
            .doc(entry.discordId)
            .set({ ...entry, createdAt: now() });
    }
    async clearReady(discordId) {
        await this.db.collection(exports.COLLECTIONS.readyPool).doc(discordId).delete();
    }
    /** Live ready entries. Expired rows are dropped lazily on read. */
    async listReady() {
        const snap = await this.db.collection(exports.COLLECTIONS.readyPool).get();
        const nowMs = Date.now();
        const live = [];
        for (const doc of snap.docs) {
            const entry = doc.data();
            if (Date.parse(entry.expiresAt) <= nowMs) {
                void doc.ref.delete().catch(() => undefined);
                continue;
            }
            live.push(entry);
        }
        return live;
    }
}
exports.InhouseStore = InhouseStore;
