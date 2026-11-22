import { describe, expect, it } from 'vitest';
import recorded from '../clients/fixtures/opendota-player-matches.json';
import { fromOpenDota, fromStratz, LEAGUE, PUB, type OpenDotaPlayerMatch } from './game-row';

const matches = (recorded as Array<OpenDotaPlayerMatch | null>).filter((m): m is OpenDotaPlayerMatch => m !== null);

describe('fromOpenDota', () => {
  it('keeps only games in hero-choice modes that have a result and a hero', () => {
    expect(fromOpenDota(matches).map((r) => r[0])).toEqual([9100000003, 9100000002, 9077734536, 7400000000]);
  });

  it('reads the win from the side the player was on', () => {
    const rows = new Map(fromOpenDota(matches).map((r) => [r[0], r]));
    expect(rows.get(9100000003)?.[3]).toBe(0); // Dire slot, Radiant won
    expect(rows.get(9100000002)?.[3]).toBe(1); // Dire slot, Dire won
    expect(rows.get(9077734536)?.[3]).toBe(1); // Radiant slot, Radiant won
  });

  it('marks practice lobbies as league games and the rest as pubs', () => {
    const rows = new Map(fromOpenDota(matches).map((r) => [r[0], r]));
    expect(rows.get(9077734536)?.[4]).toBe(LEAGUE);
    expect(rows.get(9100000003)?.[4]).toBe(PUB);
  });

  it('stores an unknown lane as 0 and never a position', () => {
    const old = fromOpenDota(matches).find((r) => r[0] === 7400000000);
    expect(old).toEqual([7400000000, 1700000000, 2, 1, PUB, 0, 0]);
  });
});

describe('fromStratz', () => {
  it('keeps hero-choice games with their position and no lane', () => {
    const rows = fromStratz([
      { matchId: 1, start: 10, hero: 5, win: true, league: false, position: 3, heroChoiceMode: true },
      { matchId: 2, start: 11, hero: 6, win: false, league: true, position: 1, heroChoiceMode: false },
    ]);
    expect(rows).toEqual([[1, 10, 5, 1, PUB, 0, 3]]);
  });
});
