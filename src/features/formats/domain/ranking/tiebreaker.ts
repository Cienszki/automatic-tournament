// The contract every tie-breaker follows, and the helper most of them use.

import type { TeamId } from './types';

/** What one rule says about a set of tied teams. */
export interface TiebreakStep {
  /** The tied teams split into tiers, best first. A tier of more than one team is still tied. */
  tiers: TeamId[][];
  /** The value the rule compared, per team; null when the team has none (no MMR, no tiebreak result). */
  values: ReadonlyMap<TeamId, number | null>;
}

/**
 * One rule of the catalogue. `apply` is pure and sees only the tied teams and the context, so
 * the engine can run it on any subset. Generic over the context so that ranking across groups
 * (WP-34) can bring its own rules and records.
 */
export interface Tiebreaker<C, Id extends string = string> {
  id: Id;
  /** A decision rule waits for the organizer when it cannot order the teams. */
  decision: boolean;
  apply(tied: readonly TeamId[], ctx: C): TiebreakStep;
}

/** Code-unit order of ids: the same on every machine, unlike `localeCompare`. */
export const compareIds = (a: TeamId, b: TeamId): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Splits teams into tiers of equal value. `higher` puts the largest value first; `lower` the
 * smallest. Teams without a value (null) come after every team with one, tied among themselves.
 */
export function tiersByValue(
  teams: readonly TeamId[],
  valueOf: (id: TeamId) => number | null,
  better: 'higher' | 'lower',
): TiebreakStep {
  const values = new Map(teams.map((id) => [id, valueOf(id)] as const));
  const known = [...new Set([...values.values()].filter((v): v is number => v !== null))];
  known.sort((x, y) => (better === 'higher' ? y - x : x - y));
  const tiers = known.map((v) => teams.filter((id) => values.get(id) === v));
  const unknown = teams.filter((id) => values.get(id) === null);
  if (unknown.length) tiers.push(unknown);
  return { tiers, values };
}
