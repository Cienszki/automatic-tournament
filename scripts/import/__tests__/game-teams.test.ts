// A game's teams from its players (game-teams.ts): the labels only when the players decide nothing.

import { describe, expect, it } from 'vitest';
import { resolveGameTeams, sideOf, type GamePlayer, type Pick, type TeamsInput } from '../mappers/game-teams';

/** Five accounts per side, heroes 1-5 picked by Radiant (team 0) and 6-10 by Dire (team 1). */
const PICKS: Pick[] = Array.from({ length: 10 }, (_, i) => ({ heroId: i + 1, isPick: true, team: i < 5 ? 0 : 1 }));
const BANS: Pick[] = [{ heroId: 50, isPick: false, team: 0 }];
const players = (radiant: string[], dire: string[]): GamePlayer[] => [
  ...radiant.map((steamId64, i) => ({ steamId64, heroId: i + 1, isRadiant: null })),
  ...dire.map((steamId64, i) => ({ steamId64, heroId: i + 6, isRadiant: null })),
];
const roster = (team: string, ids: string[]) => ids.map((id): [string, string[]] => [id, [team]]);
const PUMY = ['p1', 'p2', 'p3', 'p4', 'p5'];
const KEPSKI = ['k1', 'k2', 'k3', 'k4', 'k5'];
const teamsOf = new Map<string, string[]>([...roster('pumy', PUMY), ...roster('kepski', KEPSKI)]);

const input = (over: Partial<TeamsInput>): TeamsInput => ({
  players: players(KEPSKI, PUMY), picks: [...BANS, ...PICKS], labels: { radiant: 'kepski', dire: 'pumy' }, teamsOf, matchTeams: ['pumy', 'kepski'], ...over,
});

describe('the teams of a game', () => {
  // Letnia 2025, Grupa Foczek, 25 August 2025, Ja w sprawie pumy 2:0 Kępski Kryształ, game 2
  // (8433022489): a fix script labelled it Pora na przygode vs CINCO PERROS.
  it('come from the players when the labels name two other teams, and the disagreement is flagged', () => {
    expect(resolveGameTeams(input({ labels: { radiant: 'pora', dire: 'cinco' } }))).toEqual({ radiant: 'kepski', dire: 'pumy', by: 'players', disagrees: true });
  });

  it('agree with labels that are right', () => {
    expect(resolveGameTeams(input({}))).toEqual({ radiant: 'kepski', dire: 'pumy', by: 'players', disagrees: false });
  });

  it.each([
    ['there are no performances', { players: [] }],
    ['no side is known (no picks, no replay flag)', { picks: [] }],
    ['a side is level between two teams', { players: players(['k1', 'k2', 'p1', 'p2', 'x'], PUMY.map((p) => `${p}-smurf`)) }],
    ['only one account of a team is on each side', { players: players(['k1', 'x1', 'x2', 'x3', 'x4'], ['p1', 'y1', 'y2', 'y3', 'y4']) }],
  ])('are the labels when %s', (_why, over) => {
    expect(resolveGameTeams(input({ ...over, labels: { radiant: 'pora', dire: 'cinco' } }))).toEqual({ radiant: 'pora', dire: 'cinco', by: 'labels', disagrees: false });
  });

  it('take the other match team for a side the players leave open', () => {
    const fivePumy = players(['x1', 'x2', 'x3', 'x4', 'x5'], PUMY);
    expect(resolveGameTeams(input({ players: fivePumy, labels: { radiant: null, dire: null } }))).toEqual({ radiant: 'kepski', dire: 'pumy', by: 'players', disagrees: false });
  });

  it('count a stand-in approved for the match, and win with three of five', () => {
    const standin = new Map([...teamsOf, ['s1', ['kepski']], ['s2', ['kepski']]]);
    const r = resolveGameTeams(input({ players: players(['k1', 's1', 's2', 'p1', 'x'], ['p2', 'p3', 'p4', 'p5', 'y']), teamsOf: standin }));
    expect(r).toMatchObject({ radiant: 'kepski', dire: 'pumy', by: 'players' });
  });

  it('read a player\'s side from the replay when the hero is not among the picks', () => {
    expect(sideOf({ steamId64: 'x', heroId: 99, isRadiant: false }, PICKS)).toBe('dire');
    expect(sideOf({ steamId64: 'x', heroId: 1, isRadiant: false }, PICKS)).toBe('radiant');
    expect(sideOf({ steamId64: 'x', heroId: 50, isRadiant: null }, BANS)).toBeNull();
  });
});
