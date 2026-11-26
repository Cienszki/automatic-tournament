// When a bracket match finished (WP-33b). A bracket match has two times: the bracket document's
// `result.completedAt` and its mirror match's `completedAt`. An admin action on 2026-07-25 at 17:46
// rewrote the result of all eleven played Wiosenna bracket matches within 22 seconds, so the
// bracket value there says when someone saved the bracket, not when the match ended (`ub-r1-p1`
// ended 2026-07-12 at 21:43). Pure: no database, no state.
//
// The rule: a bracket time is a bulk rewrite when at least BULK_COUNT bracket matches of the
// tournament (itself included) carry a result time within BULK_WINDOW_MS of it. Then the mirror's
// time is used when the mirror has one. Why a cluster rather than "later than the mirror by more
// than a day": a rewrite is recognized by how it was written (one action touching many documents),
// whatever the lag; a single match whose result an admin entered a day late is left alone, and a
// rewrite minutes after the last game is still caught.

export const BULK_COUNT = 3;
export const BULK_WINDOW_MS = 10 * 60 * 1000;

export interface CompletionChoice {
  value: Date | null;
  /** The bracket time was a bulk rewrite and the mirror's time is used. */
  fromMirror: boolean;
  /** How many bracket result times fall in the window around this one. */
  cluster: number;
}

export function bracketCompletion(bracket: Date | null, mirror: Date | null, allBracketTimes: readonly Date[]): CompletionChoice {
  if (!bracket) return { value: mirror, fromMirror: false, cluster: 0 };
  const cluster = allBracketTimes.filter((t) => Math.abs(t.getTime() - bracket.getTime()) <= BULK_WINDOW_MS).length;
  if (mirror && cluster >= BULK_COUNT && mirror.getTime() !== bracket.getTime()) return { value: mirror, fromMirror: true, cluster };
  return { value: bracket, fromMirror: false, cluster };
}
