// The balance check: a small, fixed-seed run of the measures GAME_DESIGN.md section 9 promises,
// cheap enough for CI (only the fast computer players, a few hundred games). `balance.test.ts`
// asserts each measure stays in its band; `tsx balance.ts` prints the numbers.
import type { GameResult } from './cells';
import { playCellGame, type CellSpec } from './cells';
import { comeback, meanRounds, PACKS, seat, wins } from './exp/common';
import { subSeed } from '../rng';

export interface BalanceNumbers {
  slug: string;
  /** Mean rounds and share of matches that end with an Ancient destroyed (obvious-move mirror) */
  rounds: number; ancientEnds: number;
  /** Veteran (40 packs) against a new player (10 packs), both playing the obvious move, budget decks */
  veteran: number;
  /** The player behind after round 3 wins (obvious-move mirror) */
  comeback: number;
  /** The middle computer player against the obvious-move player, same deck (Wiosenna only: slow) */
  skill?: number;
}

const cellOf = (slug: string, key: string, x: CellSpec['seats'][0], y: CellSpec['seats'][1], games: number, extra: Partial<CellSpec> = {}): CellSpec => ({
  key, slug, seats: [x, y], games, seed: subSeed(7, slug, key), colSeed: subSeed(7, slug, 'collections'), collections: 40, ...extra,
});
const play = (c: CellSpec): GameResult[] => Array.from({ length: c.games }, (_, i) => playCellGame(c, i));

export function balanceNumbers(slug: string, opts: { games?: number; skillGames?: number } = {}): BalanceNumbers {
  const g = opts.games ?? 200;
  const mirror = play(cellOf(slug, 'mirror', seat('greedy'), seat('greedy'), g, { sameCollection: true }));
  const vet = play(cellOf(slug, 'vet', seat('greedy', 'best', PACKS.veteran), seat('greedy', 'best', PACKS.new), g, { collections: 100 }));
  const out: BalanceNumbers = {
    slug, rounds: meanRounds(mirror), ancientEnds: mirror.filter((r) => r.rec.reason === 'ancient').length / mirror.length,
    veteran: wins(vet).k / wins(vet).n, comeback: (() => { const c = comeback(mirror, 3); return c.k / c.n; })(),
  };
  if (opts.skillGames) {
    const skill = play(cellOf(slug, 'skill', seat('responder'), seat('greedy'), opts.skillGames, { sameCollection: true }));
    out.skill = wins(skill).k / wins(skill).n;
  }
  return out;
}

if (process.argv[1]?.endsWith('balance.ts')) {
  for (const slug of ['wiosenna', 'pdl-s2']) {
    const t = Date.now();
    console.log(JSON.stringify(balanceNumbers(slug, { skillGames: slug === 'wiosenna' ? 80 : 0 })), `${((Date.now() - t) / 1000).toFixed(0)} s`);
  }
}
