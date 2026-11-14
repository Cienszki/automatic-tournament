import { describe, expect, it } from 'vitest';
import { baseMight } from '@/lib/card-lab/outposts';
import { cost, deckCost, deckProblem } from './deck';
import { DEFAULT_RULES, makeRules } from './rules';
import { aCard } from './testing';

const ROLES = ['Carry', 'Mid', 'Offlane', 'Soft Support', 'Hard Support'] as const;
const legal = () => Array.from({ length: 12 }, (_, i) => aCard({ role: ROLES[i % 5], cost: 5 }));

describe('deck rules', () => {
  it('costs a card its rating strength, without role or TOTW bonus', () => {
    const off = aCard({ role: 'Offlane', cost: 6, totw: true });
    expect(cost(off)).toBe(6);
    expect(baseMight(off)).toBe(8);
    expect(cost(aCard({ role: 'Hard Support', cost: 6 }))).toBe(6);
  });

  it('accepts 12 cards with every role, distinct players, within the budget', () => {
    const d = legal();
    expect(deckCost(d)).toBe(60);
    expect(deckProblem(d, DEFAULT_RULES)).toBeNull();
  });

  it('refuses a wrong size', () => {
    expect(deckProblem(legal().slice(1), DEFAULT_RULES)).toMatch(/11 cards/);
  });

  it('refuses a missing role', () => {
    const d = legal().map((c) => (c.role === 'Mid' ? aCard({ role: 'Carry', cost: 5 }) : c));
    expect(deckProblem(d, makeRules({ maxPerRole: Infinity }))).toMatch(/Mid/);
  });

  it('refuses two cards of one player and team', () => {
    const d = legal();
    d[11] = aCard({ role: d[11].role, pid: d[0].pid, team: undefined });
    expect(deckProblem(d, DEFAULT_RULES)).toMatch(/one card per player/);
  });

  it('refuses a deck over the budget, and accepts it with the budget off', () => {
    const d = legal();
    d[0] = aCard({ role: d[0].role, cost: 9 });
    d[1] = aCard({ role: d[1].role, cost: 9 });
    expect(deckCost(d)).toBe(68);
    expect(deckProblem(d, makeRules({ costMode: 'rating', budget: 66 }))).toMatch(/budget is 66/);
    expect(deckProblem(d, makeRules({ budget: Infinity }))).toBeNull();
  });
});
