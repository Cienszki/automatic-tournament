import { describe, expect, it } from 'vitest';
import { freeMoves, planCost, validatePlan } from './plan';
import { aBoard, aCard } from './testing';

describe('plans: orders', () => {
  it('a play costs one order and a move costs one order', () => {
    const a = aCard(); const b = aCard(); const u = aCard();
    const s = aBoard({ hands: [[a, b], []], units: [{ card: u, side: 0, at: 0 }] });
    expect(planCost(s, 0, [{ kind: 'play', card: a.id, to: 1 }, { kind: 'move', unit: `0:${u.id}`, to: 2 }])).toBe(2);
    expect(validatePlan(s, 0, [{ kind: 'play', card: a.id, to: 1 }, { kind: 'move', unit: `0:${u.id}`, to: 2 }])).toBeNull();
  });

  it('refuses a plan that needs more orders than the side has', () => {
    const [a, b, c] = [aCard(), aCard(), aCard()];
    const s = aBoard({ hands: [[a, b, c], []] });
    expect(validatePlan(s, 0, [0, 1, 2].map((i) => ({ kind: 'play' as const, card: [a, b, c][i].id, to: 0 as const }))))
      .toMatch(/needs 3 orders/);
    expect(validatePlan({ ...s, orders: [3, 2] }, 0, [0, 1, 2].map((i) => ({ kind: 'play' as const, card: [a, b, c][i].id, to: 0 as const }))))
      .toBeNull();
  });

  it('refuses a card not in hand, a card played twice, and an unknown unit', () => {
    const a = aCard();
    const s = aBoard({ hands: [[a], []] });
    expect(validatePlan(s, 0, [{ kind: 'play', card: 'nope', to: 0 }])).toMatch(/not in hand/);
    expect(validatePlan(s, 0, [{ kind: 'play', card: a.id, to: 0 }, { kind: 'play', card: a.id, to: 1 }])).toMatch(/twice/);
    expect(validatePlan(s, 0, [{ kind: 'move', unit: '1:x', to: 0 }])).toMatch(/not an own unit/);
  });

  it('a unit moves at most once, to another objective, and not the round it was played', () => {
    const u = aCard(); const h = aCard();
    const s = aBoard({ hands: [[h], []], units: [{ card: u, side: 0, at: 0 }] });
    const uid = `0:${u.id}`;
    expect(validatePlan(s, 0, [{ kind: 'move', unit: uid, to: 1 }, { kind: 'move', unit: uid, to: 2 }])).toMatch(/moves twice/);
    expect(validatePlan(s, 0, [{ kind: 'move', unit: uid, to: 0 }])).toMatch(/already there/);
    // A card played this round is not a unit yet, so it cannot be moved
    expect(validatePlan(s, 0, [{ kind: 'play', card: h.id, to: 0 }, { kind: 'move', unit: `0:${h.id}`, to: 1 }])).toMatch(/not an own unit/);
  });
});

describe('plans: Smoke and Twin Gates', () => {
  it('Smoke makes one move from where a Soft Support stood free, the Support itself included', () => {
    const sup = aCard({ role: 'Soft Support' }); const x = aCard(); const y = aCard();
    const s = aBoard({ units: [{ card: sup, side: 0, at: 0 }, { card: x, side: 0, at: 0 }, { card: y, side: 0, at: 1 }] });
    expect(planCost(s, 0, [{ kind: 'move', unit: `0:${sup.id}`, to: 2 }])).toBe(0);
    expect(planCost(s, 0, [{ kind: 'move', unit: `0:${x.id}`, to: 2 }])).toBe(0);
    expect(planCost(s, 0, [{ kind: 'move', unit: `0:${sup.id}`, to: 2 }, { kind: 'move', unit: `0:${x.id}`, to: 2 }])).toBe(1);
    expect(planCost(s, 0, [{ kind: 'move', unit: `0:${y.id}`, to: 2 }])).toBe(1);
  });

  it('Smoke is off when the ability is switched off', () => {
    const sup = aCard({ role: 'Soft Support' });
    const s = aBoard({ rules: { abilities: { smoke: false } }, units: [{ card: sup, side: 0, at: 0 }] });
    expect(planCost(s, 0, [{ kind: 'move', unit: `0:${sup.id}`, to: 2 }])).toBe(1);
  });

  it('Twin Gates controlled last round gives a separate free move from the Gates', () => {
    const sup = aCard({ role: 'Soft Support' }); const g1 = aCard(); const g2 = aCard();
    // objectives: outpost, gates, lotus -> gates is slot 1
    const s = aBoard({ control: [null, 0, null], units: [{ card: sup, side: 0, at: 0 }, { card: g1, side: 0, at: 1 }, { card: g2, side: 0, at: 1 }] });
    const plan = [{ kind: 'move' as const, unit: `0:${sup.id}`, to: 2 as const }, { kind: 'move' as const, unit: `0:${g1.id}`, to: 2 as const }];
    expect(planCost(s, 0, plan)).toBe(0);
    expect([...freeMoves(s, 0, plan).values()].sort()).toEqual(['gates', 'smoke']);
    expect(planCost(s, 0, [{ kind: 'move', unit: `0:${g1.id}`, to: 2 }, { kind: 'move', unit: `0:${g2.id}`, to: 2 }])).toBe(1);
    expect(planCost({ ...s, control: [null, 1, null] }, 0, [{ kind: 'move', unit: `0:${g1.id}`, to: 2 }])).toBe(1);
  });

  it('one unit never takes both free moves', () => {
    const sup = aCard({ role: 'Soft Support' });
    const s = aBoard({ control: [null, 0, null], units: [{ card: sup, side: 0, at: 1 }] });
    const x = aCard();
    const s2 = aBoard({ control: [null, 0, null], hands: [[x], []], units: [{ card: sup, side: 0, at: 1 }] });
    expect(freeMoves(s, 0, [{ kind: 'move', unit: `0:${sup.id}`, to: 0 }]).size).toBe(1);
    expect(planCost(s2, 0, [{ kind: 'move', unit: `0:${sup.id}`, to: 0 }, { kind: 'play', card: x.id, to: 0 }])).toBe(1);
  });
});

describe('plans: capacity and replace', () => {
  const full = () => {
    const [a, b, c] = [aCard({ cost: 2 }), aCard(), aCard()];
    const h = aCard({ cost: 9 });
    return { a, b, c, h, s: aBoard({ hands: [[h], []], units: [a, b, c].map((card) => ({ card, side: 0 as const, at: 0 as const })) }) };
  };

  it('refuses a play onto a full objective without a replace', () => {
    const { h, s } = full();
    expect(validatePlan(s, 0, [{ kind: 'play', card: h.id, to: 0 }])).toMatch(/more than 3/);
  });

  it('a replace names an own unit there and makes room', () => {
    const { a, h, s } = full();
    expect(validatePlan(s, 0, [{ kind: 'play', card: h.id, to: 0, replace: `0:${a.id}` }])).toBeNull();
    expect(validatePlan(s, 0, [{ kind: 'play', card: h.id, to: 0, replace: '1:zzz' }])).toMatch(/not an own unit/);
  });

  it('refuses a replace that is not needed, and every replace when replacing is off', () => {
    const { a, h, s } = full();
    expect(validatePlan(s, 0, [{ kind: 'play', card: h.id, to: 1, replace: `0:${a.id}` }])).toMatch(/not an own unit on that objective/);
    const b = aCard();
    const roomy = aBoard({ hands: [[h], []], units: [{ card: a, side: 0, at: 0 }, { card: b, side: 0, at: 0 }] });
    expect(validatePlan(roomy, 0, [{ kind: 'play', card: h.id, to: 0, replace: `0:${a.id}` }])).toMatch(/not needed/);
    const off = { ...s, rules: { ...s.rules, replace: false } };
    expect(validatePlan(off, 0, [{ kind: 'play', card: h.id, to: 0, replace: `0:${a.id}` }])).toMatch(/switched off/);
  });

  it('capacity counts the end of the plan: moving one out makes room for a play', () => {
    const { a, h, s } = full();
    expect(validatePlan(s, 0, [{ kind: 'move', unit: `0:${a.id}`, to: 1 }, { kind: 'play', card: h.id, to: 0 }])).toBeNull();
    // ...and a replace is then not needed
    expect(validatePlan(s, 0, [{ kind: 'move', unit: `0:${a.id}`, to: 1 }, { kind: 'play', card: h.id, to: 0, replace: `0:${a.id}` }])).not.toBeNull();
  });

  it('capacity is per side: the rival may also have three there', () => {
    const { h, s } = full();
    const rivals = [aCard(), aCard(), aCard()].map((card) => ({ ...s.units[0], uid: `1:${card.id}`, card, side: 1 as const }));
    const both = { ...s, units: [...s.units, ...rivals], sides: [s.sides[0], { ...s.sides[1], hand: [aCard({ id: 'r9' })] }] as typeof s.sides };
    expect(validatePlan(both, 1, [{ kind: 'play', card: 'r9', to: 0 }])).toMatch(/more than 3/);
    expect(validatePlan(both, 1, [{ kind: 'play', card: 'r9', to: 1 }])).toBeNull();
    expect(validatePlan(both, 0, [{ kind: 'play', card: h.id, to: 1 }])).toBeNull();
  });

  it('a discarded unit cannot also move', () => {
    const { a, h, s } = full();
    expect(validatePlan(s, 0, [{ kind: 'play', card: h.id, to: 0, replace: `0:${a.id}` }, { kind: 'move', unit: `0:${a.id}`, to: 1 }]))
      .toMatch(/discarded and moved/);
  });
});
