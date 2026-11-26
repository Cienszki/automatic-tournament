// A game's teams from its players (game-teams.ts): which of the match's two teams was Radiant;
// never a third team; the labels only when the players decide nothing.

import { describe, expect, it } from 'vitest';
import * as s from '@/platform/db/schema';
import { resolveGameTeams, sideOf, type GamePlayer, type Pick, type TeamsInput } from '../mappers/game-teams';
import { rosterAccounts } from '../mappers/games-assign';
import type { MapState } from '../mappers/state';
import { RowSet } from '../rows';

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
const CINCO = ['c1', 'c2', 'c3', 'c4', 'c5'];
const teamsOf = new Map<string, string[]>([...roster('pumy', PUMY), ...roster('kepski', KEPSKI), ...roster('cinco', CINCO)]);

const input = (over: Partial<TeamsInput>): TeamsInput => ({
  players: players(KEPSKI, PUMY), picks: [...BANS, ...PICKS], labels: { radiant: 'kepski', dire: 'pumy' }, teamsOf, matchTeams: ['pumy', 'kepski'], ...over,
});
const LABELS = { radiant: 'pora', dire: 'cinco' };

describe('the teams of a game', () => {
  // Letnia Batalia, Grupa Foczek, 25 August 2025, Ja w sprawie pumy 2:0 Kępski Kryształ, game 2
  // (8433022489): a fix script labelled it Pora na przygode vs CINCO PERROS.
  it('come from the players when the labels name two other teams, and the disagreement is flagged', () => {
    expect(resolveGameTeams(input({ labels: LABELS }))).toEqual({ radiant: 'kepski', dire: 'pumy', by: 'players', disagrees: true, otherTeam: null });
  });

  it('agree with labels that are right', () => {
    expect(resolveGameTeams(input({}))).toEqual({ radiant: 'kepski', dire: 'pumy', by: 'players', disagrees: false, otherTeam: null });
  });

  it('are always the match\'s two teams: a side held by a third team is reported, never assigned', () => {
    expect(resolveGameTeams(input({ players: players(CINCO, PUMY), labels: LABELS }))).toEqual({ radiant: 'kepski', dire: 'pumy', by: 'players', disagrees: true, otherTeam: 'cinco' });
    expect(resolveGameTeams(input({ players: players(CINCO, ['c1', 'c2', 'c3', 'x', 'y']), labels: LABELS })))
      .toEqual({ radiant: 'pora', dire: 'cinco', by: 'labels', disagrees: false, otherTeam: 'cinco' });
  });

  it.each([
    ['there are no performances', { players: [] }],
    ['no side is known (no picks, no replay flag)', { picks: [] }],
    ['the accounts are level between the two ways round', { players: players(['k1', 'k2', 'p1', 'p2', 'x'], PUMY.map((p) => `${p}-smurf`)) }],
    ['only one account of the match\'s teams played', { players: players(['k1', 'x1', 'x2', 'x3', 'x4'], ['y0', 'y1', 'y2', 'y3', 'y4']) }],
  ])('are the labels when %s', (_why, over) => {
    expect(resolveGameTeams(input({ ...over, labels: LABELS }))).toMatchObject({ radiant: 'pora', dire: 'cinco', by: 'labels', disagrees: false });
  });

  it('take the other match team for a side the players leave open', () => {
    const fivePumy = players(['x1', 'x2', 'x3', 'x4', 'x5'], PUMY);
    expect(resolveGameTeams(input({ players: fivePumy, labels: { radiant: null, dire: null } }))).toMatchObject({ radiant: 'kepski', dire: 'pumy', by: 'players' });
  });

  it('take the side\'s leading roster when a bracket slot of the match is not filled', () => {
    expect(resolveGameTeams(input({ matchTeams: ['pumy', null], labels: { radiant: null, dire: null } }))).toMatchObject({ radiant: 'kepski', dire: 'pumy', by: 'players' });
  });

  it('count a stand-in approved for the match', () => {
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

describe('the roster accounts of a game', () => {
  const member = (id: string, steamId64: string, over: Record<string, unknown> = {}) => ({
    tournamentId: 't', id, teamId: 'kepski', steamId64, kind: 'player', smurfAccounts: [], joinedAt: new Date('2025-08-01T00:00:00Z'), leftAt: null, ...over,
  });
  const rows = new RowSet();
  rows.add(s.teamMembers, [
    member('on', 'k1', { smurfAccounts: [{ steamId64: 'k1-smurf' }] }),
    member('later', 'k2', { joinedAt: new Date('2025-08-26T00:00:00Z') }),
    member('gone', 'k3', { leftAt: new Date('2025-08-20T00:00:00Z') }),
    member('coach', 'k4', { kind: 'coach' }),
  ]);
  rows.add(s.standinRequests, [
    { tournamentId: 't', id: 'r', matchId: 'm', teamId: 'pumy', standinSteamId64: 'k1', status: 'approved' },
    // Names a team that is not in its match: counts for no team.
    { tournamentId: 't', id: 'r3', matchId: 'm', teamId: 'third', standinSteamId64: 'k2', status: 'approved' },
  ]);
  const matchTeams = new Map([['m', { a: 'kepski', b: 'pumy', bestOf: 3 }], ['other', { a: 'kepski', b: 'pumy', bestOf: 3 }]]);
  const state = { rows, matchTeams } as unknown as MapState;
  const start = new Date('2025-08-25T16:57:50Z');

  it('leave out members who joined after the game started or left before it, and coaches', () => {
    expect(Object.fromEntries(rosterAccounts(state, 'other', start))).toEqual({ k1: ['kepski'], 'k1-smurf': ['kepski'] });
  });

  it('give a stand-in approved for the match to that team only', () => {
    expect(rosterAccounts(state, 'm', start).get('k1')).toEqual(['pumy']);
  });

  it('ignore an approved request whose team is not one of the match\'s two teams', () => {
    expect(rosterAccounts(state, 'm', start).has('k2')).toBe(false);
  });
});
