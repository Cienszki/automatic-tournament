import type { GameRow } from './game-row';

export const DAY_SECONDS = 86_400;
const HOUR_SECONDS = 3_600;

/** Start of the newest stored game, or null for an empty history */
export function newestStart(rows: readonly GameRow[]): number | null {
  let newest: number | null = null;
  for (const r of rows) if (newest === null || r[1] > newest) newest = r[1];
  return newest;
}

/**
 * The value for OpenDota's `date` filter ("games of the last N days") that covers everything
 * since the newest stored game, or null when there is nothing stored and the whole history must
 * be downloaded. OpenDota counts whole days back from its own clock, so a game near the boundary
 * could fall outside an exact window; the overlap day covers it and the merge drops the repeats.
 */
export function historyWindowDays(newest: number | null, nowUnix: number, overlapDays = 1): number | null {
  if (newest === null) return null;
  const days = Math.ceil(Math.max(0, nowUnix - newest) / DAY_SECONDS);
  return Math.max(1, days + overlapDays);
}

export interface UpdatePolicy {
  /** Never fetch an account again sooner than this */
  minIntervalSeconds: number;
  /** Fetch again once the stored history is this old */
  maxAgeSeconds: number;
  /** Fetch the players of a scheduled match when it starts within this window */
  beforeMatchSeconds: number;
}

export const DEFAULT_UPDATE_POLICY: UpdatePolicy = {
  minIntervalSeconds: 3 * HOUR_SECONDS,
  maxAgeSeconds: 2 * DAY_SECONDS,
  beforeMatchSeconds: DAY_SECONDS,
};

export type UpdateReason = 'never' | 'stale' | 'match';

/**
 * Whether an account's history should be fetched now, and why. `nextMatchAt` is the start of the
 * player's next scheduled match, if any. A history fetched inside the before-match window is
 * already the one for that match, so the match alone does not ask for another.
 */
export function updateDue(
  lastFetchedAt: number | null,
  nowUnix: number,
  nextMatchAt: number | null = null,
  policy: UpdatePolicy = DEFAULT_UPDATE_POLICY,
): UpdateReason | null {
  if (lastFetchedAt === null) return 'never';
  const age = nowUnix - lastFetchedAt;
  if (age < policy.minIntervalSeconds) return null;
  if (age >= policy.maxAgeSeconds) return 'stale';
  if (nextMatchAt !== null && nextMatchAt > nowUnix && nextMatchAt - nowUnix <= policy.beforeMatchSeconds) {
    const windowOpened = nextMatchAt - policy.beforeMatchSeconds;
    if (lastFetchedAt < windowOpened) return 'match';
  }
  return null;
}
