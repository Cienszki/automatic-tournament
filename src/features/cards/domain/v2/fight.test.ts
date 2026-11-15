// The fight step: after the reveal each player names a rival unit to hit and an own unit to guard.
import { describe, expect, it } from 'vitest';
import { contested, obviousStrikes, strikeOptions, validateStrikes } from './fight';
import { finishRound, resolveRound, revealRound } from './resolve';
import { aBoard, aCard } from './testing';
import type { MatchEvent } from './types';

const control = (events: MatchEvent[], at: number) => events.find((e): e is Extract<MatchEvent, { kind: 'control' }> => e.kind === 'control' && e.at === at)!;
const strikes = (events: MatchEvent[]) => events.filter((e): e is Extract<MatchEvent, { kind: 'strike' }> => e.kind === 'strike');

const a9 = aCard({ id: 'a9', cost: 9 }); const a2 = aCard({ id: 'a2', cost: 2 });
const b6 = aCard({ id: 'b6', cost: 6 }); const b4 = aCard({ id: 'b4', cost: 4 });
const board = (rules = {}) => aBoard({
  rules: { fight: 'oneStrike', hitEffect: 3, ...rules },
  units: [{ card: a9, side: 0, at: 0 }, { card: a2, side: 0, at: 0 }, { card: b6, side: 1, at: 0 }, { card: b4, side: 1, at: 0 }],
});

describe('fight step: one hit and one guard a round', () => {
  it('a hit that is not guarded weakens its target for this round only', () => {
    const s = board();
    // 11 against 10 before the fight; side 1 hits the 9, side 0 hits nothing
    const out = finishRound(s, [[], [{ at: 0, target: '0:a9' }]]);
    expect(control(out.events, 0)).toMatchObject({ power: [8, 10], controller: 1 });
    // Next round the unit is whole again (side 1's two Carries farmed +1 each meanwhile)
    const next = finishRound(out.state, [[], []]);
    expect(control(next.events, 0).power).toEqual([11, 12]);
  });

  it('a guarded unit takes nothing, and the event says so', () => {
    const out = finishRound(board(), [[{ at: 0, guard: '0:a9' }], [{ at: 0, target: '0:a9' }]]);
    expect(control(out.events, 0)).toMatchObject({ power: [11, 10] });
    expect(strikes(out.events).find((e) => e.side === 1)).toMatchObject({ guarded: true });
  });

  it('both hits are decided on the same board: a unit that is hit still hits', () => {
    const out = finishRound(board(), [[{ at: 0, target: '1:b6' }], [{ at: 0, target: '0:a9' }]]);
    expect(control(out.events, 0)).toMatchObject({ power: [8, 7], controller: 0 });
  });

  it('strength never goes below zero, and with hitEffect out the unit counts for nothing', () => {
    const weak = finishRound(board(), [[], [{ at: 0, target: '0:a2' }]]);
    expect(control(weak.events, 0)).toMatchObject({ power: [9, 10] });
    const out = finishRound(board({ hitEffect: 'out' }), [[], [{ at: 0, target: '0:a9' }]]);
    expect(control(out.events, 0)).toMatchObject({ power: [2, 10] });
  });

  it('an Offlane cannot be hit', () => {
    const off = aCard({ id: 'off', role: 'Offlane', cost: 5 });
    const s = aBoard({ rules: { fight: 'oneStrike', hitEffect: 3 }, units: [{ card: off, side: 0, at: 0 }, { card: b6, side: 1, at: 0 }] });
    expect(validateStrikes(s, 1, [{ at: 0, target: '0:off' }])).toMatch(/cannot be hit/);
    // An illegal strike counts as no strike
    const out = finishRound(s, [[], [{ at: 0, target: '0:off' }]]);
    expect(control(out.events, 0)).toMatchObject({ power: [6, 6] });
  });

  it('only units on objectives where both sides stand can be hit', () => {
    const lone = aCard({ id: 'lone', cost: 5 });
    const s = aBoard({ rules: { fight: 'oneStrike', hitEffect: 3 }, units: [{ card: lone, side: 0, at: 1 }, { card: a9, side: 0, at: 0 }, { card: b6, side: 1, at: 0 }] });
    expect(contested(s)).toEqual([0]);
    const out = finishRound(s, [[], [{ at: 1, target: '0:lone' }]]);
    expect(control(out.events, 1)).toMatchObject({ power: [5, 0], controller: 0 });
  });

  it('a unit put out by a gank this round cannot be hit or guarded', () => {
    const mid = aCard({ id: 'mid', role: 'Mid', cost: 3 });
    const s = aBoard({ rules: { fight: 'oneStrike', hitEffect: 3, gankEffect: 'out' }, hands: [[mid], []], units: [{ card: b6, side: 1, at: 0 }, { card: b4, side: 1, at: 0 }] });
    const mid2 = revealRound(s, [[{ kind: 'play', card: 'mid', to: 0 }], []]).state;
    expect(strikeOptions(mid2, 0, 0).map((o) => o.target)).toEqual(['1:b4']);
  });

  it('without strikes given, both sides take the plain choice: hit the strongest, guard the own strongest', () => {
    const s = board();
    expect(obviousStrikes(s, 1)).toEqual([{ at: 0, target: '0:a9' }, { at: 0, guard: '1:b6' }]);
    // Both guard what the other hits, so nothing lands
    const out = resolveRound(s, [[], []]);
    expect(control(out.events, 0)).toMatchObject({ power: [11, 10] });
  });
});

describe('fight step on every contested objective (the first variant)', () => {
  it('each side names a hit and a guard per objective', () => {
    const c5 = aCard({ id: 'c5', cost: 5 }); const d5 = aCard({ id: 'd5', cost: 5 });
    const s = aBoard({
      rules: { fight: 'hitGuard', hitEffect: 'out' },
      units: [{ card: a9, side: 0, at: 0 }, { card: b6, side: 1, at: 0 }, { card: c5, side: 0, at: 2 }, { card: d5, side: 1, at: 2 }],
    });
    const out = finishRound(s, [[{ at: 0, target: '1:b6' }, { at: 2, guard: '0:c5' }], [{ at: 0, guard: '1:b6' }, { at: 2, target: '0:c5' }]]);
    expect(control(out.events, 0)).toMatchObject({ power: [9, 6] });
    expect(control(out.events, 2)).toMatchObject({ power: [5, 5], controller: null });
  });
});

describe('no fight step', () => {
  it('strikes are ignored when the rules have none', () => {
    const s = aBoard({ units: [{ card: a9, side: 0, at: 0 }, { card: b6, side: 1, at: 0 }] });
    const out = finishRound(s, [[], [{ at: 0, target: '0:a9' }]]);
    expect(control(out.events, 0)).toMatchObject({ power: [9, 6] });
    expect(strikes(out.events)).toHaveLength(0);
  });
});
