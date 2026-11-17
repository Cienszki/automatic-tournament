import { describe, expect, it } from 'vitest';
import { makeAgent } from '@/features/cards/domain/v2/ai/agents';
import { DEFAULT_RULES, makeRules, type Rules } from '@/features/cards/domain/v2/rules';
import { planKey } from '@/features/cards/domain/v2/ai/actions';
import { contested, oneGuard, oneTarget, validateStrikes } from '@/features/cards/domain/v2/fight';
import type { Plan } from '@/features/cards/domain/v2/types';
import { castFor, POOL } from '@/app/prototype/cards/_shared/data';
import { opponentFor, startAt } from './jump';
import { fightComplete, fightOptions, NO_CHOICE, reduceFight, toStrikes, type FightChoice } from './fight';
import { confirmFight, confirmPlan, firstStage, newSession, rivalMid, rivalView, type Show, type Stage } from './game';
import { EMPTY_PLAN, planScene, reducePlan, type PlanState } from './plan';
import { HALF_MS, type Mode, type Step } from './reveal';
import { knownState, ME, RIVAL, type Scene } from './scene';

/** Wherever a scene shows a total, it is the sum of the strengths it shows on that side */
function totalsAddUp(scene: Scene): void {
  scene.objectives.forEach((o, at) => {
    for (const side of [ME, RIVAL]) {
      if (o.totals[side] === null) continue;
      const sum = scene.units.filter((u) => u.side === side && u.at === at).reduce((a, u) => a + u.strength, 0);
      expect(o.totals[side], `objective ${at}, side ${side}`).toBe(sum);
    }
  });
}

const length = (steps: Step[]) => steps.reduce((a, s) => a + s.ms, 0);

/** The plan built action by action through the reducer, as a player would */
function throughReducer(plan: Plan, stage: Extract<Stage, { kind: 'plan' }>): PlanState {
  const s = knownState(stage.view);
  let ps = EMPTY_PLAN;
  for (const a of plan) ps = reducePlan(ps, a.kind === 'play' ? { type: 'drop', ref: { kind: 'card', id: a.card }, to: a.to, replace: a.replace } : { type: 'drop', ref: { kind: 'unit', uid: a.unit }, to: a.to }, s, ME);
  return ps;
}

function playMatch(seed: number, mode: Mode, rules: Rules = DEFAULT_RULES) {
  const cast = castFor(seed, rules);
  const se = newSession(seed, cast);
  const rival = opponentFor(seed, cast);
  const pilot = makeAgent('greedy', { pool: POOL, seed: seed + 100 });
  let stage: Stage = firstStage(se);
  let rounds = 0; let fights = 0;
  const check = (shown: Show, halves: number) => {
    expect(shown.steps.length).toBeGreaterThan(0);
    expect(length(shown.steps)).toBeLessThanOrEqual(halves * HALF_MS);
    shown.steps.forEach((s) => totalsAddUp(s.scene));
  };
  while (stage.kind !== 'end') {
    if (stage.kind !== 'plan') throw new Error(`unexpected stage ${stage.kind}`);
    rounds++;
    const plan = pilot.decide(stage.view).plan;
    const ps = throughReducer(plan, stage);
    expect(planKey(ps.plan)).toBe(planKey(plan));
    expect(ps.refused).toBe(0);
    totalsAddUp(planScene(stage.view, ps.plan));
    const shown = confirmPlan(se, stage.view, ps.plan, rival.decide(rivalView(se)).plan, mode);
    if (shown.next.kind !== 'fight') { check(shown, 2); stage = shown.next; continue; }
    check(shown, 1);
    fights++;
    const fight = shown.next;
    // The board the player chooses the fight on is the board the reveal ended on
    expect(fight.scene.units).toEqual(shown.steps[shown.steps.length - 1].scene.units);
    const k = pilot.strike(se.mid!, ME);
    let choice: FightChoice = NO_CHOICE;
    const t = oneTarget(k); const g = oneGuard(k);
    if (t !== undefined) choice = reduceFight(choice, { type: 'target', uid: t }, fight.options);
    if (g !== undefined) choice = reduceFight(choice, { type: 'guard', uid: g }, fight.options);
    expect(choice).toEqual({ target: t ?? null, guard: g ?? null });
    expect(fightComplete(choice, fight.options)).toBe(true);
    expect(validateStrikes(knownState(fight.mid), ME, toStrikes(knownState(fight.mid), choice))).toBeNull();
    const clash = confirmFight(se, fight, choice, rival.strike(rivalMid(se), RIVAL), mode);
    check(clash, 1);
    const last = clash.steps[clash.steps.length - 1].scene;
    // The damage played back from the events lands on the engine's own hit points
    expect(last.hp).toEqual([se.state.sides[ME].hp, se.state.sides[RIVAL].hp]);
    if (clash.next.kind === 'plan') expect(last).toEqual({ ...planScene(clash.next.view, []), fx: last.fx });
    stage = clash.next;
  }
  return { result: stage.result, rounds, fights, session: se };
}

describe('a whole match through the prototype state', () => {
  for (const mode of ['together', 'byObjective'] as Mode[]) {
    it(`plays to a result with fixed seeds (${mode})`, () => {
      for (const seed of [1, 2, 3, 4]) {
        const m = playMatch(seed, mode);
        expect(m.result.round).toBe(m.rounds);
        expect(m.rounds).toBeLessThanOrEqual(8);
        expect(m.fights).toBeGreaterThan(0);
        expect(m.session.state.result).toEqual(m.result);
      }
    }, 120_000);
  }

  it('plays to a result with four units per side on an objective', () => {
    const rules = makeRules({ capacity: 4 });
    for (const seed of [1, 2]) {
      const m = playMatch(seed, 'together', rules);
      expect(m.session.state.rules.capacity).toBe(4);
      expect(m.result.round).toBe(m.rounds);
      for (const at of [0, 1, 2]) for (const side of [0, 1]) expect(m.session.state.units.filter((u) => u.side === side && u.at === at).length).toBeLessThanOrEqual(4);
    }
  }, 120_000);

  it('is the same match every time for the same seed', () => {
    const a = playMatch(5, 'together'); const b = playMatch(5, 'together');
    expect(a.result).toEqual(b.result);
    expect(a.session.state.sides.map((s) => s.hp)).toEqual(b.session.state.sides.map((s) => s.hp));
  }, 60_000);
});

describe('jumping to a state by address', () => {
  it('stops in planning with a plan begun', () => {
    const at = startAt(1, castFor(1), { to: 'plan' }, 'together');
    expect(at.stage.kind).toBe('plan');
    expect(at.stage.kind === 'plan' && at.stage.view.public.round).toBeGreaterThanOrEqual(3);
    expect(at.plan?.length).toBe(1);
  });

  it('stops in a fight with at least two contested objectives', () => {
    const at = startAt(1, castFor(1), { to: 'fight' }, 'together');
    if (at.stage.kind !== 'fight') throw new Error(at.stage.kind);
    expect(contested(knownState(at.stage.mid)).length).toBeGreaterThanOrEqual(2);
    expect(at.choice?.target).toBeTruthy();
  });

  it('stops inside a reveal, on the step where control is decided', () => {
    for (const mode of ['together', 'byObjective'] as Mode[]) {
      const at = startAt(1, castFor(1), { to: 'reveal' }, mode);
      if (at.stage.kind !== 'show') throw new Error(at.stage.kind);
      expect(at.stage.steps[at.frozen!].key.startsWith('verdict')).toBe(true);
      expect(length(at.stage.steps)).toBeLessThan(6000);
    }
  });

  it('stops at the end, and honours a round', () => {
    expect(startAt(1, castFor(1), { to: 'end' }, 'together').stage.kind).toBe('end');
    const at = startAt(2, castFor(2), { to: 'plan', round: 5 }, 'together');
    expect(at.stage.kind === 'plan' && at.stage.view.public.round).toBe(5);
  }, 60_000);
});

describe('the fight choice', () => {
  it('takes only units the engine allows, and a second tap takes the choice back', () => {
    const at = startAt(1, castFor(1), { to: 'fight' }, 'together');
    if (at.stage.kind !== 'fight') throw new Error(at.stage.kind);
    const o = fightOptions(knownState(at.stage.mid), ME);
    expect(o).toEqual(at.stage.options);
    let c = reduceFight(NO_CHOICE, { type: 'target', uid: o.guards[0] }, o); // an own unit is not a target
    expect(c).toEqual(NO_CHOICE);
    c = reduceFight(c, { type: 'guard', uid: o.targets[0] }, o); // a rival unit cannot be guarded
    expect(c).toEqual(NO_CHOICE);
    c = reduceFight(c, { type: 'target', uid: o.targets[0] }, o);
    c = reduceFight(c, { type: 'guard', uid: o.guards[0] }, o);
    expect(c).toEqual({ target: o.targets[0], guard: o.guards[0] });
    expect(reduceFight(c, { type: 'target', uid: o.targets[0] }, o).target).toBeNull();
    expect(reduceFight(c, { type: 'clear' }, o)).toEqual(NO_CHOICE);
    // No unit lit for the player is an Offlane or stands on an objective that is not contested
    const mid = knownState(at.stage.mid);
    const open = contested(mid);
    for (const uid of [...o.targets, ...o.guards]) {
      const u = mid.units.find((x) => x.uid === uid)!;
      expect(u.card.role).not.toBe('Offlane');
      expect(open).toContain(u.at);
    }
  });
});
