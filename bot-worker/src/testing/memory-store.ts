// An in-memory Store for tests. It behaves like the Firestore one where the bot can
// tell the difference: documents are copied in and out (no shared objects), a field
// written as `undefined` is dropped (ignoreUndefinedProperties), updating a missing
// document throws, and watchers fire asynchronously, starting with the current state.

import type { AccountUpdate, Doc, OnError, SessionUpdate, Store, Unsubscribe } from '../store';
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
} from '../types';

type Listener = () => void;

const clone = <T>(value: T): T => structuredClone(value);

function withoutUndefined<T extends object>(fields: T): Partial<T> {
    return Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined)) as Partial<T>;
}

export class MemoryStore implements Store {
    readonly tournaments = new Map<string, TournamentDoc>();
    readonly botConfigs = new Map<string, BotConfig>();
    /** key: `${tournamentId}/${matchId}` */
    readonly matches = new Map<string, MatchDoc>();
    /** key: `${tournamentId}/${teamId}` */
    readonly teams = new Map<string, TeamDoc>();
    readonly sessions = new Map<string, SessionData>();
    readonly accounts = new Map<string, Record<string, unknown>>();
    readonly resultTasks: Array<SyncTask | ForfeitTask> = [];
    /** Every write, in order, for tests that check what was written when. */
    readonly writes: Array<{ op: string; id: string; fields: unknown }> = [];

    private nextId = 1;
    private listeners = new Map<string, Set<Listener>>();

    // ─── Test setup and inspection ──────────────────────────────────────────

    putMatch(tournamentId: string, matchId: string, match: MatchDoc): void {
        this.matches.set(`${tournamentId}/${matchId}`, clone(match));
        this.notify(`match:${tournamentId}/${matchId}`);
    }

    putTeam(tournamentId: string, teamId: string, team: TeamDoc): void {
        this.teams.set(`${tournamentId}/${teamId}`, clone(team));
    }

    putBotConfig(tournamentId: string, config: BotConfig): void {
        this.botConfigs.set(tournamentId, clone(config));
        this.notify(`config:${tournamentId}`);
    }

    putSession(sessionId: string, session: SessionData): void {
        this.sessions.set(sessionId, clone(session));
        this.notify(`session:${sessionId}`);
    }

    session(sessionId: string): SessionData {
        const s = this.sessions.get(sessionId);
        if (!s) throw new Error(`no session ${sessionId}`);
        return clone(s);
    }

    account(accountId: string): Record<string, unknown> {
        const a = this.accounts.get(accountId);
        if (!a) throw new Error(`no account ${accountId}`);
        return clone(a);
    }

    // ─── Store ──────────────────────────────────────────────────────────────

    async listTournaments(): Promise<Array<Doc<TournamentDoc>>> {
        return [...this.tournaments].map(([id, data]) => ({ id, data: clone(data) }));
    }

    async getBotConfig(tournamentId: string): Promise<BotConfig | null> {
        const c = this.botConfigs.get(tournamentId);
        return c ? clone(c) : null;
    }

    watchBotConfig(tournamentId: string, onNext: (config: BotConfig | null) => void, _onError: OnError): Unsubscribe {
        return this.listen(`config:${tournamentId}`, () => {
            const c = this.botConfigs.get(tournamentId);
            onNext(c ? clone(c) : null);
        });
    }

    async listSchedulableMatches(tournamentId: string): Promise<Array<Doc<MatchDoc>>> {
        const prefix = `${tournamentId}/`;
        return [...this.matches]
            .filter(([key, m]) => key.startsWith(prefix) && ['scheduled', 'upcoming', 'pending'].includes(m.status ?? ''))
            .map(([key, data]) => ({ id: key.slice(prefix.length), data: clone(data) }));
    }

    async getMatch(tournamentId: string, matchId: string): Promise<MatchDoc | null> {
        const m = this.matches.get(`${tournamentId}/${matchId}`);
        return m ? clone(m) : null;
    }

    watchMatch(tournamentId: string, matchId: string, onNext: (match: MatchDoc | null) => void, _onError: OnError): Unsubscribe {
        return this.listen(`match:${tournamentId}/${matchId}`, () => {
            const m = this.matches.get(`${tournamentId}/${matchId}`);
            onNext(m ? clone(m) : null);
        });
    }

    async getTeam(tournamentId: string, teamId: string): Promise<TeamDoc | null> {
        const t = this.teams.get(`${tournamentId}/${teamId}`);
        return t ? clone(t) : null;
    }

    async getSession(sessionId: string): Promise<Session | null> {
        const s = this.sessions.get(sessionId);
        return s ? { id: sessionId, ...clone(s) } : null;
    }

    watchSession(sessionId: string, onNext: (session: Session | null) => void, _onError: OnError): Unsubscribe {
        return this.listen(`session:${sessionId}`, () => {
            const s = this.sessions.get(sessionId);
            onNext(s ? { id: sessionId, ...clone(s) } : null);
        });
    }

    async listSessionsForMatch(matchId: string): Promise<Array<Doc<SessionData>>> {
        return this.sessionDocs((s) => s.matchId === matchId);
    }

    async listPendingSessionsOldestFirst(): Promise<Array<Doc<SessionData>>> {
        return this.sessionDocs((s) => s.state === 'pending').sort((a, b) => a.data.createdAt.localeCompare(b.data.createdAt));
    }

    async listPendingSessions(): Promise<Array<Doc<SessionData>>> {
        return this.sessionDocs((s) => s.state === 'pending');
    }

    async listSessionsInStates(states: SessionState[]): Promise<Array<Doc<SessionData>>> {
        return this.sessionDocs((s) => states.includes(s.state));
    }

    async createSession(session: SessionData): Promise<string> {
        const id = `session-${this.nextId++}`;
        this.sessions.set(id, clone(withoutUndefined(session)) as SessionData);
        this.writes.push({ op: 'createSession', id, fields: clone(session) });
        this.notify(`session:${id}`);
        return id;
    }

    async updateSession(sessionId: string, fields: SessionUpdate): Promise<void> {
        const s = this.sessions.get(sessionId);
        if (!s) throw new Error(`NOT_FOUND: botLobbySessions/${sessionId}`);
        this.sessions.set(sessionId, { ...s, ...clone(withoutUndefined(fields)) } as SessionData);
        this.writes.push({ op: 'updateSession', id: sessionId, fields: clone(fields) });
        this.notify(`session:${sessionId}`);
    }

    async listIdleEnabledAccounts(): Promise<Array<Doc<BotAccountDoc>>> {
        return [...this.accounts]
            .filter(([, a]) => a.enabled === true && a.status === 'idle')
            .map(([id, data]) => ({ id, data: clone(data) as BotAccountDoc }));
    }

    async getAccount(accountId: string): Promise<BotAccountDoc | null> {
        const a = this.accounts.get(accountId);
        return a ? clone(a) as BotAccountDoc : null;
    }

    async updateAccount(accountId: string, fields: AccountUpdate): Promise<void> {
        const a = this.accounts.get(accountId);
        if (!a) throw new Error(`NOT_FOUND: botAccounts/${accountId}`);
        this.accounts.set(accountId, { ...a, ...clone(withoutUndefined(fields)) });
        this.writes.push({ op: 'updateAccount', id: accountId, fields: clone(fields) });
    }

    async addResultTask(task: SyncTask | ForfeitTask): Promise<void> {
        this.resultTasks.push(clone(task));
        this.writes.push({ op: 'addResultTask', id: task.type, fields: clone(task) });
    }

    // ─── Internals ──────────────────────────────────────────────────────────

    private sessionDocs(keep: (s: SessionData) => boolean): Array<Doc<SessionData>> {
        return [...this.sessions].filter(([, s]) => keep(s)).map(([id, data]) => ({ id, data: clone(data) }));
    }

    private listen(key: string, fire: Listener): Unsubscribe {
        const set = this.listeners.get(key) ?? new Set<Listener>();
        this.listeners.set(key, set);
        set.add(fire);
        queueMicrotask(() => { if (set.has(fire)) fire(); });
        return () => { set.delete(fire); };
    }

    private notify(key: string): void {
        for (const fire of [...(this.listeners.get(key) ?? [])]) queueMicrotask(fire);
    }
}
