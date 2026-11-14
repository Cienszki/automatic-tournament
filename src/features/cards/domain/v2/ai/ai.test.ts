import { describe, expect, it } from 'vitest';
import { validatePlan, planCost } from '../plan';
import { aBoard, aCard } from '../testing';
import { viewFor } from '../view';
import type { MatchState } from '../types';
import { candidateActions, planKey } from './actions';
import { makeAgent } from './agents';
import { evaluate } from './evaluate';
import { guessState } from './guess';
import { plannerDecide } from './planner';
import { mulberry32 } from './rng';
import { beamSearch } from './search';

const ROLES = ['Carry', 'Mid', 'Offlane', 'Soft Support', 'Hard Support'] as const;
const pool = Array.from({ length: 40 }, (_, i) => aCard({ id: `pool${i}`, role: ROLES[i % 5], cost: 3 + (i % 5) }));

function midGame(): MatchState {
  const mine = [aCard({ id: 'm1', cost: 7 }), aCard({ id: 'm2', role: 'Mid', cost: 6 }), aCard({ id: 'm3', role: 'Offlane', cost: 4 })];
  const theirs = [aCard({ id: 't1', cost: 6 }), aCard({ id: 't2', role: 'Hard Support', cost: 5 }), aCard({ id: 't3', cost: 5 })];
  return aBoard({
    hands: [mine, theirs], decks: [[aCard({ id: 'md' })], [aCard({ id: 'td' })]],
    units: [{ card: aCard({ id: 'u0', cost: 5 }), side: 0, at: 0 }, { card: aCard({ id: 'u1', cost: 6 }), side: 1, at: 1 }],
  });
}

describe('candidate actions', () => {
  it('are all legal on their own and count equal hand cards once', () => {
    const twins = [aCard({ id: 'a', cost: 5 }), aCard({ id: 'b', cost: 5 })];
    const s = aBoard({ hands: [twins, []] });
    const acts = candidateActions(s, 0, []);
    expect(acts.every((a) => validatePlan(s, 0, [a]) === null)).toBe(true);
    expect(acts).toHaveLength(3);
  });

  it('write the same plan in any order as one key', () => {
    expect(planKey([{ kind: 'play', card: 'x', to: 0 }, { kind: 'move', unit: 'u', to: 1 }])).toBe(planKey([{ kind: 'move', unit: 'u', to: 1 }, { kind: 'play', card: 'x', to: 0 }]));
  });
});

describe('evaluation', () => {
  it('is the same number with the sign flipped for the other side', () => {
    const s = midGame();
    expect(evaluate(s, 0)).toBeCloseTo(-evaluate(s, 1));
  });
  it('scores a won match far above anything else', () => {
    const s = { ...midGame(), result: { winner: 0 as const, reason: 'ancient' as const, round: 3 } };
    expect(evaluate(s, 0)).toBe(1000);
    expect(evaluate(s, 1)).toBe(-1000);
  });
});

describe('search', () => {
  it('finds the plan that destroys the rival Ancient this round', () => {
    const s = aBoard({ hp: [12, 2], hands: [[aCard({ id: 'a', cost: 2 }), aCard({ id: 'b', cost: 2 })], []], units: [{ card: aCard({ id: 'big', cost: 9 }), side: 1, at: 0 }] });
    const best = beamSearch(0, [{ state: s, plan: [], weight: 1 }])[0];
    expect(best.score).toBe(1000);
    expect(new Set(best.plan.map((a) => a.to)).size).toBe(2);
    expect(best.plan.every((a) => a.to !== 0)).toBe(true);
  });
});

describe('guessing the rival hand', () => {
  it('keeps the public board and own cards, and the rival hand size', () => {
    const s = midGame();
    const g = guessState(viewFor(s, 0), pool, mulberry32(1));
    expect(g.units).toEqual(s.units);
    expect(g.sides[0].hand).toEqual(s.sides[0].hand);
    expect(g.sides[1].hand).toHaveLength(3);
    expect(g.sides[1].hand.some((c) => c.id.startsWith('t'))).toBe(false);
  });
});

describe('computer players', () => {
  it('never depend on the rival\'s hidden hand', () => {
    const s = midGame();
    const other: MatchState = { ...s, sides: [s.sides[0], { ...s.sides[1], hand: [aCard({ id: 'zz', cost: 9 }), aCard({ cost: 1 }), aCard({ cost: 1 })] }] };
    for (const name of ['greedy', 'responder', 'planner'] as const) {
      const a = makeAgent(name, { pool, seed: 4 }).decide(viewFor(s, 0)).plan;
      const b = makeAgent(name, { pool, seed: 4 }).decide(viewFor(other, 0)).plan;
      expect(planKey(a)).toBe(planKey(b));
    }
  });

  it('random spends all its orders when it can', () => {
    const s = midGame();
    const plan = makeAgent('random', { pool, seed: 9 }).decide(viewFor(s, 0)).plan;
    expect(validatePlan(s, 0, plan)).toBeNull();
    expect(planCost(s, 0, plan)).toBe(2);
  });

  it('every player makes legal plans', () => {
    const s = midGame();
    for (const name of ['random', 'greedy', 'responder', 'planner', 'planner-mixed', 'exploiter'] as const) {
      for (const side of [0, 1] as const) expect(validatePlan(s, side, makeAgent(name, { pool, seed: 2 }).decide(viewFor(s, side)).plan)).toBeNull();
    }
    const omni = makeAgent('omniscient', { pool, seed: 2 }).decide(viewFor(s, 0), { state: s, rivalPlan: [{ kind: 'play', card: 't1', to: 0 }] });
    expect(validatePlan(s, 0, omni.plan)).toBeNull();
  });

  it('the planner is repeatable from public information, so an exploiter can predict it exactly', () => {
    const s = midGame();
    const a = makeAgent('planner', { pool, seed: 1 }).decide(viewFor(s, 1));
    const b = plannerDecide(viewFor(s, 1), pool);
    expect(planKey(a.plan)).toBe(planKey(b.plan));
    expect(a.greedy).toBeDefined();
  });

  it('omniscient answers a rival plan it is shown', () => {
    // The rival stacks Lotus (slot 2); knowing it, side 0 avoids losing a fight there
    const s = aBoard({ hands: [[aCard({ id: 'a', cost: 5 }), aCard({ id: 'b', cost: 5 })], [aCard({ id: 'x', cost: 9 }), aCard({ id: 'y', cost: 9 })]] });
    const rivalPlan = [{ kind: 'play' as const, card: 'x', to: 2 as const }, { kind: 'play' as const, card: 'y', to: 2 as const }];
    const plan = makeAgent('omniscient', { pool, seed: 1 }).decide(viewFor(s, 0), { state: s, rivalPlan }).plan;
    expect(plan.every((a) => a.to !== 2)).toBe(true);
  });
});
