// Deck builders for the v2 simulations. Every deck is legal under the rules in force (the
// engine's deckProblem): size, role minimums, one card per player and team, budget. All but
// teamStack use the exact optimiser in pick.ts (best total of a per-card value).
//
//   best        value = baseMight (rating strength, Offlane +1, supports -1, TOTW +1) + expected
//               ability strength (Carry +1 for Farma, Hard Support +1 for Aura on a neighbour);
//               then single swaps that raise value + 0.5 per card with a real-team teammate in the
//               deck. Under a budget this buys strength above cost: TOTW cards, Offlanes, Carries,
//               Hard Supports and teammates, and spends the whole budget.
//   topHeavy    as many cost 8-9 cards as fit, the rest as cheap as possible.
//   flat        every cost as close to budget / deckSize as possible, then strongest.
//   teamStack   per real team, the deck with the most cards of that team (then strongest); the
//               team that gets the most cards in.
//   roleSkew(r) exactly the minimum of every other role, all other cards role r, then like best.
//   random      a random legal deck (the optimiser with random per-card values).
import { ROLE_KEYS, type GCard, type RoleKey } from '@/lib/card-lab/cards';
import { baseMight } from '@/lib/card-lab/outposts';
import { cost, deckProblem, type DeckRules } from '@/features/cards/domain/v2/deck';
import type { Rnd } from '../rng';
import { minimums, pick, type Needs } from './pick';

export type BuilderName = 'best' | 'topHeavy' | 'flat' | 'teamStack' | 'random' | `roleSkew:${RoleKey}`;
export const ARCHETYPES: BuilderName[] = ['best', 'topHeavy', 'flat', 'teamStack', ...ROLE_KEYS.map((r) => `roleSkew:${r}` as BuilderName)];

const ABILITY_STRENGTH: Partial<Record<RoleKey, number>> = { Carry: 1, 'Hard Support': 1 };
export const expectedStrength = (c: GCard) => baseMight(c) + (ABILITY_STRENGTH[c.role] ?? 0);
const TEAM_VALUE = 0.5;
/** Tiny tie-break so equal choices are made the same way every time */
const tie = (c: GCard) => c.ovr / 1e4;

export function teamPaired(deck: GCard[]): number {
  const n = new Map<string, number>();
  for (const c of deck) if (c.team) n.set(c.team.id, (n.get(c.team.id) ?? 0) + 1);
  return deck.filter((c) => c.team && n.get(c.team.id)! > 1).length;
}

const deckValue = (deck: GCard[]) => deck.reduce((a, c) => a + expectedStrength(c), 0) + TEAM_VALUE * teamPaired(deck);

/** Single swaps (one card out, one in) while they raise deckValue and keep the deck legal */
function improveTeams(deck: GCard[], col: GCard[], rules: DeckRules, needs: Needs): GCard[] {
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

function teamStack(col: GCard[], rules: DeckRules): GCard[] | null {
  const teams = [...new Set(col.flatMap((c) => (c.team ? [c.team.id] : [])))];
  let best: { deck: GCard[]; n: number; v: number } | null = null;
  for (const t of teams) {
    const deck = pick(col, rules, (c) => (c.team?.id === t ? 100 : 0) + baseMight(c) + tie(c), minimums(rules.perRole));
    if (!deck) continue;
    const n = deck.filter((c) => c.team?.id === t).length;
    const v = deckValue(deck);
    if (!best || n > best.n || (n === best.n && v > best.v)) best = { deck, n, v };
  }
  return best?.deck ?? null;
}

/** A deck of the named kind from a collection, or null if the collection cannot make a legal one */
export function buildDeck(name: BuilderName, col: GCard[], rules: DeckRules, rnd?: Rnd): GCard[] | null {
  const mins = minimums(rules.perRole);
  const target = Number.isFinite(rules.budget) ? rules.budget / rules.deckSize : 9;
  switch (name) {
    case 'best': {
      const d = pick(col, rules, (c) => expectedStrength(c) + tie(c), mins);
      return d && improveTeams(d, col, rules, mins);
    }
    case 'topHeavy': return pick(col, rules, (c) => (cost(c) >= 8 ? 100 + baseMight(c) : -cost(c)) + tie(c), mins);
    case 'flat': return pick(col, rules, (c) => -10 * Math.abs(cost(c) - target) + baseMight(c) / 10 + tie(c), mins);
    case 'teamStack': return teamStack(col, rules);
    case 'random': {
      if (!rnd) throw new Error('random deck needs a random stream');
      return pick(col, rules, () => rnd(), mins);
    }
    default: {
      const role = name.slice('roleSkew:'.length) as RoleKey;
      const needs = Object.fromEntries(ROLE_KEYS.map((r) => [r, r === role ? { min: rules.perRole, max: Infinity } : { min: rules.perRole, max: rules.perRole }])) as Needs;
      const d = pick(col, rules, (c) => expectedStrength(c) + tie(c), needs);
      return d && improveTeams(d, col, rules, needs);
    }
  }
}

export const totalCost = (d: GCard[]) => d.reduce((a, c) => a + cost(c), 0);
export const totalMight = (d: GCard[]) => d.reduce((a, c) => a + baseMight(c), 0);
export const roleMix = (d: GCard[]) => ROLE_KEYS.map((r) => d.filter((c) => c.role === r).length).join('/');
