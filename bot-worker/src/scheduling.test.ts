import { describe, expect, it } from 'vitest';
import {
  buildBasePlayers,
  buildExpectedPlayersForGame,
  buildStandinAssignments,
  generateLobbyPassword,
  seriesTotals,
} from './scheduling';

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
