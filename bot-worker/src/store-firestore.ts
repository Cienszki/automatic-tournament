// The Store on Firestore: the exact reads and writes conductor, scheduling and runner
// made before they were gathered here (WP-20). Same collections, same queries, same
// order of calls. Replaced by a PostgreSQL implementation in WP-21.

import type { DocumentSnapshot, Firestore, QuerySnapshot } from 'firebase-admin/firestore';
import type { AccountUpdate, Doc, OnError, SessionUpdate, Store, Unsubscribe } from './store';
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

const SESSIONS = 'botLobbySessions';
const ACCOUNTS = 'botAccounts';
const RESULT_TASKS = 'botSyncTasks';
const TOURNAMENTS = 'tournaments';

function docs<T>(snap: QuerySnapshot): Array<Doc<T>> {
    return snap.docs.map((d) => ({ id: d.id, data: d.data() as T }));
}

function dataOrNull<T>(snap: DocumentSnapshot): T | null {
    return snap.exists ? snap.data() as T : null;
}

export class FirestoreStore implements Store {
    constructor(private readonly db: Firestore) {}

    private tournament(tournamentId: string) {
        return this.db.collection(TOURNAMENTS).doc(tournamentId);
    }

    private botConfigRef(tournamentId: string) {
        return this.tournament(tournamentId).collection('config').doc('bot');
    }

    private matchRef(tournamentId: string, matchId: string) {
        return this.tournament(tournamentId).collection('matches').doc(matchId);
    }

    // ─── The website's own documents ────────────────────────────────────────

    async listTournaments(): Promise<Array<Doc<TournamentDoc>>> {
        return docs<TournamentDoc>(await this.db.collection(TOURNAMENTS).get());
    }

    async getBotConfig(tournamentId: string): Promise<BotConfig | null> {
        return dataOrNull<BotConfig>(await this.botConfigRef(tournamentId).get());
    }

    watchBotConfig(tournamentId: string, onNext: (config: BotConfig | null) => void, onError: OnError): Unsubscribe {
        return this.botConfigRef(tournamentId).onSnapshot((snap) => onNext(dataOrNull<BotConfig>(snap)), onError);
    }

    async listSchedulableMatches(tournamentId: string): Promise<Array<Doc<MatchDoc>>> {
        const snap = await this.tournament(tournamentId).collection('matches')
            .where('status', 'in', ['scheduled', 'upcoming', 'pending']).get();
        return docs<MatchDoc>(snap);
    }

    async getMatch(tournamentId: string, matchId: string): Promise<MatchDoc | null> {
        return dataOrNull<MatchDoc>(await this.matchRef(tournamentId, matchId).get());
    }

    watchMatch(tournamentId: string, matchId: string, onNext: (match: MatchDoc | null) => void, onError: OnError): Unsubscribe {
        return this.matchRef(tournamentId, matchId).onSnapshot((snap) => onNext(dataOrNull<MatchDoc>(snap)), onError);
    }

    async getTeam(tournamentId: string, teamId: string): Promise<TeamDoc | null> {
        return dataOrNull<TeamDoc>(await this.tournament(tournamentId).collection('teams').doc(teamId).get());
    }

    // ─── Lobby sessions ─────────────────────────────────────────────────────

    async getSession(sessionId: string): Promise<Session | null> {
        const snap = await this.db.collection(SESSIONS).doc(sessionId).get();
        return snap.exists ? { id: snap.id, ...snap.data() as SessionData } : null;
    }

    watchSession(sessionId: string, onNext: (session: Session | null) => void, onError: OnError): Unsubscribe {
        return this.db.collection(SESSIONS).doc(sessionId).onSnapshot(
            (snap) => onNext(snap.exists ? { id: snap.id, ...snap.data() as SessionData } : null),
            onError,
        );
    }

    async listSessionsForMatch(matchId: string): Promise<Array<Doc<SessionData>>> {
        return docs<SessionData>(await this.db.collection(SESSIONS).where('matchId', '==', matchId).get());
    }

    async listPendingSessionsOldestFirst(): Promise<Array<Doc<SessionData>>> {
        const snap = await this.db.collection(SESSIONS)
            .where('state', '==', 'pending').orderBy('createdAt', 'asc').get();
        return docs<SessionData>(snap);
    }

    async listPendingSessions(): Promise<Array<Doc<SessionData>>> {
        return docs<SessionData>(await this.db.collection(SESSIONS).where('state', '==', 'pending').get());
    }

    async listSessionsInStates(states: SessionState[]): Promise<Array<Doc<SessionData>>> {
        return docs<SessionData>(await this.db.collection(SESSIONS).where('state', 'in', states).get());
    }

    async createSession(session: SessionData): Promise<string> {
        const ref = await this.db.collection(SESSIONS).add(session);
        return ref.id;
    }

    async updateSession(sessionId: string, fields: SessionUpdate): Promise<void> {
        await this.db.collection(SESSIONS).doc(sessionId).update(fields);
    }

    // ─── Steam accounts ─────────────────────────────────────────────────────

    async listIdleEnabledAccounts(): Promise<Array<Doc<BotAccountDoc>>> {
        const snap = await this.db.collection(ACCOUNTS)
            .where('enabled', '==', true).where('status', '==', 'idle').get();
        return docs<BotAccountDoc>(snap);
    }

    async getAccount(accountId: string): Promise<BotAccountDoc | null> {
        return dataOrNull<BotAccountDoc>(await this.db.collection(ACCOUNTS).doc(accountId).get());
    }

    async updateAccount(accountId: string, fields: AccountUpdate): Promise<void> {
        await this.db.collection(ACCOUNTS).doc(accountId).update(fields);
    }

    // ─── Results ────────────────────────────────────────────────────────────

    async addResultTask(task: SyncTask | ForfeitTask): Promise<void> {
        await this.db.collection(RESULT_TASKS).add(task);
    }
}
