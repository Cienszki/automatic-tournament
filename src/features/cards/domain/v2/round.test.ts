import { describe, expect, it } from 'vitest';
import { resolveRound } from './resolve';
import { DEFAULT_RULES, makeRules } from './rules';
import { newMatch } from './setup';
import { aBoard, aCard } from './testing';
import { viewFor } from './view';

const deck = (tag: string) => Array.from({ length: 12 }, (_, i) => aCard({ id: `${tag}${String(i).padStart(2, '0')}` }));
const seq = (xs: number[]) => { let i = 0; return () => xs[i++ % xs.length]; };

describe('match start', () => {
  it('deals 4 cards, keeps the rest as the deck, draws three objectives, 12 HP, 2 orders', () => {
    const s = newMatch([deck('a'), deck('b')], seq([0.1, 0.7, 0.3, 0.9, 0.5]), DEFAULT_RULES);
    expect(s.sides.map((b) => [b.hand.length, b.deck.length, b.hp])).toEqual([[4, 8, 12], [4, 8, 12]]);
    expect(new Set(s.objectives).size).toBe(3);
    expect(s.orders).toEqual([2, 2]);
    expect(s.round).toBe(1);
  });

  it('accepts a fixed trio of objectives and per-side Ancient HP', () => {
    const s = newMatch([deck('a'), deck('b')], Math.random, DEFAULT_RULES, { objectives: ['roshan', 'gates', 'lotus'], hp: [14, 10] });
    expect(s.objectives).toEqual(['roshan', 'gates', 'lotus']);
    expect(s.sides.map((b) => b.hp)).toEqual([14, 10]);
  });
});

describe('start of a round', () => {
  it('no draw is made in round 1; from round 2 each side draws 1', () => {
    const s = newMatch([deck('a'), deck('b')], seq([0.5]), DEFAULT_RULES);
    const { state } = resolveRound(s, [[], []]);
    expect(state.round).toBe(2);
    expect(state.sides.map((b) => b.hand.length)).toEqual([5, 5]);
  });

  it('a draw into a full hand is skipped and the card stays in the deck', () => {
    const hand = Array.from({ length: 7 }, () => aCard()); const top = aCard({ id: 'top' });
    const s = aBoard({ hands: [hand, []], decks: [[top], []] });
    const { state } = resolveRound(s, [[], []]);
    expect(state.sides[0].hand).toHaveLength(7);
    expect(state.sides[0].deck.map((c) => c.id)).toEqual(['top']);
  });

  it('Lotus Pool controlled at the end of a round: +1 card next round', () => {
    const s = aBoard({ objectives: ['outpost', 'gates', 'lotus'], decks: [deck('a'), deck('b')], units: [{ card: aCard(), side: 1, at: 2 }] });
    const { state } = resolveRound(s, [[], []]);
    expect(state.sides.map((b) => b.hand.length)).toEqual([1, 2]);
  });

  it('Outpost controlled at the end of a round: +1 order next round', () => {
    const s = aBoard({ objectives: ['outpost', 'gates', 'lotus'], units: [{ card: aCard(), side: 0, at: 0 }] });
    expect(resolveRound(s, [[], []]).state.orders).toEqual([3, 2]);
  });

  it('draw and orders follow the rules object', () => {
    const s = aBoard({ rules: { draw: 2, orders: 3 }, decks: [deck('a'), deck('b')] });
    const { state } = resolveRound(s, [[], []]);
    expect(state.sides[0].hand).toHaveLength(2);
    expect(state.orders).toEqual([3, 3]);
  });
});

describe('Tormentor', () => {
  it('a side that takes it this round draws 1 at once; holding it again draws nothing', () => {
    const s = aBoard({ objectives: ['tormentor', 'gates', 'lotus'], decks: [deck('a'), deck('b')], units: [{ card: aCard(), side: 0, at: 0 }] });
    const r1 = resolveRound(s, [[], []]);
    expect(r1.events.filter((e) => e.kind === 'draw' && e.why === 'tormentor')).toHaveLength(1);
    expect(r1.state.sides[0].hand).toHaveLength(2);
    const r2 = resolveRound(r1.state, [[], []]);
    expect(r2.events.filter((e) => e.kind === 'draw' && e.why === 'tormentor')).toHaveLength(0);
  });
});

describe('end of the match', () => {
  const winning = (side: 0 | 1, cost = 5) => ({ card: aCard({ cost }), side, at: 0 as const });

  it('an Ancient at 0 or less is destroyed and the other side wins', () => {
    const s = aBoard({ hp: [12, 1], units: [winning(0)] });
    expect(resolveRound(s, [[], []]).state.result).toEqual({ winner: 0, reason: 'ancient', round: 2 });
  });

  it('both destroyed: the higher remaining HP wins; equal plays on', () => {
    const units = [winning(0), { card: aCard(), side: 1 as const, at: 1 as const }, { card: aCard(), side: 1 as const, at: 2 as const }];
    expect(resolveRound(aBoard({ hp: [2, 0], units }), [[], []]).state.result).toMatchObject({ winner: 0, reason: 'ancient' });
    const even = aBoard({ hp: [1, 0], objectives: ['roshan', 'gates', 'lotus'], units: [winning(0), { card: aCard(), side: 1, at: 1 }] });
    // Roshan takes side 1 to -2 while side 0 falls to 0: both destroyed, side 0 has more left
    expect(resolveRound(even, [[], []]).state.result?.winner).toBe(0);
    const equal = aBoard({ hp: [1, 1], units: [winning(0), { card: aCard(), side: 1, at: 1 }] });
    const r = resolveRound(equal, [[], []]).state;
    expect(r.result).toBeNull();
    expect(r.round).toBe(3);
  });

  it('after the last round the side with more HP wins', () => {
    const s = aBoard({ round: 8, hp: [5, 9], units: [winning(0)] });
    expect(resolveRound(s, [[], []]).state.result).toEqual({ winner: 1, reason: 'cap', round: 8 });
  });

  it('equal HP after the last round: more objectives controlled that round wins, else a draw', () => {
    const s = aBoard({ round: 8, hp: [9, 11], units: [winning(0)] }); // round 8 deals double
    expect(resolveRound(s, [[], []]).state.result).toEqual({ winner: 0, reason: 'cap-objectives', round: 8 });
    const tie = aBoard({ round: 8, hp: [9, 9], units: [winning(0), { card: aCard(), side: 1, at: 1 }] });
    expect(resolveRound(tie, [[], []]).state.result).toEqual({ winner: null, reason: 'draw', round: 8 });
  });

  it('roundCap is a rule; no round is played after the match ends', () => {
    const s = aBoard({ round: 3, rules: { roundCap: 3 }, hp: [9, 9] });
    const st = resolveRound(s, [[], []]).state;
    expect(st.result?.reason).toBe('draw');
    expect(() => resolveRound(st, [[], []])).toThrow(/over/);
  });
});

describe('what a player sees', () => {
  it('hides the rival hand and both deck orders, but shows cards the rival has seen', () => {
    const mid = aCard({ id: 'mid', role: 'Mid' }); const x = aCard({ id: 'x' }); const secret = aCard({ id: 'secret' });
    const s = aBoard({ hands: [[mid], [secret]], decks: [deck('a').reverse(), []], units: [{ card: x, side: 1, at: 0 }] });
    const st = resolveRound(s, [[{ kind: 'play', card: 'mid', to: 0 }], []]).state;
    const v0 = viewFor(st, 0);
    expect(v0.rival.handSize).toBe(2);
    expect(v0.rival.known.map((c) => c.id)).toEqual(['x']);
    expect(JSON.stringify(v0)).not.toContain('secret');
    expect(v0.deck.map((c) => c.id)).toEqual([...v0.deck.map((c) => c.id)].sort());
    expect(viewFor(st, 1).hand.map((c) => c.id).sort()).toEqual(['secret', 'x']);
    expect(makeRules({}).hp).toBe(12);
  });
});
