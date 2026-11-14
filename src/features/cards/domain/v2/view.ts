// What one player may know: the whole board and both graveyards, their own hand, their own deck
// as a list (not its order), and of the rival only counts and the hand cards it has seen.
import type { GCard } from '@/lib/card-lab/cards';
import { other, type MatchState, type Side } from './types';

export interface RivalView {
  handSize: number;
  deckSize: number;
  grave: GCard[];
  /** Rival hand cards this side has seen (returned to hand by a gank) */
  known: GCard[];
  hp: number;
  orders: number;
}

export interface MatchView {
  side: Side;
  /** The board: rules, round, objectives, control, units, hp and orders of both sides */
  public: Omit<MatchState, 'sides'>;
  hp: number;
  hand: GCard[];
  /** Own deck, sorted by card id so its order says nothing */
  deck: GCard[];
  grave: GCard[];
  known: string[];
  rival: RivalView;
}

const byId = (a: GCard, b: GCard) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export function viewFor(s: MatchState, side: Side): MatchView {
  const me = s.sides[side];
  const r = s.sides[other(side)];
  const { sides: _hidden, ...pub } = s;
  return {
    side,
    public: { ...pub, units: s.units.map((u) => ({ ...u })) },
    hp: me.hp,
    hand: [...me.hand],
    deck: [...me.deck].sort(byId),
    grave: [...me.grave],
    known: [...me.known],
    rival: {
      handSize: r.hand.length,
      deckSize: r.deck.length,
      grave: [...r.grave],
      known: r.hand.filter((c) => r.known.includes(c.id)),
      hp: r.hp,
      orders: s.orders[other(side)],
    },
  };
}
