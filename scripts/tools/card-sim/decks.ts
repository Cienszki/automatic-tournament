// Decks for the simulations. The rule is the one the game uses (OUTPOSTS_RULE in
// OutpostsGame.tsx: DECK_SIZE cards, at least DECK_PER_ROLE per role, one card per player and team).

import { autoDeck, avgOvr, byStrength, cpuDeck, deckKey, deckProblem, ROLE_KEYS, shuffle, simCollection, type DeckRule, type GCard, type RoleKey } from '@/lib/card-lab/cards';
import { baseMight, DECK_PER_ROLE, DECK_SIZE } from '@/lib/card-lab/outposts';
import type { Rnd } from './rng';

export const RULE: DeckRule = { size: DECK_SIZE, perRole: DECK_PER_ROLE, text: '' };

export const avgMight = (d: GCard[]) => (d.length ? d.reduce((a, c) => a + baseMight(c), 0) / d.length : 0);
export { avgOvr };
export const legal = (d: GCard[]) => deckProblem(d, RULE) === null;

/** Two random decks from the whole pool, as the practice opponent's deck is made (cpuDeck): the
 *  second avoids the first one's players, as the computer's deck avoids yours */
export function randomPair(cards: GCard[], targets: [number, number], rnd: Rnd): [GCard[], GCard[]] {
  const a = cpuDeck(cards, RULE, targets[0], new Set(), rnd);
  const b = cpuDeck(cards, RULE, targets[1], new Set(a.map(c => c.pid)), rnd);
  return [a, b];
}

export const collection = (cards: GCard[], packs: number, rnd: Rnd) => simCollection(cards, packs, rnd);
export const bestDeck = (col: GCard[]) => autoDeck(col, RULE);

/** One card per player and team, the best of each (as autoDeck dedupes), strongest first */
export function uniqueCards(col: GCard[]): GCard[] {
  return [...new Map([...col].sort((a, b) => byStrength(b, a)).map(c => [deckKey(c), c])).values()].sort(byStrength);
}

/** The role minimums from `pick(role)` order, then the rest from `fill` order (both in uniq cards) */
function build(minFrom: (r: RoleKey) => GCard[], fill: GCard[]): GCard[] {
  const deck: GCard[] = [];
  for (const r of ROLE_KEYS) deck.push(...minFrom(r).slice(0, RULE.perRole));
  for (const c of fill) if (deck.length < RULE.size && !deck.includes(c)) deck.push(c);
  return deck;
}

/** Cards in the deck that share their real team with another card of the deck */
export function teamPaired(d: GCard[]): number {
  const n = new Map<string, number>();
  for (const c of d) if (c.team) n.set(c.team.id, (n.get(c.team.id) ?? 0) + 1);
  return d.filter(c => c.team && (n.get(c.team.id) ?? 0) > 1).length;
}

/** (i) As many cards from the same real teams as possible: whole teams, biggest first (each team's
 *  cards strongest first), keeping room for the role minimums; then strongest */
export function teamDeck(col: GCard[]): GCard[] {
  const uniq = uniqueCards(col);
  const byTeam = new Map<string, GCard[]>();
  for (const c of uniq) if (c.team) byTeam.set(c.team.id, [...(byTeam.get(c.team.id) ?? []), c]);
  const teams = [...byTeam.values()].filter(l => l.length > 1).sort((a, b) => b.length - a.length || avgMight(b) - avgMight(a));
  const deck: GCard[] = [];
  const need = () => ROLE_KEYS.reduce((a, r) => a + Math.max(0, RULE.perRole - deck.filter(c => c.role === r).length), 0);
  const fits = (c: GCard) => {
    if (deck.length >= RULE.size) return false;
    const helps = deck.filter(x => x.role === c.role).length < RULE.perRole;
    return RULE.size - deck.length - 1 >= need() - (helps ? 1 : 0);
  };
  for (const t of teams) {
    const room = t.filter(c => fits(c));
    if (room.length < 2) continue;
    for (const c of t) if (fits(c)) deck.push(c);
  }
  for (const r of ROLE_KEYS) for (const c of uniq.filter(x => x.role === r && !deck.includes(x))) { if (deck.filter(x => x.role === r).length >= RULE.perRole) break; deck.push(c); }
  for (const c of uniq) if (deck.length < RULE.size && !deck.includes(c)) deck.push(c);
  return deck;
}

/** (ii) The role minimums (strongest), then every free slot from one role (strongest), then strongest */
export function roleDeck(col: GCard[], role: RoleKey): { deck: GCard[]; ofRole: number } {
  const uniq = uniqueCards(col);
  const deck = build(r => uniq.filter(c => c.role === r), [...uniq.filter(c => c.role === role), ...uniq]);
  return { deck, ofRole: deck.filter(c => c.role === role).length };
}

/** (iii) A random legal deck: random role minimums, then random cards */
export function randomDeck(col: GCard[], rnd: Rnd): GCard[] {
  const uniq = shuffle(uniqueCards(col), rnd);
  return build(r => uniq.filter(c => c.role === r), uniq);
}

/** (iv) autoDeck with its 3 strongest cards swapped for the collection's next-best unused cards
 *  (of the same role when the swap would break a role minimum) */
export function weakenedDeck(col: GCard[]): GCard[] {
  const best = bestDeck(col);
  const uniq = uniqueCards(col);
  const top = [...best].sort(byStrength).slice(0, 3);
  const deck = best.filter(c => !top.includes(c));
  const unused = uniq.filter(c => !best.includes(c));
  for (const out of top) {
    const short = deck.filter(c => c.role === out.role).length < RULE.perRole;
    const pick = unused.find(c => !deck.includes(c) && (!short || c.role === out.role));
    if (pick) deck.push(pick);
  }
  return deck;
}
