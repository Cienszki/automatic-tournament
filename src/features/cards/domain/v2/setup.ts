// Starting a match and the start-of-round steps (draws and orders).
import { shuffle, type GCard } from '@/lib/card-lab/cards';
import { OBJ_IDS, type ObjId } from '@/lib/card-lab/outposts';
import type { Rules } from './rules';
import type { MatchEvent, MatchState, Side, SideState } from './types';

export type Rnd = () => number;

export interface MatchOptions {
  /** A fixed trio of objectives instead of three drawn at random */
  objectives?: [ObjId, ObjId, ObjId];
  /** Ancient hit points per side, when they differ (a difficulty handicap); default rules.hp each */
  hp?: [number, number];
}

/** A new match in round 1: decks shuffled, opening hands dealt (no draw in round 1) */
export function newMatch(decks: [GCard[], GCard[]], rnd: Rnd, rules: Rules, opts: MatchOptions = {}): MatchState {
  const objectives = opts.objectives ?? (shuffle(OBJ_IDS, rnd).slice(0, 3) as [ObjId, ObjId, ObjId]);
  const sides = decks.map((d, i): SideState => {
    const x = shuffle(d, rnd);
    const n = Math.min(rules.startHand, rules.handMax);
    return { hp: opts.hp?.[i] ?? rules.hp, hand: x.slice(0, n), deck: x.slice(n), grave: [], known: [] };
  }) as [SideState, SideState];
  return {
    rules, round: 1, objectives, control: [null, null, null], units: [], sides,
    orders: [rules.orders, rules.orders], result: null,
  };
}

/** Draws up to n cards; a draw into a full hand is skipped and the card stays in the deck */
export function drawCards(s: MatchState, side: Side, n: number, why: 'round' | 'lotus' | 'tormentor', events: MatchEvent[]): void {
  const b = s.sides[side];
  let drawn = 0;
  for (let i = 0; i < n; i++) {
    if (!b.deck.length || b.hand.length >= s.rules.handMax) break;
    b.hand.push(b.deck.shift()!);
    drawn++;
  }
  if (drawn) events.push({ kind: 'draw', side, cards: drawn, why });
}

const controls = (s: MatchState, side: Side, id: ObjId) => {
  const i = s.objectives.indexOf(id);
  return i >= 0 && s.control[i] === side;
};

/** Start of a round after the first: draws (Lotus Pool +1) and orders (Outpost +1) */
export function startRound(s: MatchState, events: MatchEvent[]): void {
  for (const side of [0, 1] as Side[]) {
    const behind = s.sides[side].hp < s.sides[side === 0 ? 1 : 0].hp;
    drawCards(s, side, s.rules.draw + (behind ? s.rules.catchUpDraw : 0), 'round', events);
    if (controls(s, side, 'lotus')) drawCards(s, side, 1, 'lotus', events);
    s.orders[side] = s.rules.orders + (controls(s, side, 'outpost') ? 1 : 0) + (behind ? s.rules.catchUpOrders : 0);
  }
}
