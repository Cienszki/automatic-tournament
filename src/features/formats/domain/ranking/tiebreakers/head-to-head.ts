// Tie-breakers from the results between the tied teams themselves.

import { seriesOutcome } from '../../series';
import { pointsFor, type PlayedSeries, type RankingContext } from '../records';
import type { PointsRule } from '../schema';
import { tiersByValue, type Tiebreaker, type TiebreakStep } from '../tiebreaker';
import type { TeamId } from '../types';

/** A table of only the series between the given teams, scored with the stage's points rule. */
export function miniTable(teams: readonly TeamId[], results: readonly PlayedSeries[], rule: PointsRule): TiebreakStep {
  const points = new Map(teams.map((id) => [id, 0]));
  for (const r of results) {
    if (!points.has(r.teamAId) || !points.has(r.teamBId)) continue;
    points.set(r.teamAId, points.get(r.teamAId)! + pointsFor(rule, r.scoreA, r.scoreB));
    points.set(r.teamBId, points.get(r.teamBId)! + pointsFor(rule, r.scoreB, r.scoreA));
  }
  return tiersByValue(teams, (id) => points.get(id)!, 'higher');
}

/**
 * Head-to-head: a mini-table of the series among the tied teams. When it splits off some teams
 * but leaves a smaller group level, the mini-table is built again among that group alone (as in
 * UEFA's rules), before any later rule is used. The values are those of the first mini-table.
 */
export const headToHead: Tiebreaker<RankingContext, 'head_to_head'> = {
  id: 'head_to_head',
  decision: false,
  apply(tied, ctx) {
    const first = miniTable(tied, ctx.results, ctx.rules.points);
    const tiers = first.tiers.flatMap((t) => (t.length > 1 && t.length < tied.length ? headToHead.apply(t, ctx).tiers : [t]));
    return { tiers, values: first.values };
  },
};

/**
 * Today's rule on the old site, kept so published tables do not change: for each tied team, the
 * number of other tied teams it has more series wins against than losses. It is not a mini-table:
 * with three or more tied teams, a team that beat one rival and lost twice to another counts one,
 * the same as a team that beat one and drew the other.
 */
export const headToHeadWins: Tiebreaker<RankingContext, 'head_to_head_wins'> = {
  id: 'head_to_head_wins',
  decision: false,
  apply(tied, ctx) {
    const set = new Set(tied);
    const wins = new Map<string, number>();
    const key = (winner: TeamId, loser: TeamId) => `${winner}\u0000${loser}`;
    for (const r of ctx.results) {
      if (!set.has(r.teamAId) || !set.has(r.teamBId)) continue;
      const outcome = seriesOutcome(r.scoreA, r.scoreB);
      if (outcome === 'draw') continue;
      const k = outcome === 'a' ? key(r.teamAId, r.teamBId) : key(r.teamBId, r.teamAId);
      wins.set(k, (wins.get(k) ?? 0) + 1);
    }
    const count = (x: TeamId, y: TeamId) => wins.get(key(x, y)) ?? 0;
    const value = (team: TeamId) => tied.filter((o) => o !== team && count(team, o) > count(o, team)).length;
    return tiersByValue(tied, value, 'higher');
  },
};
