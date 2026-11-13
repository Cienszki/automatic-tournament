import { describe, expect, it } from 'vitest';
import { computeStandings } from '../../standings';
import { aMatch, rulesWith, tableOrder, teams } from '../../testing/builders';
import type { ManualOrder } from '../schema';

// A, B and C level on 2 points (each beat D); D on 0.
const level = {
  teams: teams('A', 'B', 'C', 'D'),
  matches: [aMatch('A', 'D', 2, 0), aMatch('B', 'D', 2, 0), aMatch('C', 'D', 2, 0)],
};
const tiebreak = (a: string, b: string, scoreA: number | null, scoreB: number | null, status: 'completed' | 'scheduled' = 'completed') =>
  aMatch(a, b, scoreA ?? 0, scoreB ?? 0, { kind: 'tiebreak', status, scoreA, scoreB });

const order = (teamsInTie: string[], by: string[]): ManualOrder => ({ teams: teamsInTie, order: by, reason: 'Decyzja organizatora', by: 'user-1', at: '2026-11-13T12:00:00Z' });

describe('tiebreak_match', () => {
  const rules = rulesWith(['tiebreak_match']);

  it('opens the tie when no tiebreaker match exists', () => {
    const s = computeStandings({ ...level, rules });
    expect(s.openTies).toEqual([{ teamIds: ['A', 'B', 'C'], awaiting: ['tiebreak_match'], places: { first: 1, last: 3 } }]);
    expect(s.rows.slice(0, 3).every((r) => r.place === 1 && r.sharedPlace && r.openTie === s.openTies[0])).toBe(true);
    expect(s.rows[3]).toMatchObject({ teamId: 'D', place: 4, sharedPlace: false });
    expect(s.rows[3].openTie).toBeUndefined();
  });

  it('keeps the tie open while one of the tiebreaker matches is not played', () => {
    const matches = [...level.matches, tiebreak('A', 'B', 2, 0), tiebreak('B', 'C', 2, 0), tiebreak('A', 'C', null, null, 'scheduled')];
    expect(computeStandings({ ...level, matches, rules }).openTies).toHaveLength(1);
  });

  it('keeps the tie open when a tied team has not played a tiebreaker match', () => {
    const matches = [...level.matches, tiebreak('A', 'B', 1, 0)];
    expect(computeStandings({ ...level, matches, rules }).openTies[0].teamIds).toEqual(['A', 'B', 'C']);
  });

  it('orders a three-way tie by the played tiebreaker round robin, and adds no points', () => {
    const matches = [...level.matches, tiebreak('C', 'A', 1, 0), tiebreak('C', 'B', 1, 0), tiebreak('A', 'B', 1, 0)];
    const s = computeStandings({ ...level, matches, rules });
    expect(tableOrder({ ...level, matches, rules })).toEqual(['C', 'A', 'B', 'D']);
    expect(s.openTies).toEqual([]);
    expect(s.rows.map((r) => r.record.points)).toEqual([2, 2, 2, 0]);
    expect(s.rows.map((r) => r.record.played)).toEqual([1, 1, 1, 3]);
  });

  it('opens a smaller tie when the tiebreaker matches leave two teams level', () => {
    const matches = [...level.matches, tiebreak('A', 'B', 1, 0), tiebreak('A', 'C', 1, 0), tiebreak('B', 'C', 1, 1)];
    const s = computeStandings({ ...level, matches, rules });
    expect(tableOrder({ ...level, matches, rules })).toEqual(['A', 'B=C', 'D']);
    expect(s.openTies).toEqual([{ teamIds: ['B', 'C'], awaiting: ['tiebreak_match'], places: { first: 2, last: 3 } }]);
  });

  it('ignores tiebreaker matches against a team outside the tie', () => {
    const matches = [...level.matches, tiebreak('A', 'D', 1, 0)];
    expect(computeStandings({ ...level, matches, rules }).openTies[0].teamIds).toEqual(['A', 'B', 'C']);
  });

  it('opens no tie over places that decide nothing when the rules say so', () => {
    const onlyDecisive = rulesWith(['tiebreak_match'], { tiebreakOnlyWhenDecisive: true });
    const topOneQualifies = ({ first }: { first: number }) => first <= 1;
    const field = { teams: teams('A', 'B', 'C', 'D', 'E'), matches: [aMatch('A', 'E', 2, 0), aMatch('A', 'D', 2, 0), aMatch('B', 'E', 2, 0), aMatch('C', 'E', 2, 0)] };
    // A on 4, B and C level on 2 for places 2 and 3: nothing depends on their order.
    const s = computeStandings({ ...field, rules: onlyDecisive, isDecisive: topOneQualifies });
    expect(s.openTies).toEqual([]);
    expect(tableOrder({ ...field, rules: onlyDecisive, isDecisive: topOneQualifies })).toEqual(['A', 'B=C', 'D=E']);
    // Without the option, or without the predicate, every tie counts as decisive.
    expect(computeStandings({ ...field, rules: rulesWith(['tiebreak_match']), isDecisive: topOneQualifies }).openTies).toHaveLength(2);
    expect(computeStandings({ ...field, rules: onlyDecisive }).openTies).toHaveLength(2);
  });
});

describe('manual', () => {
  it('opens the tie until the organizer sets an order', () => {
    expect(computeStandings({ ...level, rules: rulesWith(['manual']) }).openTies[0].awaiting).toEqual(['manual']);
  });

  it('applies the order set for exactly the tied teams, with the position as the value', () => {
    const rules = rulesWith(['manual'], { manualOrders: [order(['C', 'B', 'A'], ['B', 'C', 'A'])] });
    const s = computeStandings({ ...level, rules });
    expect(s.rows.map((r) => r.teamId)).toEqual(['B', 'C', 'A', 'D']);
    expect(s.rows.map((r) => r.tiebreakers)).toEqual([
      [{ rule: 'manual', value: 1 }], [{ rule: 'manual', value: 2 }], [{ rule: 'manual', value: 3 }], [],
    ]);
    expect(s.openTies).toEqual([]);
  });

  it('does not apply an order made for a different set of teams', () => {
    const rules = rulesWith(['manual'], { manualOrders: [order(['A', 'B'], ['B', 'A']), order(['A', 'B', 'C', 'D'], ['D', 'C', 'B', 'A'])] });
    expect(computeStandings({ ...level, rules }).openTies[0].teamIds).toEqual(['A', 'B', 'C']);
  });

  it('settles a tie the tiebreaker matches could not, and the tie is no longer open', () => {
    const rules = rulesWith(['tiebreak_match', 'manual'], { manualOrders: [order(['A', 'B', 'C'], ['C', 'A', 'B'])] });
    const s = computeStandings({ ...level, rules });
    expect(s.rows.map((r) => r.teamId)).toEqual(['C', 'A', 'B', 'D']);
    expect(s.openTies).toEqual([]);
    expect(s.rows[0].tiebreakers).toEqual([{ rule: 'tiebreak_match', value: null }, { rule: 'manual', value: 1 }]);
  });

  it('lists both decision rules while neither has decided', () => {
    const s = computeStandings({ ...level, rules: rulesWith(['tiebreak_match', 'manual']) });
    expect(s.openTies[0].awaiting).toEqual(['tiebreak_match', 'manual']);
  });
});

describe('automatic rules before a decision rule', () => {
  it('hand the decision rule only the teams they left level', () => {
    // A, B and C on 4. Among them A beat B and C, and B drew C; E drew B and C; D lost to both.
    const input = {
      teams: teams('A', 'B', 'C', 'D', 'E'),
      matches: [
        aMatch('A', 'B', 2, 0), aMatch('A', 'C', 2, 0), aMatch('B', 'C', 1, 1),
        aMatch('B', 'D', 2, 0), aMatch('B', 'E', 1, 1), aMatch('C', 'D', 2, 0), aMatch('C', 'E', 1, 1),
      ],
      rules: rulesWith(['head_to_head', 'tiebreak_match']),
    };
    expect(tableOrder(input)).toEqual(['A', 'B=C', 'E', 'D']);
    expect(computeStandings(input).openTies).toEqual([{ teamIds: ['B', 'C'], awaiting: ['tiebreak_match'], places: { first: 2, last: 3 } }]);
  });
});
