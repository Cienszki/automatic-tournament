// The prototype's cards: one committed JSON file made by scripts/tools/card-sim/prototype-data.ts
// from the Wiosenna fixture. Nothing here fetches anything.
import type { GCard } from '@/lib/card-lab/cards';
import type { Level } from '@/features/cards/domain/v2/ai/levels';
import { DEFAULT_RULES, type Rules } from '@/features/cards/domain/v2/rules';
import type { Cast } from '@/features/cards/state/game';
import { thawCard, type FrozenCard } from '@/lib/card-lab/frozen';
import raw from '../_data/wiosenna.json';

// The six attributes are not in the file: neither the engine nor the card face reads them
const NO_ATTRS = { WAL: 0, FAR: 0, ROZ: 0, OBR: 0, WIZ: 0, DRU: 0 };
const byId = new Map<string, GCard>(raw.cards.map((c) => [c.id, thawCard({ ...c, attrs: NO_ATTRS } as FrozenCard)]));
const card = (id: string): GCard => {
  const c = byId.get(id);
  if (!c) throw new Error(`card ${id} is not in the prototype data`);
  return c;
};

/** Cards the computer guesses unseen rival cards from */
export const POOL: GCard[] = raw.pool.map(card);
/** Six ready decks, legal under DEFAULT_RULES */
export const DECKS: GCard[][] = raw.decks.map((d) => d.map(card));

/** The decks of a match by seed: the player's deck and, three places further on, the computer's */
export function castFor(seed: number, rules: Rules = DEFAULT_RULES, level: Level = 'easy'): Cast {
  const n = DECKS.length;
  const mine = ((seed % n) + n) % n;
  return { decks: [DECKS[mine], DECKS[(mine + 3) % n]], pool: POOL, level, rules };
}
