import { describe, expect, it } from 'vitest';
import { computeStandings } from '../../standings';
import { aMatch, aTeam, rulesWith, tableOrder, teams } from '../../testing/builders';
import { TIEBREAKER_IDS } from '../schema';
import { TIEBREAKERS } from './catalogue';

describe('the catalogue', () => {
  it('has an implementation for every tie-breaker id, under its own id', () => {
    for (const id of TIEBREAKER_IDS) expect(TIEBREAKERS[id].id).toBe(id);
  });

  it('marks exactly tiebreak_match and manual as decision rules', () => {
    const decisions = TIEBREAKER_IDS.filter((id) => TIEBREAKERS[id].decision);
    expect(decisions).toEqual(['tiebreak_match', 'manual']);
  });
});

// X, Y and Z end on 5 points. Among themselves: X beat Y, Y drew Z, Z beat X.
// Mini-table: Z 3, X 2, Y 1. Head-to-head wins: X 1 (beat Y), Z 1 (beat X), Y 0.
const threeWay = {
  teams: teams('X', 'Y', 'Z', 'P', 'Q'),
  matches: [
    aMatch('X', 'Y', 2, 0), aMatch('Y', 'Z', 1, 1), aMatch('Z', 'X', 2, 0),
    aMatch('X', 'P', 2, 0), aMatch('X', 'Q', 1, 1),
    aMatch('Y', 'P', 2, 0), aMatch('Y', 'Q', 2, 0),
    aMatch('Z', 'P', 1, 1), aMatch('Z', 'Q', 1, 1),
  ],
};

// A, B, C and D end on 7 points. Their mini-table: A 5, C 3, D 3, B 1; C beat D.
// Head-to-head wins among the four: A 2, C 1, D 1, B 0.
const fourWay = {
  teams: teams('A', 'B', 'C', 'D', 'P', 'Q', 'R'),
  matches: [
    aMatch('A', 'B', 2, 0), aMatch('A', 'C', 2, 0), aMatch('A', 'D', 1, 1),
    aMatch('B', 'C', 1, 1), aMatch('D', 'B', 2, 0), aMatch('C', 'D', 2, 0),
    aMatch('B', 'P', 2, 0), aMatch('B', 'Q', 2, 0), aMatch('B', 'R', 2, 0),
    aMatch('A', 'P', 2, 0), aMatch('C', 'Q', 2, 0), aMatch('C', 'R', 2, 0),
    aMatch('D', 'P', 2, 0), aMatch('D', 'Q', 2, 0),
  ],
};

describe('head_to_head', () => {
  it('orders a three-way tie by the mini-table among the tied teams', () => {
    expect(tableOrder({ ...threeWay, rules: rulesWith(['head_to_head']) })).toEqual(['Z', 'X', 'Y', 'Q', 'P']);
  });

  it('builds the mini-table again among teams the first mini-table left level', () => {
    expect(tableOrder({ ...fourWay, rules: rulesWith(['head_to_head']) })).toEqual(['A', 'C', 'D', 'B', 'P=Q=R']);
  });

  it('reports the first mini-table points as the value', () => {
    const { rows } = computeStandings({ ...fourWay, rules: rulesWith(['head_to_head']) });
    const value = (id: string) => rows.find((r) => r.teamId === id)!.tiebreakers;
    expect(value('C')).toEqual([{ rule: 'head_to_head', value: 3 }]);
    expect(value('B')).toEqual([{ rule: 'head_to_head', value: 1 }]);
  });

  it('scores the mini-table with the stage points (games won in Swiss)', () => {
    // 2/1/0: A beat B 2:1, B beat A 2:0, one series each: level.
    const twoLegs = { teams: teams('A', 'B'), matches: [aMatch('A', 'B', 2, 1), aMatch('B', 'A', 2, 0)] };
    expect(tableOrder({ ...twoLegs, rules: rulesWith(['head_to_head']) })).toEqual(['A=B']);
    // Games won: the same two series plus A 1:1 C put A and B on 3; between them B won 3 games, A 2.
    const swiss = { teams: teams('A', 'B', 'C'), matches: [...twoLegs.matches, aMatch('A', 'C', 1, 1)] };
    expect(tableOrder({ ...swiss, rules: { points: 'games_won', tiebreakers: ['head_to_head'] } })).toEqual(['B', 'A', 'C']);
  });
});

describe('head_to_head_wins (the old site rule)', () => {
  it('counts tied rivals beaten, so a three-way tie can stay partly level', () => {
    expect(tableOrder({ ...threeWay, rules: rulesWith(['head_to_head_wins']) })).toEqual(['X=Z', 'Y', 'Q', 'P']);
  });

  it('does not build a second mini-table among teams it left level', () => {
    expect(tableOrder({ ...fourWay, rules: rulesWith(['head_to_head_wins']) })).toEqual(['A', 'C=D', 'B', 'P=Q=R']);
  });

  it('leaves a later rule to separate what it left level', () => {
    // Neustadtl: X beat Y (5) and P (1), drew Q (2 / 2) = 7; Z beat X (5), drew Y, P, Q (2.5 + 0.5 + 1) = 9.
    expect(tableOrder({ ...threeWay, rules: rulesWith(['head_to_head_wins', 'neustadtl']) })).toEqual(['Z', 'X', 'Y', 'Q', 'P']);
  });

  it('counts a rival beaten more often than lost to, and ignores draws', () => {
    // A beat B twice and lost once; they drew once. B also beat C. A and B end on 5.
    const input = {
      teams: teams('A', 'B', 'C'),
      matches: [aMatch('A', 'B', 2, 0), aMatch('A', 'B', 2, 0), aMatch('B', 'A', 2, 0), aMatch('A', 'B', 1, 1), aMatch('B', 'C', 2, 0)],
    };
    const { rows } = computeStandings({ ...input, rules: rulesWith(['head_to_head_wins']) });
    expect(rows.map((r) => [r.teamId, r.record.points, r.tiebreakers[0]?.value])).toEqual([['A', 5, 1], ['B', 5, 0], ['C', 0, undefined]]);
  });
});

describe('game_difference and games_won', () => {
  // All four on 2 points. A: 2:1 win, 1:2 loss (3:3). B: 2:0 win, 0:2 loss (2:2). C: 2:0 win, 1:2 loss (3:2).
  const input = {
    teams: teams('A', 'B', 'C', 'D', 'E', 'F', 'G'),
    matches: [
      aMatch('A', 'E', 2, 1), aMatch('A', 'F', 1, 2),
      aMatch('B', 'E', 2, 0), aMatch('B', 'G', 0, 2),
      aMatch('C', 'E', 2, 0), aMatch('C', 'D', 1, 2),
    ],
  };

  it('game_difference: games won minus games lost', () => {
    // D 2:1 win only (+1); C +1; A 0; B 0. F and G 2 points as well: F 2:1 (+1), G 2:0 (+2).
    expect(tableOrder({ ...input, rules: rulesWith(['game_difference']) })).toEqual(['G', 'C=D=F', 'A=B', 'E']);
  });

  it('games_won: separates teams that game difference leaves level', () => {
    expect(tableOrder({ ...input, rules: rulesWith(['game_difference', 'games_won']) })).toEqual(['G', 'C', 'D=F', 'A', 'B', 'E']);
  });
});

describe('match_wins', () => {
  it('puts the team with more series won ahead on equal games won (Swiss)', () => {
    // A: 2:0 and 0:2 = 2 games, one series won. B: 1:1 twice = 2 games, none won.
    const input = {
      teams: teams('A', 'B', 'C', 'D', 'E', 'F'),
      matches: [aMatch('A', 'C', 2, 0), aMatch('A', 'D', 0, 2), aMatch('B', 'E', 1, 1), aMatch('B', 'F', 1, 1)],
      rules: { points: 'games_won' as const, tiebreakers: ['match_wins' as const] },
    };
    // D won its only series 2:0, so it is level with A on games and series.
    expect(tableOrder(input)).toEqual(['A=D', 'B', 'E=F', 'C']);
  });
});

describe('neustadtl and buchholz', () => {
  // A beat S (strong, 4 points), B beat W (weak, 0 points); A and B lost one each.
  const input = {
    teams: teams('A', 'B', 'S', 'W', 'K', 'L'),
    matches: [
      aMatch('A', 'S', 2, 0), aMatch('B', 'W', 2, 0),
      aMatch('K', 'A', 2, 0), aMatch('L', 'B', 2, 0),
      aMatch('S', 'K', 2, 0), aMatch('S', 'L', 2, 0),
    ],
  };

  it('neustadtl: points of the beaten opponents count', () => {
    const { rows } = computeStandings({ ...input, rules: rulesWith(['neustadtl']) });
    const n = Object.fromEntries(rows.map((r) => [r.teamId, r.record.neustadtl]));
    expect(n).toMatchObject({ A: 4, B: 0, S: 4, K: 2, L: 2 });
    expect(tableOrder({ ...input, rules: rulesWith(['neustadtl']) })).toEqual(['S', 'A', 'K=L', 'B', 'W']);
  });

  it('neustadtl: a draw counts half the opponent points', () => {
    const { rows } = computeStandings({ teams: teams('A', 'B', 'C'), matches: [aMatch('A', 'B', 1, 1), aMatch('B', 'C', 2, 0)], rules: rulesWith([]) });
    expect(rows.find((r) => r.teamId === 'A')!.record.neustadtl).toBe(1.5);
  });

  it('buchholz: points of every opponent faced', () => {
    const { rows } = computeStandings({ ...input, rules: rulesWith(['buchholz']) });
    const b = Object.fromEntries(rows.map((r) => [r.teamId, r.record.buchholz]));
    // A faced S (4) and K (2); B faced W (0) and L (2); K and L faced S (4) and a 2-point team.
    expect(b).toMatchObject({ A: 6, B: 2, K: 6, L: 6, S: 6, W: 2 });
    expect(tableOrder({ ...input, rules: rulesWith(['buchholz']) })).toEqual(['S', 'A=K=L', 'B', 'W']);
  });
});

describe('lower_mmr', () => {
  it('puts the lower total MMR ahead and an unknown MMR after every known one', () => {
    const input = {
      teams: [aTeam('A', { mmr: 20000 }), aTeam('B', { mmr: 18000 }), aTeam('C'), aTeam('D'), aTeam('E', { mmr: 18000 })],
      matches: [],
      rules: rulesWith(['lower_mmr']),
    };
    expect(tableOrder(input)).toEqual(['B=E', 'A', 'C=D']);
    const { rows } = computeStandings(input);
    expect(rows.find((r) => r.teamId === 'C')!.tiebreakers).toEqual([{ rule: 'lower_mmr', value: null }]);
  });
});
