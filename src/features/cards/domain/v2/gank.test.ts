import { describe, expect, it } from 'vitest';
import { resolveRound } from './resolve';
import { aBoard, aCard } from './testing';
import type { MatchEvent, MatchState } from './types';

const ganks = (events: MatchEvent[]) => events.filter((e): e is Extract<MatchEvent, { kind: 'gank' }> => e.kind === 'gank');
const onBoard = (s: MatchState) => s.units.map((u) => u.card.id).sort();

describe('gank (Mid played from hand)', () => {
  it('returns the strongest rival unit there to its hand and drops its growth', () => {
    const mid = aCard({ id: 'mid', role: 'Mid' });
    const big = aCard({ id: 'big', cost: 7 }); const small = aCard({ id: 'small', cost: 3 });
    const s = aBoard({ hands: [[mid], []], units: [{ card: big, side: 1, at: 0, growth: 2 }, { card: small, side: 1, at: 0 }] });
    const { state, events } = resolveRound(s, [[{ kind: 'play', card: 'mid', to: 0 }], []]);
    expect(ganks(events)[0]).toMatchObject({ target: big, blocked: false, toHand: true });
    expect(state.sides[1].hand.map((c) => c.id)).toContain('big');
    expect(state.sides[1].known).toEqual(['big']);
    expect(onBoard(state)).toEqual(['mid', 'small']);
  });

  it('counts current strength (with growth) when choosing, ties going to the lowest card id', () => {
    const mid = aCard({ id: 'mid', role: 'Mid' });
    const a = aCard({ id: 'a', cost: 5 }); const b = aCard({ id: 'b', cost: 4 });
    const grown = aBoard({ hands: [[mid], []], units: [{ card: a, side: 1, at: 0 }, { card: b, side: 1, at: 0, growth: 2 }] });
    expect(ganks(resolveRound(grown, [[{ kind: 'play', card: 'mid', to: 0 }], []]).events)[0].target?.id).toBe('b');
    const tied = aBoard({ hands: [[mid], []], units: [{ card: b, side: 1, at: 0, growth: 1 }, { card: a, side: 1, at: 0 }] });
    expect(ganks(resolveRound(tied, [[{ kind: 'play', card: 'mid', to: 0 }], []]).events)[0].target?.id).toBe('a');
  });

  it('weakest mode takes the weakest, off mode takes nothing', () => {
    const mid = aCard({ id: 'mid', role: 'Mid' });
    const a = aCard({ id: 'a', cost: 7 }); const b = aCard({ id: 'b', cost: 3 });
    const base = { hands: [[mid], []] as [typeof mid[], typeof mid[]], units: [{ card: a, side: 1 as const, at: 0 as const }, { card: b, side: 1 as const, at: 0 as const }] };
    const weak = resolveRound(aBoard({ ...base, rules: { gank: 'weakest' } }), [[{ kind: 'play', card: 'mid', to: 0 }], []]);
    expect(ganks(weak.events)[0].target?.id).toBe('b');
    const off = resolveRound(aBoard({ ...base, rules: { gank: 'off' } }), [[{ kind: 'play', card: 'mid', to: 0 }], []]);
    expect(ganks(off.events)).toHaveLength(0);
  });

  it('an Offlane protects every unit of its side there, itself included (Tank)', () => {
    const mid = aCard({ id: 'mid', role: 'Mid' });
    const off = aCard({ id: 'off', role: 'Offlane', cost: 2 }); const big = aCard({ id: 'big', cost: 9 });
    const s = aBoard({ hands: [[mid], []], units: [{ card: off, side: 1, at: 0 }, { card: big, side: 1, at: 0 }] });
    const r = resolveRound(s, [[{ kind: 'play', card: 'mid', to: 0 }], []]);
    expect(ganks(r.events)[0]).toMatchObject({ blocked: true, target: null });
    expect(onBoard(r.state)).toEqual(['big', 'mid', 'off']);
    // With Tank switched off the Offlane protects nobody and can be ganked itself
    const noTank = aBoard({ rules: { abilities: { tank: false } }, hands: [[mid], []], units: [{ card: off, side: 1, at: 0 }] });
    expect(ganks(resolveRound(noTank, [[{ kind: 'play', card: 'mid', to: 0 }], []]).events)[0].target?.id).toBe('off');
  });

  it('an Offlane played the same round protects too (the gank looks at the board after the reveal)', () => {
    const mid = aCard({ id: 'mid', role: 'Mid' }); const off = aCard({ id: 'off', role: 'Offlane' });
    const big = aCard({ id: 'big', cost: 9 });
    const s = aBoard({ hands: [[mid], [off]], units: [{ card: big, side: 1, at: 0 }] });
    const r = resolveRound(s, [[{ kind: 'play', card: 'mid', to: 0 }], [{ kind: 'play', card: 'off', to: 0 }]]);
    expect(ganks(r.events)[0].blocked).toBe(true);
  });

  it('a unit that moves in the same round can be ganked; a unit that moves away cannot', () => {
    const mid = aCard({ id: 'mid', role: 'Mid' }); const runner = aCard({ id: 'runner', cost: 9 }); const stay = aCard({ id: 'stay', cost: 2 });
    const s = aBoard({ hands: [[mid], []], units: [{ card: runner, side: 1, at: 1 }, { card: stay, side: 1, at: 0 }] });
    const inn = resolveRound(s, [[{ kind: 'play', card: 'mid', to: 0 }], [{ kind: 'move', unit: '1:runner', to: 0 }]]);
    expect(ganks(inn.events)[0].target?.id).toBe('runner');
    const s2 = aBoard({ hands: [[mid], []], units: [{ card: runner, side: 1, at: 0 }, { card: stay, side: 1, at: 0 }] });
    const away = resolveRound(s2, [[{ kind: 'play', card: 'mid', to: 0 }], [{ kind: 'move', unit: '1:runner', to: 1 }]]);
    expect(ganks(away.events)[0].target?.id).toBe('stay');
  });

  it('two Mids ganking each other both succeed: ganks are decided on one snapshot', () => {
    const m0 = aCard({ id: 'm0', role: 'Mid', cost: 8 }); const m1 = aCard({ id: 'm1', role: 'Mid', cost: 8 });
    const s = aBoard({ hands: [[m0], [m1]] });
    const r = resolveRound(s, [[{ kind: 'play', card: 'm0', to: 0 }], [{ kind: 'play', card: 'm1', to: 0 }]]);
    expect(ganks(r.events).map((g) => g.target?.id).sort()).toEqual(['m0', 'm1']);
    expect(r.state.units).toHaveLength(0);
    expect(r.state.sides[0].hand.map((c) => c.id)).toEqual(['m0']);
    expect(r.state.sides[1].hand.map((c) => c.id)).toEqual(['m1']);
    expect(r.state.control[0]).toBeNull();
  });

  it('a Mid ganks even if it is ganked by a rival Mid that targets it', () => {
    const m0 = aCard({ id: 'm0', role: 'Mid', cost: 9 }); const m1 = aCard({ id: 'm1', role: 'Mid', cost: 2 });
    const x = aCard({ id: 'x', cost: 3 });
    const s = aBoard({ hands: [[m0], [m1]], units: [{ card: x, side: 0, at: 0 }] });
    const r = resolveRound(s, [[{ kind: 'play', card: 'm0', to: 0 }], [{ kind: 'play', card: 'm1', to: 0 }]]);
    const g = Object.fromEntries(ganks(r.events).map((e) => [e.mid.id, e.target?.id]));
    expect(g).toEqual({ m0: 'm1', m1: 'm0' });
    expect(onBoard(r.state)).toEqual(['x']);
  });

  it('two Mids of one side on one objective take two different units', () => {
    const ma = aCard({ id: 'ma', role: 'Mid' }); const mb = aCard({ id: 'mb', role: 'Mid' });
    const p = aCard({ id: 'p', cost: 7 }); const q = aCard({ id: 'q', cost: 4 }); const r0 = aCard({ id: 'r', cost: 2 });
    const s = aBoard({ hands: [[ma, mb], []], units: [p, q, r0].map((card) => ({ card, side: 1 as const, at: 0 as const })) });
    const r = resolveRound(s, [[{ kind: 'play', card: 'ma', to: 0 }, { kind: 'play', card: 'mb', to: 0 }], []]);
    expect(ganks(r.events).map((g) => g.target?.id)).toEqual(['p', 'q']);
  });

  it('only a Mid played from hand ganks, not one already on the board or moving', () => {
    const mid = aCard({ id: 'mid', role: 'Mid' }); const x = aCard({ id: 'x' });
    const s = aBoard({ units: [{ card: mid, side: 0, at: 1 }, { card: x, side: 1, at: 0 }] });
    const r = resolveRound(s, [[{ kind: 'move', unit: '0:mid', to: 0 }], []]);
    expect(ganks(r.events)).toHaveLength(0);
  });

  it('a ganked unit goes to the graveyard when its owner\'s hand is full', () => {
    const mid = aCard({ id: 'mid', role: 'Mid' }); const x = aCard({ id: 'x' });
    const fullHand = Array.from({ length: 7 }, () => aCard());
    const s = aBoard({ hands: [[mid], fullHand], units: [{ card: x, side: 1, at: 0 }] });
    const r = resolveRound(s, [[{ kind: 'play', card: 'mid', to: 0 }], []]);
    expect(ganks(r.events)[0].toHand).toBe(false);
    expect(r.state.sides[1].grave.map((c) => c.id)).toEqual(['x']);
  });

  it('a gank changes who controls the objective this round', () => {
    const mid = aCard({ id: 'mid', role: 'Mid', cost: 2 }); const x = aCard({ id: 'x', cost: 9 });
    const s = aBoard({ hands: [[mid], []], units: [{ card: x, side: 1, at: 0 }] });
    const r = resolveRound(s, [[{ kind: 'play', card: 'mid', to: 0 }], []]);
    expect(r.state.control[0]).toBe(0);
  });
});
