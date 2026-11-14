import { describe, expect, it } from 'vitest';
import { resolveRound } from './resolve';
import { strengthOf, strengthParts } from './strength';
import { aBoard, aCard } from './testing';
import type { MatchState } from './types';

const unit = (s: MatchState, id: string) => s.units.find((u) => u.card.id === id)!;

describe('strength', () => {
  it('is baseMight plus growth, Aura, Drużyna and High Ground', () => {
    const carry = aCard({ id: 'carry', cost: 5, team: 'T' }); const hs = aCard({ id: 'hs', role: 'Hard Support', cost: 4, team: 'T' });
    const hs2 = aCard({ id: 'hs2', role: 'Hard Support', cost: 4 });
    const s = aBoard({
      objectives: ['highground', 'gates', 'lotus'], control: [0, null, null],
      units: [{ card: carry, side: 0, at: 1, growth: 2 }, { card: hs, side: 0, at: 1 }, { card: hs2, side: 0, at: 1 }],
    });
    expect(strengthParts(s, unit(s, 'carry'))).toEqual({ base: 5, growth: 2, aura: 2, team: 1, highGround: 1 });
    // Hard Support: 4 - 1 (support) + 2 aura (itself and the other) + team + High Ground
    expect(strengthOf(s, unit(s, 'hs'))).toBe(3 + 2 + 1 + 1);
    expect(strengthOf(s, unit(s, 'hs2'))).toBe(3 + 2 + 0 + 1);
  });

  it('Offlane +1, supports -1, TOTW +1, never below 1', () => {
    const s = aBoard({ units: [
      { card: aCard({ id: 'o', role: 'Offlane', cost: 5 }), side: 0, at: 0 },
      { card: aCard({ id: 't', cost: 5, totw: true }), side: 0, at: 1 },
      { card: aCard({ id: 'w', role: 'Soft Support', cost: 1 }), side: 0, at: 2 },
    ] });
    expect([strengthOf(s, unit(s, 'o')), strengthOf(s, unit(s, 't')), strengthOf(s, unit(s, 'w'))]).toEqual([6, 6, 1]);
  });

  it('High Ground "here" mode gives the bonus only on High Ground', () => {
    const s = aBoard({ rules: { highGround: 'here' }, objectives: ['highground', 'gates', 'lotus'], control: [1, null, null],
      units: [{ card: aCard({ id: 'a', cost: 5 }), side: 1, at: 0 }, { card: aCard({ id: 'b', cost: 5 }), side: 1, at: 1 }] });
    expect(strengthOf(s, unit(s, 'a'))).toBe(6);
    expect(strengthOf(s, unit(s, 'b'))).toBe(5);
  });

  it('Aura and Drużyna can be switched off', () => {
    const s = aBoard({ rules: { abilities: { aura: false, team: false } }, units: [
      { card: aCard({ id: 'a', cost: 5, team: 'T' }), side: 0, at: 0 }, { card: aCard({ id: 'h', role: 'Hard Support', cost: 5, team: 'T' }), side: 0, at: 0 }] });
    expect(strengthOf(s, unit(s, 'a'))).toBe(5);
  });
});

describe('control and damage', () => {
  it('the side with strictly more strength controls and deals 1 (Roshan 2); a tie controls nothing', () => {
    const s = aBoard({ objectives: ['roshan', 'gates', 'lotus'], units: [
      { card: aCard({ cost: 6 }), side: 0, at: 0 }, { card: aCard({ cost: 5 }), side: 1, at: 0 },
      { card: aCard({ cost: 5 }), side: 0, at: 1 }, { card: aCard({ cost: 5 }), side: 1, at: 1 },
      { card: aCard({ cost: 1 }), side: 1, at: 2 },
    ] });
    const { state } = resolveRound(s, [[], []]);
    expect(state.control).toEqual([0, null, 1]);
    expect(state.sides[1].hp).toBe(12 - 2);
    expect(state.sides[0].hp).toBe(12 - 1);
  });

  it('damage doubles from round lateFrom on, and not when lateFrom is Infinity', () => {
    const units = [{ card: aCard({ cost: 3 }), side: 0 as const, at: 0 as const }];
    expect(resolveRound(aBoard({ round: 4, units }), [[], []]).state.sides[1].hp).toBe(11);
    expect(resolveRound(aBoard({ round: 5, units }), [[], []]).state.sides[1].hp).toBe(10);
    expect(resolveRound(aBoard({ round: 7, units, rules: { lateFrom: Infinity } }), [[], []]).state.sides[1].hp).toBe(11);
    expect(resolveRound(aBoard({ round: 5, units, objectives: ['roshan', 'gates', 'lotus'] }), [[], []]).state.sides[1].hp).toBe(8);
  });

  it('both plans apply at once: two sides playing to one objective fight there the same round', () => {
    const a = aCard({ id: 'a', cost: 4 }); const b = aCard({ id: 'b', cost: 6 });
    const s = aBoard({ hands: [[a], [b]] });
    const { state } = resolveRound(s, [[{ kind: 'play', card: 'a', to: 0 }], [{ kind: 'play', card: 'b', to: 0 }]]);
    expect(state.control[0]).toBe(1);
    expect(state.units.map((u) => u.uid).sort()).toEqual(['0:a', '1:b']);
  });

  it('both sides can fill one objective to capacity in the same round', () => {
    const mine = [aCard(), aCard(), aCard()]; const theirs = [aCard(), aCard(), aCard()];
    const s = aBoard({ orders: [3, 3], hands: [mine, theirs] });
    const { state } = resolveRound(s, [mine.map((c) => ({ kind: 'play' as const, card: c.id, to: 0 as const })), theirs.map((c) => ({ kind: 'play' as const, card: c.id, to: 0 as const }))]);
    expect(state.units.filter((u) => u.at === 0)).toHaveLength(6);
  });

  it('a replace discards the named unit to the graveyard', () => {
    const [a, b, c] = [aCard({ id: 'a', cost: 1 }), aCard({ id: 'b' }), aCard({ id: 'c' })]; const h = aCard({ id: 'h', cost: 9 });
    const s = aBoard({ hands: [[h], []], units: [a, b, c].map((card) => ({ card, side: 0 as const, at: 0 as const })) });
    const { state, events } = resolveRound(s, [[{ kind: 'play', card: 'h', to: 0, replace: '0:a' }], []]);
    expect(state.sides[0].grave.map((x) => x.id)).toEqual(['a']);
    expect(state.units.map((u) => u.card.id).sort()).toEqual(['b', 'c', 'h']);
    expect(events.find((e) => e.kind === 'play')).toMatchObject({ replaced: a });
  });

  it('throws on an illegal plan and does not change the state it was given', () => {
    const a = aCard({ id: 'a' });
    const s = aBoard({ hands: [[a], []] });
    const before = JSON.stringify(s);
    expect(() => resolveRound(s, [[{ kind: 'play', card: 'zz', to: 0 }], []])).toThrow(/side 0/);
    resolveRound(s, [[{ kind: 'play', card: 'a', to: 0 }], []]);
    expect(JSON.stringify(s)).toBe(before);
  });
});

describe('Farma', () => {
  it('a Carry on an objective its side controls grows by 1, up to farmMax', () => {
    const c = aCard({ id: 'c', cost: 5 });
    const s = aBoard({ units: [{ card: c, side: 0, at: 0 }] });
    let st = resolveRound(s, [[], []]).state;
    expect(unit(st, 'c').growth).toBe(1);
    st = resolveRound(st, [[], []]).state;
    st = resolveRound(st, [[], []]).state;
    st = resolveRound(st, [[], []]).state;
    expect(unit(st, 'c').growth).toBe(3);
  });

  it('does not grow where the side does not control, nor when Farma is off', () => {
    const c = aCard({ id: 'c', cost: 5 });
    const tied = aBoard({ units: [{ card: c, side: 0, at: 0 }, { card: aCard({ cost: 5 }), side: 1, at: 0 }] });
    expect(unit(resolveRound(tied, [[], []]).state, 'c').growth).toBe(0);
    const off = aBoard({ rules: { abilities: { farma: false } }, units: [{ card: c, side: 0, at: 0 }] });
    expect(unit(resolveRound(off, [[], []]).state, 'c').growth).toBe(0);
  });

  it('growth counts towards strength the next round', () => {
    const c = aCard({ id: 'c', cost: 5 });
    const s = aBoard({ units: [{ card: c, side: 0, at: 0 }, { card: aCard({ cost: 5 }), side: 1, at: 0 }, { card: aCard({ cost: 1 }), side: 0, at: 0 }] });
    const st = resolveRound(s, [[], []]).state;
    expect(strengthOf(st, unit(st, 'c'))).toBe(6);
  });
});
