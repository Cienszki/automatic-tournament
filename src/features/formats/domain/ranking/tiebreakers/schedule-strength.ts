// Tie-breakers that measure whom a team played: Neustadtl (Sonneborn-Berger) and Buchholz.
// Both are computed with the record in `records.ts`, because they need every team's final points.

import type { RankingContext } from '../records';
import { tiersByValue, type Tiebreaker } from '../tiebreaker';

/** Points of the opponents a team beat, plus half the points of those it drew with. */
export const neustadtl: Tiebreaker<RankingContext, 'neustadtl'> = {
  id: 'neustadtl',
  decision: false,
  apply: (tied, ctx) => tiersByValue(tied, (team) => ctx.records.get(team)!.neustadtl, 'higher'),
};

/** Points of every opponent faced (once per meeting). A bye adds nothing. */
export const buchholz: Tiebreaker<RankingContext, 'buchholz'> = {
  id: 'buchholz',
  decision: false,
  apply: (tied, ctx) => tiersByValue(tied, (team) => ctx.records.get(team)!.buchholz, 'higher'),
};
