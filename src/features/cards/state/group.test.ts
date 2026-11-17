import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES } from '@/features/cards/domain/v2/rules';
import { aBoard, aCard } from '@/features/cards/domain/v2/testing';
import type { MatchState } from '@/features/cards/domain/v2/types';
import { viewFor } from '@/features/cards/domain/v2/view';
import { freeOffers, targetInfo } from './place';
import { EMPTY_PLAN, planScene, reducePlan, type PlanAction, type PlanState } from './plan';
import { ME, RIVAL } from './scene';

const run = (s: MatchState, ...actions: PlanAction[]): PlanState => actions.reduce((ps, a) => reducePlan(ps, a, s, ME), EMPTY_PLAN);
const card = (id: string) => ({ kind: 'card' as const, id });
const unit = (uid: string) => ({ kind: 'unit' as const, uid });

/** Three places per side; objective 0 is full of the player's units, objective 1 has one */
function board(orders: [number, number] = [2, 2]) {
  const hand = [aCard({ id: 'h1', cost: 6 }), aCard({ id: 'h2', role: 'Hard Support', cost: 4 }), aCard({ id: 'h3', role: 'Offlane', cost: 3 })];
  return aBoard({
    rules: { ...DEFAULT_RULES, capacity: 3 }, hands: [hand, []], orders,
    units: [
      { card: aCard({ id: 'a', cost: 5 }), side: ME, at: 0 }, { card: aCard({ id: 'b', role: 'Mid', cost: 4 }), side: ME, at: 0 },
      { card: aCard({ id: 'c', role: 'Offlane', cost: 2 }), side: ME, at: 0 }, { card: aCard({ id: 'd', role: 'Hard Support', cost: 3 }), side: ME, at: 1 },
      { card: aCard({ id: 'r', cost: 7 }), side: RIVAL, at: 0 },
    ],
  });
}

describe('picking several things at once', () => {
  it('cards add up to a group, capped by the orders left, and one tap sends them all', () => {
    const s = board();
    const two = run(s, { type: 'pick', ref: card('h1') }, { type: 'pick', ref: card('h2') });
    expect(two.picks).toEqual([card('h1'), card('h2')]);
    const three = reducePlan(two, { type: 'pick', ref: card('h3') }, s, ME);
    expect(three.picks).toEqual(two.picks);
    expect(three.refused).toBe(1);
    expect(three.why).toBe('Masz 2 rozkazy');
    const sent = reducePlan(two, { type: 'send', to: 2 }, s, ME);
    expect(sent.plan).toEqual([{ kind: 'play', card: 'h1', to: 2 }, { kind: 'play', card: 'h2', to: 2 }]);
    expect(sent.picks).toEqual([]);
  });

  it('with three orders a third card joins the group', () => {
    const s = board([3, 2]);
    const ps = run(s, { type: 'pick', ref: card('h1') }, { type: 'pick', ref: card('h2') }, { type: 'pick', ref: card('h3') }, { type: 'send', to: 2 });
    expect(ps.plan).toHaveLength(3);
  });

  it('a second tap takes one thing out of the group; nothing picked puts all down', () => {
    const s = board();
    const ps = run(s, { type: 'pick', ref: card('h1') }, { type: 'pick', ref: card('h2') }, { type: 'pick', ref: card('h1') });
    expect(ps.picks).toEqual([card('h2')]);
    expect(reducePlan(ps, { type: 'pick', ref: null }, s, ME).picks).toEqual([]);
  });

  it('units from one objective make a group; a unit from elsewhere or a card starts a new one', () => {
    const s = board();
    const ab = run(s, { type: 'pick', ref: unit('0:a') }, { type: 'pick', ref: unit('0:b') });
    expect(ab.picks).toEqual([unit('0:a'), unit('0:b')]);
    expect(reducePlan(ab, { type: 'pick', ref: unit('0:d') }, s, ME).picks).toEqual([unit('0:d')]);
    expect(reducePlan(ab, { type: 'pick', ref: card('h1') }, s, ME).picks).toEqual([card('h1')]);
    const moved = reducePlan(ab, { type: 'send', to: 2 }, s, ME);
    expect(moved.plan).toEqual([{ kind: 'move', unit: '0:a', to: 2 }, { kind: 'move', unit: '0:b', to: 2 }]);
  });

  it('a group goes whole or not at all, with the reason', () => {
    const s = board([3, 2]);
    // With a card played there, objective 1 has one place left: two units cannot go
    const ps = run(s, { type: 'drop', refs: [card('h1')], to: 1 }, { type: 'pick', ref: unit('0:a') }, { type: 'pick', ref: unit('0:b') }, { type: 'send', to: 1 });
    expect(ps.plan).toEqual([{ kind: 'play', card: 'h1', to: 1 }]);
    expect(ps.refused).toBe(1);
    expect(ps.why).toBe('Brak miejsca');
  });

  it('a rival unit cannot be picked, and says why', () => {
    const ps = run(board(), { type: 'pick', ref: unit('1:r') });
    expect(ps.refused).toBe(1);
    expect(ps.why).toBe('To jednostka rywala');
  });
});

describe('a full objective', () => {
  it('a card dropped onto an own unit there replaces that unit in one step', () => {
    const s = board();
    const ps = run(s, { type: 'drop', refs: [card('h1')], to: 0, replace: '0:b' });
    expect(ps.plan).toEqual([{ kind: 'play', card: 'h1', to: 0, replace: '0:b' }]);
    expect(ps.ask).toBeNull();
  });

  it('a group onto a full objective asks once per card that needs room, then sends all', () => {
    const s = board();
    const asked = run(s, { type: 'pick', ref: card('h1') }, { type: 'pick', ref: card('h2') }, { type: 'send', to: 0 });
    expect(asked.plan).toEqual([]);
    expect(asked.ask).toMatchObject({ to: 0, ref: card('h1'), options: ['0:a', '0:b', '0:c'] });
    const second = reducePlan(asked, { type: 'send', to: 0, replace: '0:a' }, s, ME);
    expect(second.plan).toEqual([]);
    expect(second.ask).toMatchObject({ ref: card('h2'), options: ['0:b', '0:c'] });
    const done = reducePlan(second, { type: 'send', to: 0, replace: '0:c' }, s, ME);
    expect(done.plan).toEqual([{ kind: 'play', card: 'h1', to: 0, replace: '0:a' }, { kind: 'play', card: 'h2', to: 0, replace: '0:c' }]);
    expect(done.ask).toBeNull();
  });
});

describe('what each objective would give', () => {
  it('shows the own total after the send, the cost, and greys a full place for a unit', () => {
    const s = board();
    const t = targetInfo(s, ME, [], [unit('0:a')]);
    expect(t[0]).toEqual({ kind: 'here', cost: 0 });
    // a (5) joins d (Hard Support 3): Aura gives both +1
    const d = planScene(viewFor(s, ME), []).units.find((u) => u.uid === '0:d')!;
    expect(t[1]).toMatchObject({ kind: 'ok', cost: 1 });
    expect(t[1].total).toBe(d.strength + 5 + 1);
    expect(t[2]).toMatchObject({ kind: 'ok', cost: 1, total: 5 });
    const card1 = targetInfo(s, ME, [], [card('h1')]);
    expect(card1[0]).toMatchObject({ kind: 'replace', cost: 1 });
    // A unit cannot make room by replacing
    const d0 = targetInfo(s, ME, [], [unit('0:d')]);
    expect(d0[0]).toEqual({ kind: 'off', why: 'Brak miejsca', cost: 0 });
  });

  it('says when the orders are spent, and a move back frees one', () => {
    const s = board();
    const plan = run(s, { type: 'drop', refs: [card('h1')], to: 2 }, { type: 'drop', refs: [unit('0:a')], to: 2 }).plan;
    expect(targetInfo(s, ME, plan, [card('h2')])[1]).toEqual({ kind: 'off', why: 'Brak rozkazów', cost: 0 });
    expect(targetInfo(s, ME, plan, [unit('0:a')])[0]).toMatchObject({ kind: 'ok', cost: -1 });
  });

  it('a Support played from the hand offers a free move to its objective', () => {
    const ss = aCard({ id: 'ss', role: 'Soft Support', cost: 3 });
    const s = aBoard({ rules: DEFAULT_RULES, hands: [[ss], []], units: [{ card: aCard({ id: 'a', cost: 5 }), side: ME, at: 0 }] });
    expect(freeOffers(s, ME, []).size).toBe(0);
    const plan = run(s, { type: 'drop', refs: [card('ss')], to: 1 }).plan;
    expect(freeOffers(s, ME, plan)).toEqual(new Map([['0:a', 'smoke']]));
    expect(targetInfo(s, ME, plan, [unit('0:a')])[1]).toMatchObject({ kind: 'ok', cost: 0, free: 'smoke' });
    const moved = run(s, { type: 'drop', refs: [card('ss')], to: 1 }, { type: 'drop', refs: [unit('0:a')], to: 1 });
    expect(planScene(viewFor(s, ME), moved.plan).units.find((u) => u.uid === '0:a')).toMatchObject({ planned: 'move', free: 'smoke' });
  });
});
