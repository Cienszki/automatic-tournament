import { describe, expect, it } from 'vitest';
import { castFor } from '@/app/prototype/cards/_shared/data';
import { makeAgent } from '@/features/cards/domain/v2/ai/agents';
import { validateStrikes } from '@/features/cards/domain/v2/fight';
import { DEFAULT_RULES } from '@/features/cards/domain/v2/rules';
import { aBoard, aCard } from '@/features/cards/domain/v2/testing';
import { viewFor } from '@/features/cards/domain/v2/view';
import { fightComplete, fightOptions, NO_CHOICE, reduceFight, toStrikes } from './fight';
import { confirmFight, confirmPlan, firstStage, newSession, rivalMid, rivalView, type Show, type Stage } from './game';
import { opponentFor } from './jump';
import { EMPTY_LEDGER, land, landAll, launch, shownHp, type Ledger } from './ledger';
import { logRounds } from './log';
import { knownState, ME, RIVAL } from './scene';

/** Plays a reveal the way the screen does: each step's damage takes off, flyers land one step later */
function playBack(shown: Show, l: Ledger, before: [number, number]): Ledger {
  let led = l;
  shown.steps.forEach((step, i) => {
    led = launch(led, `${i}`, step.scene.fx);
    const bar = shownHp(step.scene.hp, led);
    // The bar is never ahead of the flyers: it shows no damage that is still in the air
    for (const side of [ME, RIVAL]) expect(bar[side]).toBeGreaterThanOrEqual(step.scene.hp[side]);
    for (const side of [ME, RIVAL]) expect(bar[side]).toBeLessThanOrEqual(before[side]);
    // Launching the same step again changes nothing
    expect(launch(led, `${i}`, step.scene.fx)).toBe(led);
    if (i % 2) for (const f of led.flying) led = land(led, f.id);
  });
  return led;
}

describe('a whole match through the screen state, with the computer as a separate input', () => {
  it('plays to a result for fixed seeds at every level, and the bar ends on the truth', () => {
    for (const level of ['easy', 'medium'] as const) {
      for (const seed of [11, 12, 13]) {
        const cast = castFor(seed, DEFAULT_RULES, level);
        const se = newSession(seed, cast);
        const rival = opponentFor(seed, cast);
        const pilot = makeAgent('random', { pool: cast.pool, seed });
        let stage: Stage = firstStage(se);
        let led = EMPTY_LEDGER;
        let rounds = 0; let skipped = false;
        while (stage.kind !== 'end') {
          if (stage.kind !== 'plan') throw new Error(stage.kind);
          rounds++;
          const before: [number, number] = [stage.view.hp, stage.view.rival.hp];
          const shown = confirmPlan(se, stage.view, pilot.decide(stage.view).plan, rival.decide(rivalView(se)).plan);
          led = playBack(shown, led, before);
          let next = shown.next;
          if (next.kind === 'fight') {
            // Half the rounds the player chooses nothing at all: the fight may be skipped
            const choice = rounds % 2 ? NO_CHOICE : reduceFight(NO_CHOICE, { type: 'target', uid: next.options.targets[0] ?? '' }, next.options);
            const clash = confirmFight(se, next, choice, rival.strike(rivalMid(se), RIVAL));
            led = playBack(clash, led, before);
            // Every other reveal is skipped: whatever is in the air lands at once
            if (!skipped) led = landAll(led);
            skipped = !skipped;
            next = clash.next;
          }
          for (const f of led.flying) led = land(led, f.id);
          const hp = next.kind === 'plan' ? [next.view.hp, next.view.rival.hp] : [se.state.sides[ME].hp, se.state.sides[RIVAL].hp];
          expect(shownHp(hp as [number, number], led)).toEqual(hp);
          stage = next;
        }
        expect(stage.result.round).toBe(rounds);
        expect(se.log.map((r) => r.round)).toEqual(Array.from({ length: rounds }, (_, i) => i + 1));
        const log = logRounds(se.log);
        expect(log[0].round).toBe(rounds);
        expect(log.flatMap((r) => r.rows).some((r) => r.kind === 'control')).toBe(true);
      }
    }
  }, 120_000);
});

describe('the fight choice', () => {
  const offlane = aCard({ id: 'off', role: 'Offlane', cost: 6 });
  const carry = aCard({ id: 'car', cost: 5 });
  const mine = aCard({ id: 'me', cost: 5 });
  const s = aBoard({ rules: DEFAULT_RULES, units: [{ card: offlane, side: RIVAL, at: 0 }, { card: carry, side: RIVAL, at: 0 }, { card: mine, side: ME, at: 0 }] });
  const o = fightOptions(knownState(viewFor(s, ME)), ME);

  it('never offers an Offlane as a target', () => {
    expect(o.targets).toEqual(['1:car']);
    expect(reduceFight(NO_CHOICE, { type: 'target', uid: '1:off' }, o)).toEqual(NO_CHOICE);
  });

  it('is complete with both picks, and may be confirmed with fewer', () => {
    const hitOnly = reduceFight(NO_CHOICE, { type: 'target', uid: '1:car' }, o);
    expect(fightComplete(hitOnly, o)).toBe(false);
    const both = reduceFight(hitOnly, { type: 'guard', uid: '0:me' }, o);
    expect(fightComplete(both, o)).toBe(true);
    for (const c of [NO_CHOICE, hitOnly, both]) expect(validateStrikes(s, ME, toStrikes(s, c))).toBeNull();
  });
});
