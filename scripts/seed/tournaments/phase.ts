// How far a seed tournament has got. Each format supports the phases that mean something for it.

import type { TournamentRow } from '../builders';

export const PHASES = ['registration', 'mid-season', 'playoffs', 'finished'] as const;
export type Phase = (typeof PHASES)[number];

export function isPhase(value: string): value is Phase {
  return (PHASES as readonly string[]).includes(value);
}

export function statusFor(phase: Phase): TournamentRow['status'] {
  return phase === 'registration' ? 'registration' : phase === 'finished' ? 'completed' : 'active';
}

const WEEK = 7 * 24 * 3_600_000;

/**
 * When round 1 was (or will be) played, so that `played` weekly rounds are in the past and the
 * next one is about half a week ahead of `now`. Times are at 19:00 UTC.
 */
export function firstRoundFor(now: Date, played: number): Date {
  const first = new Date(now.getTime() - (played - 0.5) * WEEK);
  first.setUTCHours(19, 0, 0, 0);
  return first;
}
