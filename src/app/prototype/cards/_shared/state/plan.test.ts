import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES } from '@/features/cards/domain/v2/rules';
import { aBoard, aCard } from '@/features/cards/domain/v2/testing';
import type { MatchState } from '@/features/cards/domain/v2/types';
import { viewFor } from '@/features/cards/domain/v2/view';
import { actors, EMPTY_PLAN, planScene, reducePlan, targetsOf, type PlanAction, type PlanState } from './plan';
import { ME, RIVAL } from './scene';

const run = (s: MatchState, ...actions: PlanAction[]): PlanState => actions.reduce((ps, a) => reducePlan(ps, a, s, ME), EMPTY_PLAN);
const card = (id: string) => ({ kind: 'card' as const, id });
const unit = (uid: string) => ({ kind: 'unit' as const, uid });

function board() {
  const hand = [aCard({ id: 'h1', cost: 6 }), aCard({ id: 'h2', role: 'Mid', cost: 4 }), aCard({ id: 'h3', role: 'Offlane', cost: 3 })];
  const a = aCard({ id: 'a', cost: 5 }); const b = aCard({ id: 'b', role: 'Mid', cost: 4 }); const c = aCard({ id: 'c', role: 'Offlane', cost: 2 });
  const d = aCard({ id: 'd', role: 'Hard Support', cost: 3 });
  const r = aCard({ id: 'r', cost: 7 });
  return aBoard({
    rules: DEFAULT_RULES, hands: [hand, []],
    units: [{ card: a, side: ME, at: 0 }, { card: b, side: ME, at: 0 }, { card: c, side: ME, at: 0 }, { card: d, side: ME, at: 1 }, { card: r, side: RIVAL, at: 0 }],
  });
}

describe('plan reducer', () => {
  it('adds a play by drag and by tap-then-tap, and counts the order', () => {
    const s = board();
    const dragged = run(s, { type: 'drop', ref: card('h1'), to: 1 });
    expect(dragged.plan).toEqual([{ kind: 'play', card: 'h1', to: 1 }]);
    const tapped = run(s, { type: 'pick', ref: card('h1') }, { type: 'send', to: 1 });
    expect(tapped.plan).toEqual(dragged.plan);
    expect(tapped.pick).toBeNull();
    expect(planScene(viewFor(s, ME), tapped.plan).orders).toEqual({ have: 2, used: 1 });
  });

  it('tapping the picked thing again puts it down', () => {
    const ps = run(board(), { type: 'pick', ref: card('h1') }, { type: 'pick', ref: card('h1') });
    expect(ps.pick).toBeNull();
    expect(ps.refused).toBe(0);
  });

  it('refuses an action beyond the orders and leaves the plan as it was', () => {
    const s = board();
    const two = run(s, { type: 'drop', ref: card('h1'), to: 1 }, { type: 'drop', ref: card('h2'), to: 2 });
    const three = reducePlan(two, { type: 'drop', ref: card('h3'), to: 2 }, s, ME);
    expect(three.plan).toEqual(two.plan);
    expect(three.refused).toBe(two.refused + 1);
    expect(actors(s, ME, two.plan)).toEqual({ cards: new Set(), units: new Set() });
  });

  it('refuses what is not the player’s to order', () => {
    const s = board();
    expect(run(s, { type: 'pick', ref: card('nope') }).refused).toBe(1);
    expect(run(s, { type: 'drop', ref: unit('1:r'), to: 2 }).refused).toBe(1);
    expect(run(s, { type: 'drop', ref: unit('0:d'), to: 1 }).refused).toBe(1); // already there
    expect(run(s, { type: 'drop', ref: unit('0:d'), to: 0 }).refused).toBe(1); // objective full, a move cannot replace
  });

  it('asks which unit makes room on a full objective, then replaces it', () => {
    const s = board();
    expect(targetsOf(s, ME, [], card('h1'))).toEqual(['replace', 'ok', 'ok']);
    const asked = run(s, { type: 'drop', ref: card('h1'), to: 0 });
    expect(asked.plan).toEqual([]);
    expect(asked.ask).toEqual({ to: 0, options: ['0:a', '0:b', '0:c'] });
    expect(asked.pick).toEqual(card('h1'));
    const done = reducePlan(asked, { type: 'send', to: 0, replace: '0:c' }, s, ME);
    expect(done.plan).toEqual([{ kind: 'play', card: 'h1', to: 0, replace: '0:c' }]);
    expect(done.ask).toBeNull();
    const scene = planScene(viewFor(s, ME), done.plan);
    expect(scene.units.filter((u) => u.side === ME && u.at === 0).map((u) => u.uid).sort()).toEqual(['0:a', '0:b', '0:h1']);
    // A unit that does not stand there cannot make room
    expect(reducePlan(asked, { type: 'send', to: 0, replace: '0:d' }, s, ME).refused).toBe(1);
  });

  it('a new order for the same card or unit replaces its old one', () => {
    const s = board();
    const ps = run(s, { type: 'drop', ref: card('h1'), to: 1 }, { type: 'drop', ref: card('h1'), to: 2 }, { type: 'drop', ref: unit('0:a'), to: 1 }, { type: 'drop', ref: unit('0:a'), to: 2 });
    expect(ps.plan).toEqual([{ kind: 'play', card: 'h1', to: 2 }, { kind: 'move', unit: '0:a', to: 2 }]);
  });

  it('sending a moved unit back to where it stands takes the move back', () => {
    const s = board();
    const ps = run(s, { type: 'drop', ref: unit('0:a'), to: 2 }, { type: 'drop', ref: unit('0:a'), to: 0 });
    expect(ps.plan).toEqual([]);
    expect(ps.refused).toBe(0);
  });

  it('undoes the last action, or the action of one card or unit', () => {
    const s = board();
    const two = run(s, { type: 'drop', ref: card('h1'), to: 1 }, { type: 'drop', ref: unit('0:a'), to: 2 });
    expect(reducePlan(two, { type: 'undo' }, s, ME).plan).toEqual([{ kind: 'play', card: 'h1', to: 1 }]);
    expect(reducePlan(two, { type: 'undo', ref: card('h1') }, s, ME).plan).toEqual([{ kind: 'move', unit: '0:a', to: 2 }]);
    expect(reducePlan(two, { type: 'clear' }, s, ME).plan).toEqual([]);
  });

  it('an undo never leaves a plan the engine would refuse', () => {
    const s = board();
    // The move makes room on objective 0 for the card; without the move the play is illegal
    const ps = run(s, { type: 'drop', ref: unit('0:a'), to: 2 }, { type: 'drop', ref: card('h1'), to: 0 });
    expect(ps.plan).toHaveLength(2);
    expect(reducePlan(ps, { type: 'undo', ref: unit('0:a') }, s, ME).plan).toEqual([]);
  });

  it('a unit that Smoke can bring along still glows when the orders are spent', () => {
    const ss = aCard({ id: 'ss', role: 'Soft Support', cost: 3 });
    const s = aBoard({ rules: DEFAULT_RULES, hands: [[ss, aCard({ id: 'x', cost: 4 })], []], units: [{ card: aCard({ id: 'a', cost: 5 }), side: ME, at: 0 }] });
    const ps = run(s, { type: 'drop', ref: card('ss'), to: 1 }, { type: 'drop', ref: card('x'), to: 2 });
    expect(planScene(viewFor(s, ME), ps.plan).orders.used).toBe(2);
    expect(actors(s, ME, ps.plan).units).toEqual(new Set(['0:a']));
    expect(targetsOf(s, ME, ps.plan, unit('0:a'))).toEqual([null, 'ok', null]);
    const moved = reducePlan(ps, { type: 'drop', ref: unit('0:a'), to: 1 }, s, ME);
    expect(moved.plan).toHaveLength(3);
    expect(planScene(viewFor(s, ME), moved.plan).orders.used).toBe(2);
  });
});

describe('the planning scene', () => {
  it('shows the player’s side as planned, own totals only, and nothing of the rival’s round', () => {
    const s = board();
    const ps = run(s, { type: 'drop', ref: card('h1'), to: 2 }, { type: 'drop', ref: unit('0:b'), to: 2 });
    const scene = planScene(viewFor(s, ME), ps.plan);
    expect(scene.units.find((u) => u.uid === '0:h1')).toMatchObject({ at: 2, planned: 'play' });
    expect(scene.units.find((u) => u.uid === '0:b')).toMatchObject({ at: 2, planned: 'move' });
    expect(scene.units.find((u) => u.uid === '0:a')?.planned).toBeUndefined();
    expect(scene.hand.map((c) => c.id)).toEqual(['h2', 'h3']);
    for (const [at, o] of scene.objectives.entries()) {
      const sum = scene.units.filter((u) => u.side === ME && u.at === at).reduce((a, u) => a + u.strength, 0);
      expect(o.totals).toEqual([sum, null]);
    }
    // The played Mid would gank the rival's unit, but that is the reveal's business
    const gank = planScene(viewFor(s, ME), run(s, { type: 'drop', ref: card('h2'), to: 0, replace: '0:c' }).plan);
    expect(gank.units.every((u) => !u.out)).toBe(true);
  });
});
