// When a bracket match finished (WP-33b). A bracket match has two times: the bracket document's
// `result.completedAt` and its mirror match's `completedAt`. An admin action on 2026-07-25 at 17:46
// rewrote the result of the ten played Wiosenna bracket matches before the final within 22
// seconds, so there the bracket value says when someone saved the bracket, not when the match
// ended. The mirror's time is not always the end either: it is often a later re-sync (Wiosenna
// U2B's last game ended 19 July about 20:37, its mirror says 20 July 10:50). Pure: no database.
//
// The rule:
//   1. A bracket time is a bulk rewrite when at least BULK_COUNT played bracket matches of the
//      tournament (itself included; byes left out, their times are set by the bracket's own
//      bookkeeping) carry a result time within BULK_WINDOW_MS of it.
//   2. Only then may the mirror's time replace it, and only when the mirror's time is earlier
//      (a bracket time is never replaced by a later one) and not before the end of the match's
//      last game (its start plus its duration where known): the earliest time that can be true.
// Why a cluster rather than "later than the mirror by more than a day": a rewrite is recognized by
// how it was written (one action touching many documents), whatever the lag. Matches played in
// parallel whose results were saved within minutes form a cluster too; they keep their times,
// because their mirrors are not earlier than them.

export const BULK_COUNT = 3;
export const BULK_WINDOW_MS = 10 * 60 * 1000;

export interface CompletionChoice {
  value: Date | null;
  /** The bracket time was a bulk rewrite and the mirror's earlier time is used. */
  fromMirror: boolean;
  /** How many played bracket result times fall in the window around this one. */
  cluster: number;
}

/**
 * @param playedTimes the result times of the tournament's played bracket matches (no byes)
 * @param lastGameEnd when the match's last game ended (or started, without a duration); null when unknown
 */
export function bracketCompletion(bracket: Date | null, mirror: Date | null, playedTimes: readonly Date[], lastGameEnd: Date | null = null): CompletionChoice {
  if (!bracket) return { value: mirror, fromMirror: false, cluster: 0 };
  const cluster = playedTimes.filter((t) => Math.abs(t.getTime() - bracket.getTime()) <= BULK_WINDOW_MS).length;
  const usable = mirror && mirror < bracket && (!lastGameEnd || mirror >= lastGameEnd);
  if (cluster >= BULK_COUNT && usable) return { value: mirror, fromMirror: true, cluster };
  return { value: bracket, fromMirror: false, cluster };
}
