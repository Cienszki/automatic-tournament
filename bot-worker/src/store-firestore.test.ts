// FirestoreStore against the in-memory Firestore: each method reads or writes exactly the
// documents its comment in store.ts names. This is the specification the PostgreSQL
// Store (WP-21) must meet.

import { describe, expect, it } from 'vitest';
import { FirestoreStore } from './store-firestore';
import { FakeFirestore } from './testing/fake-firestore';
import { aSession } from './testing/fixtures';
import type { SessionData } from './types';

function setup() {
    const fs = new FakeFirestore();
    const db = fs.asFirestore();
    return { fs, db, store: new FirestoreStore(db) };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('the website documents', () => {
    it('lists tournaments and reads the bot config, a match and a team under the tournament', async () => {
        const { db, store } = setup();
        await db.collection('tournaments').doc('cup').set({ name: 'Cup' });
        await db.doc('tournaments/cup/config/bot').set({ enabled: true, lobby: {} });
        await db.doc('tournaments/cup/matches/m1').set({ status: 'scheduled' });
        await db.doc('tournaments/cup/teams/A').set({ tag: 'ALP' });

        expect(await store.listTournaments()).toEqual([{ id: 'cup', data: { name: 'Cup' } }]);
        expect(await store.getBotConfig('cup')).toEqual({ enabled: true, lobby: {} });
        expect(await store.getBotConfig('other')).toBeNull();
        expect(await store.getMatch('cup', 'm1')).toEqual({ status: 'scheduled' });
        expect(await store.getTeam('cup', 'A')).toEqual({ tag: 'ALP' });
        expect(await store.getTeam('cup', 'missing')).toBeNull();
    });

    it('lists only matches in a schedulable status', async () => {
        const { db, store } = setup();
        for (const [id, status] of [['a', 'scheduled'], ['b', 'upcoming'], ['c', 'pending'], ['d', 'completed'], ['e', 'live']]) {
            await db.doc(`tournaments/cup/matches/${id}`).set({ status });
        }
        expect((await store.listSchedulableMatches('cup')).map((m) => m.id)).toEqual(['a', 'b', 'c']);
    });

    it('watches the bot config and a match, reporting a missing document as null', async () => {
        const { db, store } = setup();
        const configs: unknown[] = [];
        const matches: unknown[] = [];
        const stop1 = store.watchBotConfig('cup', (c) => configs.push(c), () => undefined);
        const stop2 = store.watchMatch('cup', 'm1', (m) => matches.push(m), () => undefined);
        await tick();
        await db.doc('tournaments/cup/config/bot').set({ enabled: true, lobby: {} });
        await db.doc('tournaments/cup/matches/m1').set({ status: 'scheduled' });
        await tick();
        stop1(); stop2();
        await db.doc('tournaments/cup/matches/m1').set({ status: 'completed' });
        await tick();
        expect(configs).toEqual([null, { enabled: true, lobby: {} }]);
        expect(matches).toEqual([null, { status: 'scheduled' }]);
    });
});

describe('lobby sessions', () => {
    it('creates, reads, updates and queries botLobbySessions', async () => {
        const { fs, store } = setup();
        const id1 = await store.createSession(aSession({ state: 'pending', createdAt: '2026-11-13T18:02:00Z' }));
        const id2 = await store.createSession(aSession({ state: 'pending', createdAt: '2026-11-13T18:01:00Z', matchId: 'm2' }));
        const id3 = await store.createSession(aSession({ state: 'in_game' }));
        expect(fs.paths()).toEqual([`botLobbySessions/${id1}`, `botLobbySessions/${id2}`, `botLobbySessions/${id3}`].sort());

        expect((await store.listPendingSessionsOldestFirst()).map((d) => d.id)).toEqual([id2, id1]);
        expect((await store.listPendingSessions()).map((d) => d.id).sort()).toEqual([id1, id2].sort());
        expect((await store.listSessionsInStates(['in_game', 'lobby_open'])).map((d) => d.id)).toEqual([id3]);
        expect((await store.listSessionsForMatch('m2')).map((d) => d.id)).toEqual([id2]);

        await store.updateSession(id1, { state: 'bot_assigned', botAccountId: 'bot1', lateVote: null, readyCheckStartedAt: undefined });
        const s = await store.getSession(id1);
        expect(s).toMatchObject({ id: id1, state: 'bot_assigned', botAccountId: 'bot1', lateVote: null });
        expect(s && 'readyCheckStartedAt' in s).toBe(false); // undefined is dropped, not written
        expect(await store.getSession('nope')).toBeNull();
        await expect(store.updateSession('nope', { state: 'error' })).rejects.toThrow(/NOT_FOUND/);
    });

    it('watches a session with its id', async () => {
        const { store } = setup();
        const id = await store.createSession(aSession());
        const seen: Array<string | null> = [];
        const stop = store.watchSession(id, (s) => seen.push(s ? `${s.id}:${s.state}` : null), () => undefined);
        await tick();
        await store.updateSession(id, { state: 'lobby_open' });
        await tick();
        stop();
        expect(seen).toEqual([`${id}:bot_assigned`, `${id}:lobby_open`]);
    });
});

describe('Steam accounts and result tasks', () => {
    it('lists enabled idle accounts, reads and updates botAccounts', async () => {
        const { db, store } = setup();
        await db.doc('botAccounts/a').set({ enabled: true, status: 'idle' });
        await db.doc('botAccounts/b').set({ enabled: true, status: 'in_game' });
        await db.doc('botAccounts/c').set({ enabled: false, status: 'idle' });
        expect((await store.listIdleEnabledAccounts()).map((d) => d.id)).toEqual(['a']);
        await store.updateAccount('a', { status: 'starting', busyWithSessionId: 's1' });
        expect(await store.getAccount('a')).toEqual({ enabled: true, status: 'starting', busyWithSessionId: 's1' });
        expect(await store.getAccount('z')).toBeNull();
    });

    it('adds result tasks to botSyncTasks', async () => {
        const { fs, store } = setup();
        await store.addResultTask({
            type: 'sync', sessionId: 's1', matchId: 'm1', tournamentId: 'cup', dotaMatchId: 1001,
            syncAt: '2026-11-13T18:05:00Z', status: 'pending', createdAt: '2026-11-13T18:00:00Z',
        });
        const paths = fs.paths();
        expect(paths).toHaveLength(1);
        expect(paths[0]).toMatch(/^botSyncTasks\//);
        expect(fs.read(paths[0])).toMatchObject({ type: 'sync', dotaMatchId: 1001 });
    });
});

describe('the scheduling read path on Firestore', () => {
    it('builds a session from the match and team documents', async () => {
        const { scheduleUpcomingMatches } = await import('./scheduling');
        const { db, fs, store } = setup();
        await db.doc('tournaments/cup/matches/m1').set({
            status: 'scheduled', scheduledFor: new Date(Date.now() + 5 * 60_000).toISOString(),
            teamA: { id: 'A', name: 'Alpha' }, teamB: { id: 'B', name: 'Beta' },
        });
        await db.doc('tournaments/cup/teams/A').set({ tag: 'ALP', players: [{ id: 'p1', steamId32: '101', nickname: 'one' }] });
        await db.doc('tournaments/cup/teams/B').set({ tag: 'BET', players: [{ id: 'p2', steamId32: '201', nickname: 'two' }] });
        expect(await scheduleUpcomingMatches(store, 'cup', { enabled: true, lobby: {} }, { name: 'Cup' })).toBe(1);
        const sessionPath = fs.paths().find((p) => p.startsWith('botLobbySessions/')) as string;
        expect(fs.read(sessionPath) as unknown as SessionData).toMatchObject({ matchId: 'm1', state: 'pending', lobbyName: 'ALP vs BET - Cup' });
    });
});
