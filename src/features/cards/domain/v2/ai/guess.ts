// Guessing what a player cannot see. The rival's hand is unknown, so a computer player fills it
// with cards drawn from the tournament's card pool: cards whose cost is near the rival's average
// (the average of the rival cards seen so far once there are 3, else the budget per card), never a
// player-and-team already seen in the rival's deck. Cards the rival got back from a gank are known.
import { deckKey, type GCard } from '@/lib/card-lab/cards';
import { cost } from '../deck';
import type { MatchState } from '../types';
import { other } from '../types';
import type { MatchView } from '../view';
import { type Rnd } from './rng';

/** Average cost per card assumed when the rules have no budget and too little was seen */
const NO_BUDGET_AVERAGE = 7;

function rivalSeen(v: MatchView): GCard[] {
  const op = other(v.side);
  return [...v.public.units.filter((u) => u.side === op).map((u) => u.card), ...v.rival.grave, ...v.rival.known];
}

export function rivalAverageCost(v: MatchView): number {
  const seen = rivalSeen(v);
  if (seen.length >= 3) return seen.reduce((a, c) => a + cost(c), 0) / seen.length;
  const { budget, deckSize } = v.public.rules;
  return Number.isFinite(budget) ? budget / deckSize : NO_BUDGET_AVERAGE;
}

/** Cards that could be in the rival's hand or deck, as the pool allows */
export function plausibleCards(v: MatchView, pool: GCard[]): GCard[] {
  const mean = rivalAverageCost(v);
  const used = new Set(rivalSeen(v).map(deckKey));
  const open = pool.filter((c) => !used.has(deckKey(c)));
  for (const spread of [1.5, 2.5]) {
    const near = open.filter((c) => Math.abs(cost(c) - mean) <= spread);
    if (near.length >= 12) return near;
  }
  return open.length ? open : pool;
}

function sample(cards: GCard[], n: number, rnd: Rnd, taken: Set<string>): GCard[] {
  const out: GCard[] = [];
  for (let tries = 0; out.length < n && tries < n * 20; tries++) {
    const c = cards[Math.floor(rnd() * cards.length)];
    if (!c || taken.has(deckKey(c))) continue;
    taken.add(deckKey(c));
    out.push(c);
  }
  return out;
}

/** A full state for one guess of the rival's hand (and the next few cards of its deck) */
export function guessState(v: MatchView, pool: GCard[], rnd: Rnd, plausible = plausibleCards(v, pool)): MatchState {
  const op = other(v.side);
  const taken = new Set(rivalSeen(v).map(deckKey));
  const hand = [...v.rival.known, ...sample(plausible, v.rival.handSize - v.rival.known.length, rnd, taken)];
  const deck = sample(plausible, Math.min(v.rival.deckSize, 3), rnd, taken);
  const sides = [] as unknown as MatchState['sides'];
  sides[v.side] = { hp: v.hp, hand: [...v.hand], deck: [...v.deck], grave: [...v.grave], known: [...v.known] };
  sides[op] = { hp: v.rival.hp, hand, deck, grave: [...v.rival.grave], known: v.rival.known.map((c) => c.id) };
  return { ...v.public, units: v.public.units.map((u) => ({ ...u })), sides };
}
