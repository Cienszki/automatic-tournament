import { describe, expect, it } from 'vitest';
// Through the feature's entry point, so the public surface is checked too
import { fromOpenDota, LEAGUE, mostPlayedHeroes, PUB, type GameRow, type OpenDotaPlayerMatch } from '../index';
import recorded from '../clients/fixtures/opendota-player-matches.json';
import { DAY_SECONDS } from './window';

const NOW = 1_795_100_000;
let id = 0;
const game = (hero: number, daysAgo: number, win: 0 | 1 = 1, kind: 0 | 1 = PUB): GameRow => [++id, NOW - daysAgo * DAY_SECONDS, hero, win, kind, 0, 0];

describe('mostPlayedHeroes', () => {
  it('counts pub games only', () => {
    const lists = mostPlayedHeroes([game(1, 1), game(1, 2), game(2, 1, 1, LEAGUE), game(2, 2, 1, LEAGUE), game(2, 3, 1, LEAGUE)], NOW);
    expect(lists.overall).toEqual([{ heroId: 1, games: 2, win: 2 }]);
  });

  it('limits the recent list to the last 180 days', () => {
    const lists = mostPlayedHeroes([game(1, 10), game(2, 200), game(2, 300), game(2, 400)], NOW);
    expect(lists.overall.map((h) => h.heroId)).toEqual([2, 1]);
    expect(lists.recent).toEqual([{ heroId: 1, games: 1, win: 1 }]);
  });

  it('counts wins and losses', () => {
    const lists = mostPlayedHeroes([game(7, 1, 1), game(7, 2, 0), game(7, 3, 0)], NOW);
    expect(lists.overall).toEqual([{ heroId: 7, games: 3, win: 1 }]);
  });

  it('breaks ties by wins, then by hero id, and keeps the top five', () => {
    const rows = [3, 4, 5, 6, 8, 9].flatMap((h) => [game(h, 1, 0), game(h, 2, 0)]);
    rows.push(game(9, 3, 1));
    rows.push(game(4, 3, 0), game(4, 4, 1));
    const lists = mostPlayedHeroes(rows, NOW);
    expect(lists.overall.map((h) => h.heroId)).toEqual([4, 9, 3, 5, 6]);
  });

  it('counts a game that two accounts of one player both list once', () => {
    const shared = game(1, 1);
    expect(mostPlayedHeroes([shared, [...shared] as GameRow], NOW).overall).toEqual([{ heroId: 1, games: 1, win: 1 }]);
  });

  it('gives empty lists for an empty history', () => {
    expect(mostPlayedHeroes([], NOW)).toEqual({ overall: [], recent: [] });
  });

  it('builds the lists from a recorded OpenDota answer', () => {
    const matches = (recorded as Array<OpenDotaPlayerMatch | null>).filter((m): m is OpenDotaPlayerMatch => m !== null);
    const lists = mostPlayedHeroes(fromOpenDota(matches), NOW);
    // the league game, Turbo, Ability Draft and the abandoned game are not counted
    expect(lists.overall).toEqual([
      { heroId: 1, games: 2, win: 1 },
      { heroId: 2, games: 1, win: 1 },
    ]);
    expect(lists.recent).toEqual([{ heroId: 1, games: 2, win: 1 }]);
  });
});
