import { describe, it, expect } from 'vitest';
import {
  COACH_MODE_OPTIONS,
  coachesEnabled,
  isPerMatchCoachMode,
  isTeamLevelCoachMode,
  isWithinCoachLock,
  teamCoachLock,
} from '@/lib/coach-rules';

const NOW = Date.parse('2026-10-14T12:00:00Z');
const inHours = (h: number) => new Date(NOW + h * 3600_000).toISOString();

describe('coach modes', () => {
  it('explains every mode', () => {
    expect(COACH_MODE_OPTIONS.map(o => o.value)).toEqual(['disabled', 'pre-season', 'per-game', 'flexible']);
    for (const o of COACH_MODE_OPTIONS) expect(o.description.length).toBeGreaterThan(40);
  });

  it('classifies team-level vs per-match', () => {
    expect(isTeamLevelCoachMode('flexible')).toBe(true);
    expect(isTeamLevelCoachMode('pre-season')).toBe(true);
    expect(isTeamLevelCoachMode('per-game')).toBe(false);
    expect(isPerMatchCoachMode('per-game', false)).toBe(true);
    expect(isPerMatchCoachMode('flexible', true)).toBe(false);
    // Legacy docs without coachMode: per-match in leagues only
    expect(isPerMatchCoachMode(undefined, true)).toBe(true);
    expect(isPerMatchCoachMode(undefined, false)).toBe(false);
    expect(coachesEnabled('disabled', true)).toBe(false);
    expect(coachesEnabled(undefined, true)).toBe(true);
  });
});

describe('isWithinCoachLock', () => {
  it('locks from 24 h before until a few hours after the start', () => {
    expect(isWithinCoachLock(inHours(25), NOW)).toBe(false);
    expect(isWithinCoachLock(inHours(23.9), NOW)).toBe(true);
    expect(isWithinCoachLock(inHours(-1), NOW)).toBe(true);   // being played
    expect(isWithinCoachLock(inHours(-7), NOW)).toBe(false);  // long past, never completed
    expect(isWithinCoachLock(null, NOW)).toBe(false);
  });
});

describe('teamCoachLock', () => {
  it('flexible: open unless a scheduled match is under 24 h away', () => {
    expect(teamCoachLock('flexible', { tournamentStatus: 'active', upcomingMatchTimes: [inHours(48), null], now: NOW }).locked).toBe(false);
    const lock = teamCoachLock('flexible', { tournamentStatus: 'active', upcomingMatchTimes: [inHours(48), inHours(5)], now: NOW });
    expect(lock.locked).toBe(true);
    expect(lock.reason).toMatch(/24 h/);
  });

  it('flexible: an unscheduled match never locks', () => {
    expect(teamCoachLock('flexible', { tournamentStatus: 'active', upcomingMatchTimes: [undefined], now: NOW }).locked).toBe(false);
  });

  it('pre-season: open only before the tournament starts', () => {
    expect(teamCoachLock('pre-season', { tournamentStatus: 'registration', upcomingMatchTimes: [inHours(1)], now: NOW }).locked).toBe(false);
    expect(teamCoachLock('pre-season', { tournamentStatus: 'active', upcomingMatchTimes: [], now: NOW }).locked).toBe(true);
  });
});
