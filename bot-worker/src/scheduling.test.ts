import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildBasePlayers,
  buildExpectedPlayersForGame,
  buildStandinAssignments,
  generateLobbyPassword,
  scheduleUpcomingMatches,
  seriesTotals,
} from './scheduling';
import { MemoryStore } from './testing/memory-store';
import { aBotConfig, aMatch } from './testing/fixtures';

describe('scheduleUpcomingMatches', () => {
  afterEach(() => { vi.useRealTimers(); });

  function storeWith(matches: Record<string, ReturnType<typeof aMatch>>): MemoryStore {
    vi.useFakeTimers({ now: new Date('2026-11-13T18:00:00Z') });
    const store = new MemoryStore();
    for (const [id, m] of Object.entries(matches)) store.putMatch('cup', id, m);
    store.putTeam('cup', 'A', { tag: 'ALP', players: [{ id: 'a1', steamId32: '101', nickname: 'one' }] });
    store.putTeam('cup', 'B', { tag: '', roster: { '7656': { steamId32: '201', nickname: 'two' } } });
    return store;
  }

  it('creates one pending session per match inside the lead window, with group matches as bo2', async () => {
    const store = storeWith({
      soon: aMatch({ scheduledFor: '2026-11-13T18:08:00Z', group_id: 'g1' }),
      late: aMatch({ scheduledFor: '2026-11-13T17:40:00Z', series_format: 'bo5' }),
      far: aMatch({ scheduledFor: '2026-11-13T18:30:00Z' }),
      stale: aMatch({ scheduledFor: '2026-11-13T17:20:00Z' }),
      decided: aMatch({ scheduledFor: '2026-11-13T18:05:00Z', winnerId: 'A' }),
      untimed: aMatch(),
    });
    const created = await scheduleUpcomingMatches(store, 'cup', aBotConfig(), { name: 'Cup', lobbySettings: { leagueName: 'PDL' } });
    expect(created).toBe(2);
    const sessions = [...store.sessions.values()];
    expect(sessions.map((s) => [s.matchId, s.seriesFormat, s.totalGames, s.lobbySeriesType])).toEqual([
      ['soon', 'bo2', 2, 1],
      ['late', 'bo5', 5, 2],
    ]);
    // Tags first; a blank tag falls back to the name.
    expect(sessions[0]).toMatchObject({ state: 'pending', botAccountId: '', lobbyName: 'ALP vs Beta - PDL', seriesScore: { A: 0, B: 0 } });
    expect(sessions[0].lobbyPassword).toMatch(/^[A-Za-z0-9]{8}$/);
    expect(sessions[0].direTeam.expectedPlayers).toEqual([{ steamId32: '201', nickname: 'two', isStandin: false }]);
  });

  it('skips a match that already has a live session, uses the fixed password, and does nothing when disabled', async () => {
    const store = storeWith({ soon: aMatch({ scheduledFor: '2026-11-13T18:08:00Z' }) });
    expect(await scheduleUpcomingMatches(store, 'cup', aBotConfig({ enabled: false }), null)).toBe(0);
    expect(await scheduleUpcomingMatches(store, 'cup', aBotConfig({ lobby: { password: ' fixed ' } }), null)).toBe(1);
    expect([...store.sessions.values()][0]).toMatchObject({ lobbyPassword: 'fixed', lobbyName: 'ALP vs Beta - Tournament', seriesFormat: 'bo3' });
    expect(await scheduleUpcomingMatches(store, 'cup', aBotConfig(), null)).toBe(0);
  });
});

describe('seriesTotals', () => {
  it.each([
    ['bo1', 1, 0], ['bo2', 2, 1], ['bo3', 3, 1], ['bo5', 5, 2], [undefined, 1, 0],
  ] as const)('%s → %i games, lobby series_type %i', (format, games, type) => {
    expect(seriesTotals(format)).toEqual({ fmt: format ?? 'bo1', totalGames: games, lobbySeriesType: type });
  });
});

describe('generateLobbyPassword', () => {
  it('is eight characters without the ambiguous ones (0, O, 1, l, I)', () => {
    for (let i = 0; i < 50; i++) expect(generateLobbyPassword()).toMatch(/^[A-HJ-NP-Za-km-z2-9]{8}$/);
  });
});

describe('buildBasePlayers', () => {
  it('reads the players[] array when present', () => {
    expect(buildBasePlayers({ players: [{ id: 'p1', steamId32: '11', nickname: 'a' }, { id: 'p2', nickname: 'b' }] }))
      .toEqual([{ id: 'p1', steamId32: '11', nickname: 'a' }, { id: 'p2', steamId32: '', nickname: 'b' }]);
  });

  it('falls back to the roster map keyed by Steam64', () => {
    expect(buildBasePlayers({ players: [], roster: { '7656': { steamId32: '22', nickname: 'c' } } }))
      .toEqual([{ id: '7656', steamId32: '22', nickname: 'c' }]);
  });
});

describe('per-game rosters with stand-ins', () => {
  const base = [
    { id: 'p1', steamId32: '11', nickname: 'one' },
    { id: 'p2', steamId32: '12', nickname: 'two' },
    { id: 'p3', steamId32: '', nickname: 'no-steam' },
  ];
  const standins = buildStandinAssignments({
    approvedStandins: {
      r1: { teamId: 'A', replacedPlayerId: 'p2', steamId32: '90', nickname: 'sub', gameNumbers: [2] },
      r2: { teamId: 'A', replacedPlayerId: 'p3', steamId32: '91', nickname: 'sub-all' },
      r3: { teamId: 'B', replacedPlayerId: 'p1', steamId32: '92', nickname: 'other-team' },
    },
  });

  it('normalises a missing game list to [] (whole series)', () => {
    expect(standins.map((s) => s.gameNumbers)).toEqual([[2], [], []]);
  });

  it('applies a game-scoped stand-in only in its game, and a whole-series one always', () => {
    const g1 = buildExpectedPlayersForGame(base, standins, 'A', 1);
    expect(g1.map((p) => p.steamId32)).toEqual(['11', '12', '91']);
    const g2 = buildExpectedPlayersForGame(base, standins, 'A', 2);
    expect(g2).toEqual([
      { steamId32: '11', nickname: 'one', isStandin: false },
      { steamId32: '90', nickname: 'sub', isStandin: true, replacesPlayerId: 'p2', replacesPlayerNickname: 'two' },
      { steamId32: '91', nickname: 'sub-all', isStandin: true, replacesPlayerId: 'p3', replacesPlayerNickname: 'no-steam' },
    ]);
  });

  it('drops players without a Steam id unless a stand-in covers them', () => {
    expect(buildExpectedPlayersForGame(base, [], 'A', 1).map((p) => p.steamId32)).toEqual(['11', '12']);
  });
});
