// Everything the tournament bot (conductor, scheduling, runner) reads from or writes to
// the database, as one interface. store-firestore.ts implements it on Firestore with the
// exact calls the bot made before; WP-21 implements it on PostgreSQL. Each method names
// the Firestore collection it touches.
//
// The inhouse half (src/inhouse, src/discord) has its own store (inhouse/core/store.ts)
// and is not behind this interface.
//
// Reads return plain data, never snapshots. A document that does not exist is null.
// Writes pass their fields through untouched: callers send `updatedAt` themselves, and a
// field set to `undefined` is dropped by Firestore (ignoreUndefinedProperties), not
// written as null.

import type {
    BotAccountDoc,
    BotConfig,
    ForfeitTask,
    MatchDoc,
    Session,
    SessionData,
    SessionState,
    SyncTask,
    TeamDoc,
    TournamentDoc,
} from './types';

/** A document read from a collection, with its id. */
export interface Doc<T> {
    id: string;
    data: T;
}

export type Unsubscribe = () => void;
export type OnError = (err: Error) => void;

/** A partial write. `null` clears a field; `undefined` leaves it alone. */
export type SessionUpdate = Partial<{ [K in keyof SessionData]: SessionData[K] | null }>;
export type AccountUpdate = Record<string, unknown>;

export interface Store {
    // ─── The website's own documents (read only) ────────────────────────────

    /** Every tournament. `tournaments` (whole collection). */
    listTournaments(): Promise<Array<Doc<TournamentDoc>>>;
    /** `tournaments/{tournamentId}/config/bot`. */
    getBotConfig(tournamentId: string): Promise<BotConfig | null>;
    /** Live `tournaments/{tournamentId}/config/bot`; null when the document does not exist. */
    watchBotConfig(tournamentId: string, onNext: (config: BotConfig | null) => void, onError: OnError): Unsubscribe;
    /** `tournaments/{tournamentId}/matches` where status in [scheduled, upcoming, pending]. */
    listSchedulableMatches(tournamentId: string): Promise<Array<Doc<MatchDoc>>>;
    /** `tournaments/{tournamentId}/matches/{matchId}`. */
    getMatch(tournamentId: string, matchId: string): Promise<MatchDoc | null>;
    /** Live `tournaments/{tournamentId}/matches/{matchId}`; null when it does not exist. */
    watchMatch(tournamentId: string, matchId: string, onNext: (match: MatchDoc | null) => void, onError: OnError): Unsubscribe;
    /** `tournaments/{tournamentId}/teams/{teamId}`. */
    getTeam(tournamentId: string, teamId: string): Promise<TeamDoc | null>;

    // ─── Lobby sessions (`botLobbySessions`) ────────────────────────────────

    /** `botLobbySessions/{sessionId}`, with its id. */
    getSession(sessionId: string): Promise<Session | null>;
    /** Live `botLobbySessions/{sessionId}`; null when it does not exist. */
    watchSession(sessionId: string, onNext: (session: Session | null) => void, onError: OnError): Unsubscribe;
    /** `botLobbySessions` where matchId == matchId, any state. */
    listSessionsForMatch(matchId: string): Promise<Array<Doc<SessionData>>>;
    /** `botLobbySessions` where state == 'pending', oldest createdAt first. */
    listPendingSessionsOldestFirst(): Promise<Array<Doc<SessionData>>>;
    /** `botLobbySessions` where state == 'pending', in no particular order. */
    listPendingSessions(): Promise<Array<Doc<SessionData>>>;
    /** `botLobbySessions` where state in states. */
    listSessionsInStates(states: SessionState[]): Promise<Array<Doc<SessionData>>>;
    /** Adds a document to `botLobbySessions`; returns its new id. */
    createSession(session: SessionData): Promise<string>;
    /** Updates fields of `botLobbySessions/{sessionId}`; fails if it does not exist. */
    updateSession(sessionId: string, fields: SessionUpdate): Promise<void>;

    // ─── Steam accounts (`botAccounts`, shared with the inhouse bot) ────────

    /** `botAccounts` where enabled == true and status == 'idle'. */
    listIdleEnabledAccounts(): Promise<Array<Doc<BotAccountDoc>>>;
    /** `botAccounts/{accountId}`. */
    getAccount(accountId: string): Promise<BotAccountDoc | null>;
    /** Updates fields of `botAccounts/{accountId}`; fails if it does not exist. */
    updateAccount(accountId: string, fields: AccountUpdate): Promise<void>;

    // ─── Results for the website (`botSyncTasks`) ───────────────────────────

    /** Adds a document to `botSyncTasks`; the website drains it. */
    addResultTask(task: SyncTask | ForfeitTask): Promise<void>;
}
