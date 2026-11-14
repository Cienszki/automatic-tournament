// How good a position is for one side, as one number. Used on the state right after a round.
//
//   won / lost / drawn match          +1000 / -1000 / 0
//   Ancient HP difference             x hp
//   each objective controlled         x control * its damage next round * min(rounds left, 2),
//                                     plus a flat value for its effect (EFFECT below)
//   strength on the board             x strength (own total minus rival total)
//   cards in hand (counted up to 5)   x hand (own minus rival)
//   growth potential                  x growth per Carry below farmMax on an objective it controls
//   damage race (planner only)        +-race when, if control stayed as it is, one Ancient would
//                                     fall next round and the other would not
// Weights are round numbers picked by hand, not tuned to any result.
import type { ObjId } from '@/lib/card-lab/outposts';
import { damageValue, strengthOf } from '../strength';
import { other, type MatchState, type Side, type Slot } from '../types';

export const WEIGHTS = { hp: 1, control: 0.6, strength: 0.12, hand: 0.4, handCap: 5, growth: 0.25, race: 8 };

/** What holding an objective is worth beyond its damage (orders, cards, strength, moves) */
const EFFECT: Record<ObjId, number> = { roshan: 0, outpost: 0.8, lotus: 0.5, highground: 0.6, gates: 0.3, tormentor: 0 };

export interface EvalOptions { race?: boolean }

function raceTerm(s: MatchState, me: Side): number {
  const op = other(me);
  const next: [number, number] = [0, 0];
  for (const at of [0, 1, 2] as Slot[]) {
    const c = s.control[at];
    if (c !== null) next[c] += damageValue(s, at, s.round);
  }
  const mine = s.sides[me].hp - next[op];
  const theirs = s.sides[op].hp - next[me];
  if (mine > 0 && theirs > 0) return 0;
  if (mine <= 0 && theirs <= 0) return mine === theirs ? 0 : mine > theirs ? WEIGHTS.race : -WEIGHTS.race;
  return theirs <= 0 ? WEIGHTS.race : -WEIGHTS.race;
}

export function evaluate(s: MatchState, me: Side, opts: EvalOptions = {}): number {
  if (s.result) return s.result.winner === null ? 0 : s.result.winner === me ? 1000 : -1000;
  const op = other(me);
  const sign = (side: Side | null) => (side === me ? 1 : side === op ? -1 : 0);
  let v = WEIGHTS.hp * (s.sides[me].hp - s.sides[op].hp);
  const horizon = Math.min(s.rules.roundCap - s.round + 1, 2);
  for (const at of [0, 1, 2] as Slot[]) {
    const c = sign(s.control[at]);
    if (!c) continue;
    v += c * (WEIGHTS.control * damageValue(s, at, s.round) * horizon + EFFECT[s.objectives[at]]);
  }
  for (const u of s.units) {
    const c = sign(u.side);
    v += c * WEIGHTS.strength * strengthOf(s, u);
    if (u.card.role === 'Carry' && s.rules.abilities.farma && u.growth < s.rules.farmMax && s.control[u.at] === u.side) v += c * WEIGHTS.growth;
  }
  const hand = (side: Side) => Math.min(s.sides[side].hand.length, WEIGHTS.handCap);
  v += WEIGHTS.hand * (hand(me) - hand(op));
  if (opts.race) v += raceTerm(s, me);
  return v;
}
