import { describe, expect, it } from 'vitest';
import { computeStandings } from '../standings';
import { aMatch, rulesWith, tableOrder, teams } from '../testing/builders';
import { SWISS_DEFAULT } from './defaults';
import type { StandingsInput } from './types';

const recordOf = (input: StandingsInput, id: string) => computeStandings(input).rows.find((r) => r.teamId === id)!.record;

describe('team records', () => {
  it('counts series, games and 2/1/0 points', () => {
    const input = { teams: teams('A', 'B', 'C'), matches: [aMatch('A', 'B', 2, 1), aMatch('A', 'C', 1, 1), aMatch('C', 'B', 2, 0)], rules: rulesWith([]) };
    expect(recordOf(input, 'A')).toEqual({ played: 2, wins: 1, draws: 1, losses: 0, gamesWon: 3, gamesLost: 2, points: 3, neustadtl: 0 + 1.5, buchholz: 0 + 3 });
  });

  it('uses the points the rules give', () => {
    const input = { teams: teams('A', 'B'), matches: [aMatch('A', 'B', 2, 1)], rules: rulesWith([], { points: { win: 3, draw: 1, loss: -1 } }) };
    expect(recordOf(input, 'A').points).toBe(3);
    expect(recordOf(input, 'B').points).toBe(-1);
  });

  it('counts games won as points in Swiss', () => {
    const input = { teams: teams('A', 'B'), matches: [aMatch('A', 'B', 2, 1)], rules: SWISS_DEFAULT };
    expect(recordOf(input, 'A').points).toBe(2);
    expect(recordOf(input, 'B').points).toBe(1);
  });

  it('counts a rematch and not the match it replays', () => {
    const matches = [aMatch('A', 'B', 2, 0, { replaced: true }), aMatch('A', 'B', 0, 2, { kind: 'rematch' })];
    const input = { teams: teams('A', 'B'), matches, rules: rulesWith([]) };
    expect(recordOf(input, 'B')).toMatchObject({ played: 1, wins: 1 });
    expect(recordOf(input, 'A')).toMatchObject({ played: 1, losses: 1 });
  });

  it('counts no void match, showmatch, tiebreak or unplayed match', () => {
    const matches = [
      aMatch('A', 'B', 2, 0, { status: 'void' }),
      aMatch('A', 'B', 2, 0, { kind: 'showmatch' }),
      aMatch('A', 'B', 2, 0, { kind: 'tiebreak' }),
      aMatch('A', 'B', 0, 0, { status: 'scheduled', scoreA: null, scoreB: null }),
      aMatch('A', 'B', 1, 0, { status: 'live' }),
    ];
    expect(recordOf({ teams: teams('A', 'B'), matches, rules: rulesWith([]) }, 'A').played).toBe(0);
  });

  it('ignores a result against a team outside the table, for both sides', () => {
    const input = { teams: teams('A', 'B'), matches: [aMatch('A', 'X', 2, 0), aMatch('B', 'A', 2, 0)], rules: rulesWith([]) };
    expect(recordOf(input, 'A')).toMatchObject({ played: 1, wins: 0, gamesWon: 0 });
  });

  it('counts only matches up to the given round', () => {
    const matches = [aMatch('A', 'B', 2, 0, { round: 1 }), aMatch('B', 'A', 2, 0, { round: 2 }), aMatch('B', 'A', 2, 0, { round: 3 })];
    const input = { teams: teams('A', 'B'), matches, rules: rulesWith([]) };
    expect(tableOrder({ ...input, throughRound: 1 })).toEqual(['A', 'B']);
    expect(tableOrder({ ...input, throughRound: 2 })).toEqual(['A=B']);
    expect(tableOrder(input)).toEqual(['B', 'A']);
  });

  it('refuses a team listed twice', () => {
    expect(() => computeStandings({ teams: teams('A', 'A'), matches: [], rules: rulesWith([]) })).toThrow(/listed twice/);
  });
});

describe('byes (Swiss)', () => {
  // Round 1: A beat B 2:0, C had a bye (a 2:0 walkover, as the old Swiss engine records it).
  const bye = (team: string, side: 'a' | 'b' = 'a') =>
    side === 'a' ? aMatch(team, null, 2, 0, { status: 'bye' }) : aMatch(null, team, 0, 2, { status: 'bye' });
  const input = { teams: teams('A', 'B', 'C'), matches: [aMatch('A', 'B', 2, 0), bye('C')], rules: SWISS_DEFAULT };

  it('gives the team the walkover: a series played and won, with its games', () => {
    expect(recordOf(input, 'C')).toEqual({ played: 1, wins: 1, draws: 0, losses: 0, gamesWon: 2, gamesLost: 0, points: 2, neustadtl: 0, buchholz: 0 });
  });

  it('counts the bye on either side of the match', () => {
    expect(recordOf({ ...input, matches: [bye('C', 'b')] }, 'C')).toMatchObject({ played: 1, wins: 1, gamesWon: 2 });
  });

  it('adds nothing to Buchholz, so a bye ranks below a real win on equal points', () => {
    expect(recordOf(input, 'C').buchholz).toBe(0);
    // A beat B, B beat D, C had a bye: A, B and C on 2 games won; Buchholz A 2, B 2, C 0.
    const field = { teams: teams('A', 'B', 'C', 'D'), matches: [aMatch('A', 'B', 2, 0), aMatch('B', 'D', 2, 0), bye('C')], rules: SWISS_DEFAULT };
    expect(tableOrder(field)).toEqual(['A', 'B', 'C', 'D']);
    expect(computeStandings(field).rows[1].tiebreakers.map((t) => t.rule)).toEqual(['buchholz', 'match_wins', 'game_difference']);
  });

  it('shows no row for the bye and counts a bye only with status bye', () => {
    const s = computeStandings(input);
    expect(s.rows.map((r) => r.teamId).sort()).toEqual(['A', 'B', 'C']);
    expect(recordOf({ ...input, matches: [aMatch('C', null, 2, 0)] }, 'C').played).toBe(0);
  });
});
