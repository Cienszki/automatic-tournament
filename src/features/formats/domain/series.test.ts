import { describe, expect, it } from 'vitest';
import type { MatchKind, MatchStatus } from './ranking/types';
import { countsForStandings, hasResult, seriesOutcome } from './series';
import { aMatch } from './testing/builders';

describe('countsForStandings', () => {
  it.each<[MatchKind, boolean]>([
    ['regular', true],
    ['rematch', true],
    ['tiebreak', false],
    ['showmatch', false],
    ['other', false],
  ])('a completed %s match counts: %s', (kind, counts) => {
    expect(countsForStandings(aMatch('A', 'B', 2, 0, { kind }))).toBe(counts);
  });

  it.each<[MatchStatus, boolean]>([
    ['completed', true],
    ['bye', true],
    ['scheduled', false],
    ['live', false],
    ['void', false],
  ])('a regular match with status %s counts: %s', (status, counts) => {
    expect(countsForStandings(aMatch('A', 'B', 2, 0, { status }))).toBe(counts);
  });

  it('does not count a match a rematch replays', () => {
    expect(countsForStandings(aMatch('A', 'B', 2, 0, { replaced: true }))).toBe(false);
  });

  it('does not count a completed match without a score', () => {
    expect(countsForStandings(aMatch('A', 'B', 0, 0, { scoreB: null }))).toBe(false);
    expect(hasResult(aMatch('A', 'B', 0, 0, { scoreA: null }))).toBe(false);
  });
});

describe('seriesOutcome', () => {
  it('names the side that won more games, or a draw on equal games', () => {
    expect(seriesOutcome(2, 1)).toBe('a');
    expect(seriesOutcome(0, 2)).toBe('b');
    expect(seriesOutcome(1, 1)).toBe('draw');
    expect(seriesOutcome(0, 0)).toBe('draw');
  });
});
