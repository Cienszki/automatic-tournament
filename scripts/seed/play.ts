// What a played series looks like: its game-by-game winners, the picks and bans, and each player's
// line. Plausible numbers, not a simulation; the only rules kept are the ones pages and tests lean
// on (a bo3 ends at two wins, a bo2 may be a draw, ten different heroes in a game).

import type { Position } from '../../src/platform/db/schema/_columns';
import type { Random } from './random';

/** Hero ids that exist in Dota 2 (the gaps in the numbering are left out). */
export const HERO_IDS: readonly number[] = [
  ...Array.from({ length: 23 }, (_, i) => i + 1),
  ...Array.from({ length: 90 }, (_, i) => i + 25),
  119, 120, 121, 123, 126, 128, 129, 131, 135, 136, 137, 138, 145,
];

/**
 * The winner of each game, `true` for side A, until the series is decided. `aChance` is the
 * chance that A wins a game.
 */
export function seriesGames(random: Random, bestOf: number, aChance: number): boolean[] {
  const games: boolean[] = [];
  if (bestOf === 2) return [random.chance(aChance), random.chance(aChance)];
  const needed = Math.ceil(bestOf / 2);
  let a = 0;
  let b = 0;
  while (a < needed && b < needed) {
    const aWins = random.chance(aChance);
    games.push(aWins);
    if (aWins) a++;
    else b++;
  }
  return games;
}

export interface PickBan { heroId: number; isPick: boolean; order: number; team: 0 | 1 }

/** Ten picks and ten bans of different heroes; picks 0-4 are Radiant's, 5-9 Dire's. */
export function draft(random: Random): { picksBans: PickBan[]; radiant: number[]; dire: number[] } {
  const heroes = random.sample(HERO_IDS, 20);
  const radiant = heroes.slice(0, 5);
  const dire = heroes.slice(5, 10);
  const bans = heroes.slice(10);
  const picksBans: PickBan[] = [
    ...bans.map((heroId, i) => ({ heroId, isPick: false, order: i, team: (i % 2) as 0 | 1 })),
    ...[...radiant, ...dire].map((heroId, i) => ({ heroId, isPick: true, order: 10 + i, team: (i < 5 ? 0 : 1) as 0 | 1 })),
  ];
  return { picksBans, radiant, dire };
}

const CORE: readonly Position[] = ['carry', 'mid', 'offlane'];

/** One player's line in one game. */
export function playerLine(random: Random, position: Position, won: boolean, minutes: number) {
  const core = CORE.includes(position);
  const swing = won ? 1.15 : 0.85;
  const gpm = Math.round((core ? random.int(450, 750) : random.int(250, 400)) * swing);
  const xpm = Math.round((core ? random.int(500, 800) : random.int(300, 480)) * swing);
  const kills = Math.round((core ? random.int(3, 14) : random.int(0, 6)) * swing);
  const deaths = Math.max(0, Math.round(random.int(1, 9) / swing));
  return {
    kills,
    deaths,
    assists: Math.round((core ? random.int(4, 14) : random.int(8, 22)) * swing),
    lastHits: core ? random.int(5, 9) * minutes : random.int(0, 2) * minutes,
    denies: random.int(0, core ? 20 : 6),
    gpm,
    xpm,
    netWorth: gpm * minutes + random.int(0, 2000),
    totalGold: gpm * minutes,
    goldSpent: Math.round(gpm * minutes * 0.9),
    heroDamage: (core ? random.int(600, 1100) : random.int(250, 600)) * minutes,
    towerDamage: core ? random.int(50, 250) * minutes : random.int(0, 40) * minutes,
    heroHealing: position === 'hard_support' ? random.int(20, 120) * minutes : 0,
    obsPlaced: core ? random.int(0, 2) : random.int(6, 18),
    senPlaced: core ? random.int(0, 3) : random.int(5, 15),
    observerKills: random.int(0, 6),
    sentryKills: random.int(0, 4),
    courierKills: random.chance(0.1) ? 1 : 0,
    roshanKills: position === 'carry' && won && random.chance(0.6) ? 1 : 0,
    towerKills: core ? random.int(0, 4) : random.int(0, 1),
    neutralKills: core ? random.int(30, 150) : random.int(0, 20),
    laneKills: core ? random.int(60, 250) : random.int(5, 40),
    heroKills: kills,
    campsStacked: core ? random.int(0, 2) : random.int(2, 10),
    runesPickedUp: random.int(2, 15),
    buybacks: random.chance(0.2) ? 1 : 0,
    highestKillStreak: Math.min(kills, random.int(0, 6)),
    doubleKills: kills > 5 ? random.int(0, 2) : 0,
    tripleKills: kills > 10 && random.chance(0.3) ? 1 : 0,
  };
}
