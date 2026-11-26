// Where a game goes (placement.ts): by date, never onto a full format, an owner correction first.

import { describe, expect, it } from 'vitest';
import { isFull, nearest, placeGames, warsawDay, type PlacementGame, type PlacementMatch } from '../mappers/placement';

const at = (iso: string) => new Date(iso);
const match = (id: string, over: Partial<PlacementMatch> = {}): PlacementMatch => ({
  id, teamAId: 'a', teamBId: 'b', bestOf: 3, status: 'completed', scheduledAt: null, scoreA: null, scoreB: null, ...over,
});
const game = (key: string, sourceMatchId: string, dotaMatchId: number | null, start: string | null, forfeit = false): PlacementGame => ({
  key, sourceMatchId, dotaMatchId, start: start ? at(start) : null, forfeit,
});

// Wiosenna Furia as captured: the two Grupa B matches of Adaś (best of 2, stored 1:2 and 2:1)
// each list a third game that belongs to the same teams' upper-bracket match (best of 3).
const WIOSENNA: PlacementMatch[] = [
  match('HVwwRd87bSFsCzkph25p', { teamAId: 'chrupek', teamBId: 'adas', bestOf: 2, scheduledAt: at('2026-06-24T17:30:00Z'), scoreA: 1, scoreB: 1 }),
  match('ub-r3-p1', { teamAId: 'chrupek', teamBId: 'adas', scheduledAt: at('2026-07-23T19:00:00Z'), scoreA: 1, scoreB: 2 }),
  match('cxozIoYGO0ViB55POI36', { teamAId: 'puck', teamBId: 'adas', bestOf: 2, scheduledAt: at('2026-06-30T17:30:00Z'), scoreA: 2, scoreB: 0 }),
  match('ub-r2-p2', { teamAId: 'adas', teamBId: 'puck', scheduledAt: at('2026-07-19T17:00:00Z'), scoreA: 2, scoreB: 1 }),
];
const WIOSENNA_GAMES: PlacementGame[] = [
  game('HVww/8864879466', 'HVwwRd87bSFsCzkph25p', 8864879466, '2026-06-24T17:37:27Z'),
  game('HVww/8864938660', 'HVwwRd87bSFsCzkph25p', 8864938660, '2026-06-24T18:26:54Z'),
  game('HVww/8910469903', 'HVwwRd87bSFsCzkph25p', 8910469903, '2026-07-23T21:13:11Z'),
  game('ub-r3-p1/8910316678', 'ub-r3-p1', 8910316678, '2026-07-23T19:10:15Z'),
  game('ub-r3-p1/8910390446', 'ub-r3-p1', 8910390446, '2026-07-23T20:07:59Z'),
  game('ub-r3-p1/8910469903', 'ub-r3-p1', 8910469903, '2026-07-23T21:13:11Z'),
  game('cxoz/8874907140', 'cxozIoYGO0ViB55POI36', 8874907140, '2026-06-30T17:36:07Z'),
  game('cxoz/8874996687', 'cxozIoYGO0ViB55POI36', 8874996687, '2026-06-30T18:39:11Z'),
  game('cxoz/8904592446', 'cxozIoYGO0ViB55POI36', 8904592446, '2026-07-19T19:57:30Z'),
  game('ub-r2-p2/8904373133', 'ub-r2-p2', 8904373133, '2026-07-19T17:04:12Z'),
  game('ub-r2-p2/8904492285', 'ub-r2-p2', 8904492285, '2026-07-19T18:27:16Z'),
  game('ub-r2-p2/8904592446', 'ub-r2-p2', 8904592446, '2026-07-19T19:57:30Z'),
];

describe('placing the games of Wiosenna Furia', () => {
  it('keeps each game stored twice under the upper-bracket match it was played in, as its own copy there', () => {
    const { placed, notes } = placeGames(WIOSENNA_GAMES, WIOSENNA);
    expect(placed.get('ub-r3-p1/8910469903')).toBe('ub-r3-p1');
    expect(placed.get('ub-r2-p2/8904592446')).toBe('ub-r2-p2');
    expect(placed.has('HVww/8910469903')).toBe(false);
    expect(placed.has('cxoz/8904592446')).toBe(false);
    expect(placed.size).toBe(10);
    expect(notes.filter((n) => n.kind === 'duplicate').map((n) => [n.dotaMatchId, n.from, n.to])).toEqual([
      [8904592446, ['cxozIoYGO0ViB55POI36', 'ub-r2-p2'], 'ub-r2-p2'],
      [8910469903, ['HVwwRd87bSFsCzkph25p', 'ub-r3-p1'], 'ub-r3-p1'],
    ]);
  });

  it('follows an owner correction over every other rule, and says it matched', () => {
    const rules = [{ id: 'r', dotaMatchId: 8910469903, matchId: 'ub-r3-p1', notMatchId: 'HVwwRd87bSFsCzkph25p' }];
    const { placed, rulesApplied, notes } = placeGames(WIOSENNA_GAMES, WIOSENNA, rules);
    expect(placed.get('ub-r3-p1/8910469903')).toBe('ub-r3-p1');
    expect([...rulesApplied]).toEqual(['r']);
    expect(notes.find((n) => n.dotaMatchId === 8910469903)?.kind).toBe('rule');
  });

  it('leaves every other game where it is', () => {
    const { placed, notes } = placeGames(WIOSENNA_GAMES, WIOSENNA);
    for (const g of WIOSENNA_GAMES.filter((x) => ![8910469903, 8904592446].includes(x.dotaMatchId!))) expect(placed.get(g.key)).toBe(g.sourceMatchId);
    expect(notes.filter((n) => n.kind === 'moved' || n.kind === 'full')).toEqual([]);
  });
});

describe('placing a game stored under two matches', () => {
  const two = [game('m1/g', 'm1', 9, '2026-07-01T18:00:00Z'), game('m2/g', 'm2', 9, '2026-07-01T18:00:00Z')];

  it.each([
    ['the match scheduled nearest its start', [match('m1', { scheduledAt: at('2026-06-01T18:00:00Z') }), match('m2', { scheduledAt: at('2026-07-01T17:00:00Z') })], 'm2'],
    ['a scheduled match over an unscheduled one', [match('m1'), match('m2', { scheduledAt: at('2026-01-01T00:00:00Z') })], 'm2'],
    ['the first match when neither is scheduled', [match('m1'), match('m2')], 'm1'],
    ['a match with room over a nearer full one', [match('m1', { bestOf: 1, scheduledAt: at('2026-07-01T18:00:00Z') }), match('m2', { scheduledAt: at('2026-09-01T18:00:00Z') })], 'm2'],
  ])('goes to %s', (_what, matches, to) => {
    const extra = matches[0].bestOf === 1 ? [game('m1/other', 'm1', 10, '2026-07-01T17:00:00Z')] : [];
    expect(placeGames([...two, ...extra], matches).placed.get(`${to}/g`)).toBe(to);
  });

  it('stays on the nearest match and is reported when every match is full', () => {
    const matches = [match('m1', { bestOf: 1, scheduledAt: at('2026-07-01T18:00:00Z') }), match('m2', { bestOf: 1, scheduledAt: at('2026-08-01T18:00:00Z') })];
    const games = [...two, game('m1/x', 'm1', 11, null), game('m2/y', 'm2', 12, null)];
    const { placed, notes } = placeGames(games, matches);
    expect(placed.get('m1/g')).toBe('m1');
    expect(notes.find((n) => n.kind === 'full')).toMatchObject({ dotaMatchId: 9, matchId: 'm1' });
  });
});

describe('a game stored under one match only', () => {
  const matches = [
    match('group', { scheduledAt: at('2026-06-24T17:30:00Z') }),
    match('playoff', { scheduledAt: at('2026-07-23T19:00:00Z') }),
    match('other-teams', { teamAId: 'c', teamBId: 'd', scheduledAt: at('2026-07-23T19:00:00Z') }),
  ];

  it('moves to the match of the same two teams on its day, with a note', () => {
    const { placed, notes } = placeGames([game('group/g', 'group', 1, '2026-07-23T21:00:00Z')], matches);
    expect(placed.get('group/g')).toBe('playoff');
    expect(notes).toEqual([{ kind: 'moved', key: 'group/g', dotaMatchId: 1, from: 'group', to: 'playoff' }]);
  });

  it.each([
    ['it started on its own match\'s day', game('group/g', 'group', 1, '2026-06-24T20:00:00Z')],
    ['no match of the same teams is on its day', game('group/g', 'group', 1, '2026-07-10T20:00:00Z')],
    ['it has no start time', game('group/g', 'group', 1, null)],
    ['it is a forfeited game', game('group/f', 'group', null, '2026-07-23T21:00:00Z', true)],
  ])('stays when %s', (_why, g) => {
    expect(placeGames([g], matches).placed.get(g.key)).toBe('group');
  });

  it('does not move onto a full match, and says so', () => {
    const full = [matches[0], match('playoff', { bestOf: 1, scheduledAt: at('2026-07-23T19:00:00Z') })];
    const games = [game('group/g', 'group', 1, '2026-07-23T21:00:00Z'), game('playoff/p', 'playoff', 2, '2026-07-23T19:10:00Z')];
    const { placed, notes } = placeGames(games, full);
    expect(placed.get('group/g')).toBe('group');
    expect(notes).toEqual([{ kind: 'full', key: 'group/g', dotaMatchId: 1, matchId: 'group', wanted: 'playoff' }]);
  });

  it('reads the day in Warsaw: 23:30 UTC on 23 July is 24 July there', () => {
    expect(warsawDay(at('2026-07-23T23:30:00Z'))).toBe('2026-07-24');
    expect(warsawDay(at('2026-07-23T21:59:00Z'))).toBe('2026-07-23');
  });
});

describe('a tie between matches equally near', () => {
  const start = at('2026-07-01T18:00:00Z');
  const byId = (ms: PlacementMatch[]) => new Map(ms.map((m) => [m.id, m]));

  it.each([
    ['the earlier scheduled match, one hour before and one after', [match('z', { scheduledAt: at('2026-07-01T19:00:00Z') }), match('y', { scheduledAt: at('2026-07-01T17:00:00Z') })], start, 'y'],
    ['the lower match id when both are scheduled at the same time', [match('m2', { scheduledAt: at('2026-07-01T17:00:00Z') }), match('m1', { scheduledAt: at('2026-07-01T17:00:00Z') })], start, 'm1'],
    ['a scheduled match over unscheduled ones', [match('a'), match('b', { scheduledAt: at('2026-09-01T00:00:00Z') })], start, 'b'],
    ['the lower match id when none is scheduled, whatever the capture order', [match('m9'), match('m3'), match('m5')], start, 'm3'],
    ['the earlier scheduled match when the game has no start', [match('late', { scheduledAt: at('2026-08-01T00:00:00Z') }), match('early', { scheduledAt: at('2026-06-01T00:00:00Z') })], null, 'early'],
  ])('goes to %s', (_what, ms, when, to) => {
    expect(nearest(ms.map((m) => m.id), when, byId(ms))).toBe(to);
    expect(nearest([...ms].reverse().map((m) => m.id), when, byId(ms))).toBe(to);
  });

  it('places a game stored under two equally near matches on the earlier one, whichever copy comes first', () => {
    const ms = [match('m1', { scheduledAt: at('2026-07-01T19:00:00Z') }), match('m2', { scheduledAt: at('2026-07-01T17:00:00Z') })];
    const copies = [game('m1/g', 'm1', 9, '2026-07-01T18:00:00Z'), game('m2/g', 'm2', 9, '2026-07-01T18:00:00Z')];
    expect([...placeGames(copies, ms).placed]).toEqual([['m2/g', 'm2']]);
    expect([...placeGames([...copies].reverse(), ms).placed]).toEqual([['m2/g', 'm2']]);
  });
});

describe('a full match', () => {
  it.each([
    ['as many games as its format', match('m', { bestOf: 2, status: 'scheduled' }), 2, true],
    ['room in its format', match('m', { bestOf: 3, status: 'scheduled' }), 2, false],
    ['completed with every game of its score', match('m', { bestOf: 3, scoreA: 2, scoreB: 0 }), 2, true],
    ['completed, a game of its score missing', match('m', { bestOf: 3, scoreA: 2, scoreB: 1 }), 2, false],
    ['completed with no score', match('m', { bestOf: 3 }), 2, false],
  ])('%s', (_what, m, games, full) => {
    expect(isFull(m, games)).toBe(full);
  });
});
