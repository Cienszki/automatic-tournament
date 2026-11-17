// The automatic deck: the strongest legal deck a collection can make under the rules in force.
// It builds a new player's first decks and answers "Ułóż za mnie". With the budget it is the
// budget deck (ranked duels, practice); with `budget: Infinity` it is the free deck (Kolejka,
// duels "bez limitu").
//
// Method: the exact optimiser (pick.ts) maximises expected strength per card (baseMight, +1 for a
// Carry's Farma and a Hard Support's Aura) within the budget, the role limits and one card per
// player and team; then single swaps raise it further while they add real-team pairs (the Drużyna
// bonus is free strength). A role over the per-position limit is held at the limit and rebuilt.
// Simulated (E21, settled rules): no deck shape beats this deck by more than 60%.
import { ROLE_KEYS, type GCard, type RoleKey } from '@/lib/card-lab/cards';
import { baseMight } from '@/lib/card-lab/outposts';
import { deckProblem, type DeckRules } from './deck';
import { minimums, pick, type Needs } from './pick';

const ABILITY_STRENGTH: Partial<Record<RoleKey, number>> = { Carry: 1, 'Hard Support': 1 };
/** What a card is expected to add on the board: its strength, plus its ability where that is strength */
export const expectedStrength = (c: GCard): number => baseMight(c) + (ABILITY_STRENGTH[c.role] ?? 0);
/** Value of a card in the deck that shares a real team with another card of the deck */
const TEAM_VALUE = 0.5;
/** Tiny tie-break so equal choices are made the same way every time */
const tie = (c: GCard) => c.ovr / 1e4;

/** How many cards of the deck share a real team with another card of the deck */
export function teamPaired(deck: GCard[]): number {
  const n = new Map<string, number>();
  for (const c of deck) if (c.team) n.set(c.team.id, (n.get(c.team.id) ?? 0) + 1);
  return deck.filter((c) => c.team && n.get(c.team.id)! > 1).length;
}

export const deckValue = (deck: GCard[]): number => deck.reduce((a, c) => a + expectedStrength(c), 0) + TEAM_VALUE * teamPaired(deck);

/** Single swaps (one card out, one in) while they raise deckValue and keep the deck legal */
export function improveTeams(deck: GCard[], col: GCard[], rules: DeckRules, needs: Needs): GCard[] {
  let cur = deck;
  const roleOk = (d: GCard[]) => ROLE_KEYS.every((r) => { const n = d.filter((c) => c.role === r).length; return n >= needs[r].min && n <= needs[r].max; });
  for (let iter = 0; iter < 50; iter++) {
    let best = { deck: cur, v: deckValue(cur) };
    for (let i = 0; i < cur.length; i++) for (const c of col) {
      if (cur.includes(c)) continue;
      const d = [...cur.slice(0, i), c, ...cur.slice(i + 1)];
      const v = deckValue(d);
      if (v > best.v + 1e-9 && roleOk(d) && deckProblem(d, rules) === null) best = { deck: d, v };
    }
    if (best.deck === cur) return cur;
    cur = best.deck;
  }
  return cur;
}

/**
 * The strongest legal deck from a collection, or null when the collection cannot make one.
 * `needsFor` lets a caller set the role limits (the simulations' role-heavy decks); by default
 * every role has the minimum, and a role that goes over the per-position limit is held at it.
 */
export function autoDeck(col: GCard[], rules: DeckRules, needsFor?: (fixed: Map<RoleKey, number>) => Needs): GCard[] | null {
  const cap = rules.maxPerRole ?? Infinity;
  const fixed = new Map<RoleKey, number>();
  for (let i = 0; i < ROLE_KEYS.length + 1; i++) {
    const needs = needsFor ? needsFor(fixed) : minimums(rules.perRole);
    if (!needsFor) for (const [r, n] of fixed) needs[r] = { min: n, max: n };
    const first = pick(col, rules, (c) => expectedStrength(c) + tie(c), needs);
    const d = first && improveTeams(first, col, rules, needs);
    if (!d || !Number.isFinite(cap)) return d;
    const over = ROLE_KEYS.find((r) => d.filter((c) => c.role === r).length > cap);
    if (!over) return d;
    fixed.set(over, cap);
  }
  return null;
}
