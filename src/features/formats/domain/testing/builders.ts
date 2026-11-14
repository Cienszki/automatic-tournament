// Test builders for standings inputs. Only tests import this file.

import { ROUND_ROBIN_DEFAULT } from '../ranking/defaults';
import type { RankingRules, TiebreakerId } from '../ranking/schema';
import type { StandingsMatch, StandingsTeam } from '../ranking/types';
import { computeStandings } from '../standings';

export const aTeam = (id: string, extra: Partial<StandingsTeam> = {}): StandingsTeam => ({ id, name: `Team ${id}`, ...extra });

export const teams = (...ids: string[]): StandingsTeam[] => ids.map((id) => aTeam(id));

let nextMatch = 0;

/** A completed regular series `a` scoreA:scoreB `b`. */
export function aMatch(a: string | null, b: string | null, scoreA: number, scoreB: number, extra: Partial<StandingsMatch> = {}): StandingsMatch {
  nextMatch += 1;
  return { id: `m${nextMatch}`, teamAId: a, teamBId: b, scoreA, scoreB, status: 'completed', kind: 'regular', replaced: false, round: 1, ...extra };
}

/** Rules with 2/1/0 points (unless given) and the listed tie-breakers. */
export const rulesWith = (tiebreakers: TiebreakerId[], extra: Partial<RankingRules> = {}): RankingRules => ({
  points: ROUND_ROBIN_DEFAULT.points,
  tiebreakers,
  ...extra,
});

/** The team ids in table order, with teams sharing a place joined by `=`: `['A', 'B=C', 'D']`. */
export function tableOrder(input: Parameters<typeof computeStandings>[0]): string[] {
  const { rows } = computeStandings(input);
  const out: string[] = [];
  for (let i = 0; i < rows.length; i++) {
    if (i > 0 && rows[i].place === rows[i - 1].place) out[out.length - 1] += `=${rows[i].teamId}`;
    else out.push(rows[i].teamId);
  }
  return out;
}
