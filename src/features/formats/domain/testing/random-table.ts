// Seeded random tables for the property tests. Only tests import this file. Fixed seeds keep
// every run identical (CONVENTIONS.md section 10); a failing seed is printed by the test.

import { AUTOMATIC_TIEBREAKERS, DECISION_TIEBREAKERS, rankingRulesSchema, type RankingRules, type TiebreakerId } from '../ranking/schema';
import type { MatchKind, MatchStatus, StandingsInput, StandingsMatch, StandingsTeam } from '../ranking/types';

export type Random = () => number;

/** mulberry32: a small, fast generator with a 32-bit state. */
export function seeded(seed: number): Random {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const int = (rnd: Random, min: number, max: number) => min + Math.floor(rnd() * (max - min + 1));
export const pick = <T>(rnd: Random, items: readonly T[]): T => items[int(rnd, 0, items.length - 1)];

export function shuffle<T>(rnd: Random, items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = int(rnd, 0, i);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Short series scores, so that many teams end level and the tie-breakers have work to do.
const SCORES: ReadonlyArray<[number, number]> = [[2, 0], [0, 2], [1, 1], [2, 1], [1, 2], [1, 0], [0, 1], [0, 0]];
const KINDS: readonly MatchKind[] = ['regular', 'regular', 'regular', 'regular', 'rematch', 'tiebreak', 'showmatch', 'other'];
const STATUSES: readonly MatchStatus[] = ['completed', 'completed', 'completed', 'completed', 'scheduled', 'live', 'void'];

function randomTeams(rnd: Random): StandingsTeam[] {
  const count = int(rnd, 2, 9);
  const ids = new Set<string>();
  // Mixed-case ids, so an order that depended on locale rules would show.
  while (ids.size < count) ids.add(pick(rnd, ['a', 'B', 'c', 'D', 'e', 'F']) + int(rnd, 0, 20));
  return [...ids].map((id) => ({ id, name: `Team ${id}`, ...(rnd() < 0.8 ? { mmr: int(rnd, 3, 6) * 1000 } : {}) }));
}

function randomMatch(rnd: Random, ids: string[], n: number): StandingsMatch {
  const [scoreA, scoreB] = pick(rnd, SCORES);
  if (rnd() < 0.06) {
    return { id: `m${n}`, teamAId: pick(rnd, ids), teamBId: null, scoreA: 2, scoreB: 0, status: 'bye', kind: 'regular', replaced: false, round: int(rnd, 1, 4) };
  }
  const [a, b] = shuffle(rnd, ids);
  return {
    id: `m${n}`,
    // Now and then a team from outside the table, which must count for neither side.
    teamAId: rnd() < 0.03 ? 'outsider' : a,
    teamBId: b,
    scoreA, scoreB,
    status: pick(rnd, STATUSES),
    kind: pick(rnd, KINDS),
    replaced: rnd() < 0.05,
    round: int(rnd, 1, 4),
  };
}

export function randomRules(rnd: Random): RankingRules {
  const automatic = shuffle(rnd, AUTOMATIC_TIEBREAKERS).slice(0, int(rnd, 0, AUTOMATIC_TIEBREAKERS.length));
  const decisions = rnd() < 0.4 ? shuffle(rnd, DECISION_TIEBREAKERS).slice(0, int(rnd, 1, 2)) : [];
  const points = rnd() < 0.3 ? ('games_won' as const) : pick(rnd, [{ win: 2, draw: 1, loss: 0 }, { win: 3, draw: 1, loss: 0 }]);
  const tiebreakers: TiebreakerId[] = [...automatic, ...decisions];
  return rankingRulesSchema.parse({ points, tiebreakers });
}

export function randomInput(rnd: Random): StandingsInput {
  const teams = randomTeams(rnd);
  const ids = teams.map((t) => t.id);
  const matches = Array.from({ length: int(rnd, 0, teams.length * 3) }, (_, i) => randomMatch(rnd, ids, i));
  return { teams, matches, rules: randomRules(rnd) };
}
