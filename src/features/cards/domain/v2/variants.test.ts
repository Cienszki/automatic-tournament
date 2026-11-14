// The rule variants added in the second round of WP-51 (and chosen as defaults): what a card
// costs, the catch-up card, Smoke that pulls a unit, Tank that takes the gank, High Ground here.
import { describe, expect, it } from 'vitest';
import { cost, deckCost } from './deck';
import { planCost } from './plan';
import { resolveRound } from './resolve';
import { DEFAULT_RULES } from './rules';
import { strengthParts } from './strength';
import { aBoard, aCard } from './testing';
import type { MatchEvent } from './types';

const ganks = (events: MatchEvent[]) => events.filter((e): e is Extract<MatchEvent, { kind: 'gank' }> => e.kind === 'gank');

describe('card cost', () => {
  const off = aCard({ role: 'Offlane', cost: 5 }); const sup = aCard({ role: 'Hard Support', cost: 5 });
  const star = aCard({ role: 'Carry', cost: 5, totw: true }); const low = aCard({ role: 'Soft Support', cost: 1 });
  it('rating: the rating strength alone', () => {
    expect([off, sup, star, low].map((c) => cost(c, 'rating'))).toEqual([5, 5, 5, 1]);
  });
  it('might: adds the role modifier (never below 1) but not the team-of-the-round bonus', () => {
    expect([off, sup, star, low].map((c) => cost(c, 'might'))).toEqual([6, 4, 5, 1]);
    expect(deckCost([off, sup, star, low], 'might')).toBe(16);
  });
  it('full: also counts the team-of-the-round bonus', () => {
    expect(cost(star, 'full')).toBe(6);
  });
  it('the default is might', () => {
    expect(DEFAULT_RULES.costMode).toBe('might');
  });
});

describe('catch-up', () => {
  const deck = () => Array.from({ length: 5 }, () => aCard());
  it('the side with less HP draws the extra card; equal HP draws none', () => {
    const behind = aBoard({ rules: { catchUpDraw: 1 }, decks: [deck(), deck()], hp: [8, 10] });
    expect(resolveRound(behind, [[], []]).state.sides.map((b) => b.hand.length)).toEqual([2, 1]);
    const level = aBoard({ rules: { catchUpDraw: 1 }, decks: [deck(), deck()] });
    expect(resolveRound(level, [[], []]).state.sides.map((b) => b.hand.length)).toEqual([1, 1]);
  });
  it('HP is compared after the damage of the round', () => {
    // Side 1 alone on an objective: side 0 loses 1 HP this round and is behind when the next starts
    const s = aBoard({ rules: { catchUpDraw: 1 }, decks: [deck(), deck()], units: [{ card: aCard(), side: 1, at: 1 }] });
    expect(resolveRound(s, [[], []]).state.sides.map((b) => b.hand.length)).toEqual([2, 1]);
  });
  it('a gap can be required: behind by less than it draws nothing extra', () => {
    const two = aBoard({ rules: { catchUpDraw: 1, catchUpGap: 3 }, decks: [deck(), deck()], hp: [8, 10] });
    expect(resolveRound(two, [[], []]).state.sides.map((b) => b.hand.length)).toEqual([1, 1]);
    const three = aBoard({ rules: { catchUpDraw: 1, catchUpGap: 3 }, decks: [deck(), deck()], hp: [7, 10] });
    expect(resolveRound(three, [[], []]).state.sides.map((b) => b.hand.length)).toEqual([2, 1]);
  });
  it('extra orders work the same way', () => {
    const s = aBoard({ rules: { catchUpOrders: 1 }, hp: [8, 10] });
    expect(resolveRound(s, [[], []]).state.orders).toEqual([3, 2]);
  });
});

describe('Smoke that pulls a unit', () => {
  const sup = aCard({ id: 'sup', role: 'Soft Support' }); const x = aCard({ id: 'x' }); const y = aCard({ id: 'y' });
  const board = () => aBoard({ rules: { smokeMode: 'pull' }, hands: [[sup], []], units: [{ card: x, side: 0, at: 0 }, { card: y, side: 0, at: 1 }] });
  it('a Soft Support played from hand lets one own unit move to its objective for no order', () => {
    expect(planCost(board(), 0, [{ kind: 'play', card: 'sup', to: 2 }, { kind: 'move', unit: '0:x', to: 2 }])).toBe(1);
  });
  it('only one unit per Soft Support played, and only to that objective', () => {
    expect(planCost(board(), 0, [{ kind: 'play', card: 'sup', to: 2 }, { kind: 'move', unit: '0:x', to: 2 }, { kind: 'move', unit: '0:y', to: 2 }])).toBe(2);
    expect(planCost(board(), 0, [{ kind: 'play', card: 'sup', to: 2 }, { kind: 'move', unit: '0:x', to: 1 }])).toBe(2);
  });
  it('a Soft Support already on the board frees nothing', () => {
    const s = aBoard({ rules: { smokeMode: 'pull' }, units: [{ card: sup, side: 0, at: 0 }, { card: x, side: 0, at: 0 }] });
    expect(planCost(s, 0, [{ kind: 'move', unit: '0:x', to: 2 }])).toBe(1);
  });
});

describe('Tank that takes the gank', () => {
  const mid = aCard({ id: 'mid', role: 'Mid' });
  it('the gank returns the Offlane and leaves the stronger unit beside it', () => {
    const off = aCard({ id: 'off', role: 'Offlane', cost: 2 }); const big = aCard({ id: 'big', cost: 9 });
    const s = aBoard({ rules: { tankMode: 'redirect' }, hands: [[mid], []], units: [{ card: off, side: 1, at: 0 }, { card: big, side: 1, at: 0 }] });
    const r = resolveRound(s, [[{ kind: 'play', card: 'mid', to: 0 }], []]);
    expect(ganks(r.events)[0]).toMatchObject({ blocked: false, toHand: true });
    expect(ganks(r.events)[0].target?.id).toBe('off');
    expect(r.state.units.map((u) => u.card.id).sort()).toEqual(['big', 'mid']);
  });
  it('without an Offlane the strongest unit is returned as usual', () => {
    const big = aCard({ id: 'big', cost: 9 }); const small = aCard({ id: 'small', cost: 2 });
    const s = aBoard({ rules: { tankMode: 'redirect' }, hands: [[mid], []], units: [{ card: small, side: 1, at: 0 }, { card: big, side: 1, at: 0 }] });
    expect(ganks(resolveRound(s, [[{ kind: 'play', card: 'mid', to: 0 }], []]).events)[0].target?.id).toBe('big');
  });
});

describe('High Ground bonus only on High Ground', () => {
  it('only units standing on High Ground get the bonus', () => {
    const on = aCard(); const away = aCard();
    const s = aBoard({ rules: { highGround: 'here' }, objectives: ['highground', 'gates', 'lotus'], control: [0, null, null], units: [{ card: on, side: 0, at: 0 }, { card: away, side: 0, at: 1 }] });
    expect(strengthParts(s, s.units[0]).highGround).toBe(1);
    expect(strengthParts(s, s.units[1]).highGround).toBe(0);
  });
});
