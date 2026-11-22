import { describe, expect, it } from 'vitest';
import type { GameRow } from './game-row';
import { DAY_SECONDS, DEFAULT_UPDATE_POLICY, historyWindowDays, newestStart, updateDue } from './window';

const NOW = 1_795_000_000;
const HOUR = 3_600;
const row = (id: number, start: number): GameRow => [id, start, 1, 1, 0, 0, 0];

describe('newestStart', () => {
  it('finds the newest game whatever the order', () => {
    expect(newestStart([row(1, 300), row(2, 100), row(3, 200)])).toBe(300);
  });
  it('is null for an empty history', () => {
    expect(newestStart([])).toBeNull();
  });
});

describe('historyWindowDays', () => {
  it('asks for the whole history when nothing is stored', () => {
    expect(historyWindowDays(null, NOW)).toBeNull();
  });
  it('covers the days since the newest game plus one day of overlap', () => {
    expect(historyWindowDays(NOW - 3.5 * DAY_SECONDS, NOW)).toBe(5);
    expect(historyWindowDays(NOW - 3 * DAY_SECONDS, NOW)).toBe(4);
  });
  it('asks for at least the overlap day for a game played minutes ago', () => {
    expect(historyWindowDays(NOW - 600, NOW)).toBe(2);
  });
  it('treats a game dated in the future (clock skew) as played now', () => {
    expect(historyWindowDays(NOW + 600, NOW)).toBe(1);
  });
  it('uses the overlap it is given', () => {
    expect(historyWindowDays(NOW - 3 * DAY_SECONDS, NOW, 2)).toBe(5);
  });
});

describe('updateDue', () => {
  it('fetches an account that was never fetched', () => {
    expect(updateDue(null, NOW)).toBe('never');
  });
  it('never fetches sooner than the minimum interval, even before a match', () => {
    expect(updateDue(NOW - HOUR, NOW, NOW + HOUR)).toBeNull();
  });
  it('fetches a history that is too old', () => {
    expect(updateDue(NOW - DEFAULT_UPDATE_POLICY.maxAgeSeconds, NOW)).toBe('stale');
  });
  it('fetches the players of a match that starts within a day, once', () => {
    const matchAt = NOW + 6 * HOUR;
    expect(updateDue(NOW - 20 * HOUR, NOW, matchAt)).toBe('match');
    // fetched after the window opened: that history is already the one for this match
    expect(updateDue(NOW - 4 * HOUR, NOW, matchAt)).toBeNull();
  });
  it('ignores a match further away than the window, and one that has started', () => {
    expect(updateDue(NOW - 20 * HOUR, NOW, NOW + 3 * DAY_SECONDS)).toBeNull();
    expect(updateDue(NOW - 20 * HOUR, NOW, NOW - HOUR)).toBeNull();
  });
});
