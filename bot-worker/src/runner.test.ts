// The tournament runner end to end, on the in-memory store with a fake Dota client
// (TEST_STRATEGY.md level 5, part 2). Each scenario ends by checking what the website
// would see: the session document, the account, and the result tasks.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Runner } from './runner';
import { MemoryStore } from './testing/memory-store';
import { FakeLobbyClient, LOBBY, OUTCOME } from './testing/fake-lobby-client';
import { ALPHA, BETA, BOT, MATCH, SESSION, T, aMatch, seatTeams, seed } from './testing/fixtures';

let store: MemoryStore;
let fake: FakeLobbyClient;
let runner: Runner;
let done: Promise<number>;

const flush = (ms = 0) => vi.advanceTimersByTimeAsync(ms);

async function start(): Promise<void> {
    runner = new Runner(store, SESSION, BOT, () => fake);
    done = runner.run();
    await flush(5000); // REATTACH_SETTLE_MS, then create or reattach
}

/** Both teams seated on opposite sides, both type !ready: the runner launches. */
async function readyUp(alphaSide: 'radiant' | 'dire'): Promise<void> {
    seatTeams(fake, alphaSide);
    await flush();
    fake.say(ALPHA[0], '!ready');
    await flush();
    fake.say(BETA[0], '!r');
    await flush();
}

/** The game starts and ends with the given Dota side winning. */
async function play(matchId: string, winner: 'radiant' | 'dire'): Promise<void> {
    fake.setLobby({ state: LOBBY.RUN, matchId: '0' });
    await flush();
    fake.setLobby({ state: LOBBY.RUN, matchId });
    await flush();
    fake.setLobby({ state: LOBBY.POSTGAME, matchId, matchOutcome: winner === 'radiant' ? OUTCOME.RADIANT : OUTCOME.DIRE });
    await flush(3000); // the settle between leaving one lobby and creating the next
}

beforeEach(() => {
    vi.useFakeTimers({ now: new Date('2026-11-13T18:00:00Z') });
    store = new MemoryStore();
    fake = new FakeLobbyClient();
});

afterEach(async () => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('a bo3 series', () => {
    it('is played to 2:1 across three lobbies, with the teams swapping sides', async () => {
        seed(store);
        await start();

        expect(fake.created).toHaveLength(1);
        expect(fake.created[0]).toMatchObject({ name: 'ALP vs BET - Cup', password: 'pw', gameMode: 2, serverRegion: 3, seriesType: 1 });
        expect(fake.callsTo('invitePlayers')[0][0]).toEqual([...ALPHA, ...BETA]);
        expect(store.session(SESSION).state).toBe('lobby_open');

        // Game 1: Alpha on Radiant wins.
        await readyUp('radiant');
        expect(fake.callsTo('startGame')).toHaveLength(1);
        expect(fake.callsTo('updateSeriesScore')).toHaveLength(0); // 0:0 is not sent
        await play('1001', 'radiant');

        let s = store.session(SESSION);
        expect(s.currentGameNumber).toBe(2);
        expect(s.seriesScore).toEqual({ A: 1, B: 0 });
        expect(fake.created[1]).toMatchObject({ name: 'ALP vs BET - Cup - Game 2', radiantSeriesWins: 1, direSeriesWins: 0 });

        // Game 2: Alpha moves to Dire; Radiant (Beta) wins. The lobby score follows the sides.
        await readyUp('dire');
        expect(fake.callsTo('updateSeriesScore')[0]).toEqual([0, 1, 0, 0]);
        await play('1002', 'radiant');
        s = store.session(SESSION);
        expect(s.seriesScore).toEqual({ A: 1, B: 1 });
        expect(s.completedGameWinners).toEqual(['radiant', 'dire']); // session labels: Alpha=radiant, Beta=dire

        // Game 3: Alpha on Radiant wins the series.
        await readyUp('radiant');
        await play('1003', 'radiant');

        await expect(done).resolves.toBe(0);
        s = store.session(SESSION);
        expect(s.state).toBe('completed');
        expect(s.completedGameIds).toEqual([1001, 1002, 1003]);
        expect(s.seriesScore).toEqual({ A: 2, B: 1 });
        expect(fake.chat).toContain('Series decided! Alpha wins Alpha 2 - 1 Beta');
        expect(store.resultTasks.map((t) => t.type === 'sync' && t.dotaMatchId)).toEqual([1001, 1002, 1003]);
        expect(store.resultTasks[0]).toMatchObject({ sessionId: SESSION, matchId: MATCH, tournamentId: T, status: 'pending', syncAt: '2026-11-13T18:05:05.000Z' });
        expect(store.account(BOT)).toMatchObject({ status: 'idle', busyWithSessionId: null, currentSessionId: null });
        expect(fake.isConnected).toBe(false);
    });

    it('does not mark a team ready until all its players sit together', async () => {
        seed(store);
        await start();
        fake.teamNames = { radiant: 'R', dire: 'D' };
        fake.seat([...ALPHA.slice(0, 4).map((id): [string, 'radiant'] => [id, 'radiant']), [ALPHA[4], 'spectator']]);
        await flush();
        fake.say(ALPHA[0], '!ready');
        await flush();
        expect(store.session(SESSION).readyState.radiantReady).toBe(false);
        expect(fake.chat).toContain('Alpha missing a-105');
    });

    it('refuses to ready a team whose lobby team name is blank', async () => {
        seed(store);
        await start();
        seatTeams(fake, 'radiant');
        fake.teamNames = { radiant: '', dire: 'D' };
        await flush();
        fake.say(ALPHA[0], '!ready');
        await flush();
        expect(store.session(SESSION).readyState.radiantReady).toBe(false);
        expect(fake.chat.at(-1)).toContain('set your team name in the lobby');
    });
});

describe('enforcement', () => {
    it('kicks an unregistered player once and names them in chat, but never the bot or the whitelist', async () => {
        seed(store, {}, { whitelist: [{ steamId32: '777' }] });
        await start();
        seatTeams(fake, 'radiant', [['666', 'spectator'], ['777', 'spectator']]);
        await flush();
        fake.push(); // the GC repeats the update while the kick is in flight
        await flush();
        expect(fake.callsTo('kickPlayer')).toEqual([['666']]);
        expect(fake.chat).toContain('Player name-666 is not registered for this match and has been removed.');
    });
});

describe('late arrival', () => {
    it('forfeits game 1 to the present team after a passed vote, and the series goes on', async () => {
        seed(store, { scheduledMatchTime: '2026-11-13T17:49:00Z' }, {
            lateArrival: {
                enabled: true, game1ForfeitMinutes: 10, seriesForfeitMinutes: 20, waitCommands: ['!wait'], forfeitCommands: ['!forfeit'],
                votingWindowSeconds: 60, requiredVotesForForfeit: 3, lateGame1AnnouncementTemplate: '{late_team} late', forfeitGame1Template: '{winner_team} takes game 1',
            },
        });
        await start();
        fake.teamNames = { radiant: 'R', dire: 'D' };
        fake.seat(ALPHA.map((id): [string, 'radiant'] => [id, 'radiant']));
        await flush(15000); // the late-arrival tick

        expect(store.session(SESSION).lateVote).toMatchObject({ kind: 'game1', lateSide: 'dire' });
        expect(fake.chat).toContain('[BOT] Beta late');
        for (const id of ALPHA.slice(0, 3)) fake.say(id, '!forfeit');
        fake.say(BETA[0], '!forfeit'); // the late team has no vote
        // The vote closes after 60 s and is resolved on the next 15 s tick; the next
        // game's lobby follows a 3 s settle.
        await flush(60000 + 15000 + 3000);

        const s = store.session(SESSION);
        expect(s.seriesScore).toEqual({ A: 1, B: 0 });
        expect(s.completedGameIds).toEqual([0]);
        expect(s.forfeitedGames).toEqual([{ gameNumber: 1, forfeitedTeam: 'dire', winnerTeam: 'radiant' }]);
        expect(s.currentGameNumber).toBe(2);
        expect(store.resultTasks).toEqual([expect.objectContaining({
            type: 'forfeit', forfeitingTeamId: 'B', forfeitedGameNumbers: [1],
            reason: 'No-show — Game 1 forfeit (late-arrival vote passed)',
        })]);

        // An admin cancels from the website: the runner leaves.
        await store.updateSession(SESSION, { state: 'cancelled' });
        await flush();
        await expect(done).resolves.toBe(0);
        expect(store.account(BOT).status).toBe('idle');
    });
});

describe('stand-ins', () => {
    it('invites a stand-in approved after the lobby opened and removes the player they replace', async () => {
        seed(store);
        await start();
        store.putMatch(T, MATCH, aMatch({
            approvedStandins: { r1: { teamId: 'B', replacedPlayerId: 'b2', steamId32: '299', nickname: 'sub' } },
        }));
        await flush();

        expect(fake.callsTo('invitePlayer')).toContainEqual(['299']);
        expect(fake.callsTo('kickPlayer')).toContainEqual(['202']);
        const s = store.session(SESSION);
        expect(s.direTeam.expectedPlayers.map((p) => p.steamId32)).toEqual(['201', '299', '203', '204', '205']);
        expect(s.standinAssignments).toEqual([{ teamId: 'B', replacedPlayerId: 'b2', steamId32: '299', nickname: 'sub', gameNumbers: [] }]);
    });
});

describe('restarts', () => {
    it('reattaches to its live lobby after a crash and still records the game that ends', async () => {
        seed(store, { state: 'in_game', dotaLobbyId: '4242', currentGameSides: { radiant: 'A', dire: 'B' } });
        store.putMatch(T, MATCH, aMatch({ status: 'scheduled' }));
        fake.cacheLobby('4242', LOBBY.RUN, '5555');
        await start();

        expect(fake.created).toHaveLength(0);
        expect(fake.callsTo('reattachToCachedLobby')).toHaveLength(1);
        fake.setLobby({ state: LOBBY.POSTGAME, matchId: '5555', matchOutcome: OUTCOME.DIRE });
        await flush(3000);

        const s = store.session(SESSION);
        expect(s.completedGameIds).toEqual([5555]);
        expect(s.seriesScore).toEqual({ A: 0, B: 1 });
        expect(s.currentGameNumber).toBe(2);
    });

    it('finishes without reattaching when the match was completed while it was down', async () => {
        seed(store, { state: 'in_game', dotaLobbyId: '4242' });
        store.putMatch(T, MATCH, aMatch({ status: 'completed' }));
        fake.cacheLobby('4242', LOBBY.POSTGAME);
        await start();
        await expect(done).resolves.toBe(0);
        expect(store.session(SESSION).state).toBe('completed');
        expect(fake.callsTo('reattachToCachedLobby')).toHaveLength(0);
    });

    it('hands a fresh session to another bot when this one is stuck in an earlier game', async () => {
        seed(store);
        fake.cacheLobby('old', LOBBY.RUN);
        await start();
        await expect(done).resolves.toBe(0);
        const s = store.session(SESSION);
        expect(s).toMatchObject({ state: 'pending', botAccountId: '', reassignCount: 1 });
        expect(store.account(BOT)).toMatchObject({ status: 'idle', cooldownUntil: '2026-11-13T18:30:05.000Z' });
        expect(fake.created).toHaveLength(0);
    });

    it('exits for a respawn, keeping the account, when the lobby cannot be created', async () => {
        seed(store);
        fake.failCreates = 4;
        await start();
        await flush(60000); // four attempts with backoff
        await expect(done).resolves.toBe(1);
        expect(store.session(SESSION).state).toBe('lobby_creating'); // not terminal: the Conductor respawns
        expect(store.account(BOT).status).not.toBe('idle');
    });
});

describe('a lost game-end event', () => {
    it('is recovered from OpenDota while the game is live', async () => {
        const fetchMock = vi.fn(async () => new Response(JSON.stringify({ radiant_win: false }), { status: 200 }));
        vi.stubGlobal('fetch', fetchMock);
        seed(store);
        await start();
        await readyUp('radiant');
        fake.setLobby({ state: LOBBY.RUN, matchId: '7777' });
        await flush();
        // No POSTGAME arrives. The 2-minute poll finds the result.
        await flush(120000);
        expect(fetchMock).toHaveBeenCalledWith('https://api.opendota.com/api/matches/7777', expect.anything());
        const s = store.session(SESSION);
        expect(s.completedGameIds).toEqual([7777]);
        expect(s.seriesScore).toEqual({ A: 0, B: 1 });
    });
});
