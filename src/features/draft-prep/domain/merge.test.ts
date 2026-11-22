import { describe, expect, it } from 'vitest';
import type { GameRow } from './game-row';
import { mergeGames } from './merge';

const row = (id: number, start: number, lane = 0, position = 0, win: 0 | 1 = 1): GameRow => [id, start, 10, win, 0, lane, position];

describe('mergeGames', () => {
  it('adds new games and keeps the history in start order', () => {
    const result = mergeGames([row(1, 100), row(2, 200)], [row(4, 400), row(3, 300)]);
    expect(result.rows.map((r) => r[0])).toEqual([1, 2, 3, 4]);
    expect(result).toMatchObject({ added: 2, changed: 0 });
  });

  it('stores a game from the overlap day once', () => {
    const result = mergeGames([row(1, 100), row(2, 200)], [row(2, 200), row(3, 300)]);
    expect(result.rows).toHaveLength(3);
    expect(result).toMatchObject({ added: 1, changed: 0 });
  });

  it('counts a game listed twice in one fetch once', () => {
    const result = mergeGames([], [row(5, 500), row(5, 500)]);
    expect(result).toMatchObject({ added: 1, changed: 0 });
    expect(result.rows).toHaveLength(1);
  });

  it('keeps a position from STRATZ when OpenDota sends the game again without one', () => {
    const result = mergeGames([row(1, 100, 2, 3)], [row(1, 100, 2, 0)]);
    expect(result.rows[0]).toEqual(row(1, 100, 2, 3));
    expect(result.changed).toBe(0);
  });

  it('keeps a lane from OpenDota when STRATZ sends the game with a position', () => {
    const result = mergeGames([row(1, 100, 2, 0)], [row(1, 100, 0, 4)]);
    expect(result.rows[0]).toEqual(row(1, 100, 2, 4));
    expect(result.changed).toBe(1);
  });

  it('takes a corrected result from the newer fetch', () => {
    const result = mergeGames([row(1, 100, 1, 1, 0)], [row(1, 100, 1, 1, 1)]);
    expect(result.rows[0][3]).toBe(1);
    expect(result.changed).toBe(1);
  });

  it('orders games that started in the same second by match id', () => {
    expect(mergeGames([row(9, 100)], [row(3, 100)]).rows.map((r) => r[0])).toEqual([3, 9]);
  });

  it('does not change the stored rows it was given', () => {
    const stored = [row(1, 100, 2, 0)];
    mergeGames(stored, [row(1, 100, 0, 4)]);
    expect(stored[0]).toEqual(row(1, 100, 2, 0));
  });

  it('returns an empty history for nothing stored and nothing fetched', () => {
    expect(mergeGames([], [])).toEqual({ rows: [], added: 0, changed: 0 });
  });
});
