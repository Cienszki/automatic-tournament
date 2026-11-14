// What a series result means for a table: whether it counts, and who won it.

import type { StandingsMatch } from './ranking/types';

export type SeriesOutcome = 'a' | 'b' | 'draw';

/** Kinds whose results count in tables: ordinary matches, and rematches in place of the match they replay. */
const COUNTING_KINDS: ReadonlySet<StandingsMatch['kind']> = new Set(['regular', 'rematch']);

/**
 * Does this match's result count in the table? Only a played result (status `completed`, or a
 * `bye` walkover) of an ordinary match or a rematch. A tiebreak match orders tied teams through
 * the `tiebreak_match` rule and adds no points; showmatches and other extra matches, `void`
 * matches and matches replaced by a rematch count nowhere.
 */
export function countsForStandings(m: StandingsMatch): boolean {
  if (m.replaced || !COUNTING_KINDS.has(m.kind)) return false;
  return hasResult(m);
}

/** A played series with a score: completed, or a bye walkover. */
export function hasResult(m: StandingsMatch): boolean {
  if (m.status !== 'completed' && m.status !== 'bye') return false;
  return m.scoreA !== null && m.scoreB !== null;
}

/** Equal series scores are a draw (a 1-1 best of two). */
export function seriesOutcome(scoreA: number, scoreB: number): SeriesOutcome {
  if (scoreA > scoreB) return 'a';
  if (scoreB > scoreA) return 'b';
  return 'draw';
}
