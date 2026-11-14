// Decision tie-breakers: they order teams only once the organizer has acted. Until then the
// engine reports the tie as open (ADR-11: nothing is decided silently).

import { hasResult } from '../../series';
import type { RankingContext } from '../records';
import type { Tiebreaker, TiebreakStep } from '../tiebreaker';
import type { TeamId } from '../types';
import { miniTable } from './head-to-head';

const undecided = (tied: readonly TeamId[]): TiebreakStep => ({
  tiers: [[...tied]],
  values: new Map(tied.map((id) => [id, null])),
});

/**
 * Tiebreaker matches among the tied teams, scored as a mini-table with the stage's points rule.
 * They decide only when every one of them has a result and every tied team played in one;
 * until then the teams stay tied, so a half-played set of matches orders nobody.
 */
export const tiebreakMatch: Tiebreaker<RankingContext, 'tiebreak_match'> = {
  id: 'tiebreak_match',
  decision: true,
  apply(tied, ctx) {
    const set = new Set(tied);
    const among = ctx.tiebreaks.filter((m) => set.has(m.teamAId!) && set.has(m.teamBId!));
    const played = new Set(among.flatMap((m) => [m.teamAId!, m.teamBId!]));
    if (among.length === 0 || !among.every(hasResult) || played.size !== tied.length) return undecided(tied);
    const results = among.map((m) => ({ teamAId: m.teamAId!, teamBId: m.teamBId!, scoreA: m.scoreA!, scoreB: m.scoreB! }));
    return miniTable(tied, results, ctx.rules.points);
  },
};

/**
 * An order the organizer set by hand, with a reason (stored in `rules.manualOrders` and the
 * audit log). It applies only to exactly the set of teams it was made for, so a decision about
 * one tie never settles a different tie after results change.
 */
export const manual: Tiebreaker<RankingContext, 'manual'> = {
  id: 'manual',
  decision: true,
  apply(tied, ctx) {
    const set = new Set(tied);
    const decision = (ctx.rules.manualOrders ?? []).find(
      (d) => d.teams.length === tied.length && d.teams.every((id) => set.has(id)),
    );
    if (!decision) return undecided(tied);
    return {
      tiers: decision.order.map((id) => [id]),
      values: new Map(decision.order.map((id, i) => [id, i + 1])),
    };
  },
};
