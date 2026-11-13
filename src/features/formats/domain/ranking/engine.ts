// Applies an ordered list of tie-breakers to tied teams. Each rule splits a tied set into tiers;
// every tier still tied goes on to the next rule, alone. So a rule only ever orders teams that
// all earlier rules left level, and never reorders teams an earlier rule separated.

import { compareIds, type Tiebreaker } from './tiebreaker';
import type { TeamId } from './types';

export interface RankedTier<Id extends string = string> {
  /** One team, or several that share a place (in team id order). */
  teamIds: TeamId[];
  /** Decision rules reached that could not order this tier. Empty for a decided tier. */
  awaiting: Id[];
}

export interface TieValue<Id extends string = string> {
  rule: Id;
  value: number | null;
}

export interface OrderedTeams<Id extends string = string> {
  tiers: RankedTier<Id>[];
  /** Per team, the rules applied to its tie, in order, with its value. */
  values: Map<TeamId, TieValue<Id>[]>;
}

export interface OrderOptions {
  /** Whether a tie over these places decides something; decision rules open no tie otherwise. */
  isDecisive?: (places: { first: number; last: number }) => boolean;
}

/**
 * Orders `groups` (already ordered, best first; each group a set of teams level so far) with
 * `rules`. Used by the standings with the stage's points as the first split; usable with other
 * contexts, such as teams from different groups (WP-34).
 */
export function orderTeams<C, Id extends string>(
  groups: readonly (readonly TeamId[])[],
  rules: readonly Tiebreaker<C, Id>[],
  ctx: C,
  options: OrderOptions = {},
): OrderedTeams<Id> {
  const values = new Map<TeamId, TieValue<Id>[]>();
  const decisive = (first: number, size: number) => !options.isDecisive || options.isDecisive({ first, last: first + size - 1 });

  const resolve = (tied: readonly TeamId[], ruleIndex: number, firstPlace: number, awaiting: Id[]): RankedTier<Id>[] => {
    if (tied.length === 1) return [{ teamIds: [...tied], awaiting: [] }];
    if (ruleIndex === rules.length) return [{ teamIds: [...tied].sort(compareIds), awaiting }];
    const rule = rules[ruleIndex];
    const step = rule.apply(tied, ctx);
    for (const id of tied) {
      const list = values.get(id) ?? [];
      list.push({ rule: rule.id, value: step.values.get(id) ?? null });
      values.set(id, list);
    }
    const out: RankedTier<Id>[] = [];
    let place = firstPlace;
    for (const tier of step.tiers) {
      const waits = rule.decision && tier.length > 1 && decisive(place, tier.length);
      out.push(...resolve(tier, ruleIndex + 1, place, waits ? [...awaiting, rule.id] : awaiting));
      place += tier.length;
    }
    return out;
  };

  const tiers: RankedTier<Id>[] = [];
  let place = 1;
  for (const group of groups) {
    tiers.push(...resolve(group, 0, place, []));
    place += group.length;
  }
  return { tiers, values };
}
