// Deck legality in v2: size, role minimums, one card per player and team, and the budget.
import { deckKey, ROLE_KEYS, type GCard } from '@/lib/card-lab/cards';
import { baseMight, cardStrength } from '@/lib/card-lab/outposts';
import type { CostMode, Rules } from './rules';

/** What a card costs against the deck budget: its rating strength 1-9, without role or TOTW bonus */
export const cost = (c: GCard, mode: CostMode = 'rating'): number =>
  mode === 'rating' ? cardStrength(c) : mode === 'full' ? baseMight(c) : baseMight({ ...c, totw: false });
export const deckCost = (deck: GCard[], mode: CostMode = 'rating'): number => deck.reduce((s, c) => s + cost(c, mode), 0);

export type DeckRules = Pick<Rules, 'deckSize' | 'perRole' | 'budget'> & { costMode?: CostMode };

/** Why a deck is not legal (English, for tools and tests), or null when it is */
export function deckProblem(deck: GCard[], rules: DeckRules): string | null {
  if (deck.length !== rules.deckSize) return `deck has ${deck.length} cards, needs ${rules.deckSize}`;
  if (new Set(deck.map(deckKey)).size !== deck.length) return 'one card per player and team';
  for (const r of ROLE_KEYS) {
    const n = deck.filter((c) => c.role === r).length;
    if (n < rules.perRole) return `needs at least ${rules.perRole} ${r}, has ${n}`;
  }
  const total = deckCost(deck, rules.costMode);
  if (total > rules.budget) return `costs ${total}, budget is ${rules.budget}`;
  return null;
}
