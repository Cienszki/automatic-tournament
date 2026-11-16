'use client';

// The match as the screen holds it: the stage (plan, reveal playing, fight, end), the plan being
// built, the fight choice, and the clock that walks through a reveal's steps. All decisions are
// made in state/ (pure code); this hook only keeps them between renders.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fightComplete, NO_CHOICE, reduceFight, type FightAction, type FightChoice } from './state/fight';
import { confirmFight, confirmPlan, startAt, type Jump, type Stage } from './state/game';
import { actors, EMPTY_PLAN, planScene, reducePlan, targetsOf, type PlanAction, type PlanState, type Ref, type Target } from './state/plan';
import type { Mode } from './state/reveal';
import { knownState, ME, type Scene } from './state/scene';

export interface StartOptions { seed: number; jump: Jump | null; mode: Mode; /** A reveal step to stand still on, in place of the default one */ step?: number; /** Start the fight or the plan untouched */ untouched?: boolean }

const NOBODY = { cards: new Set<string>(), units: new Set<string>() };

export function useMatch(o: StartOptions) {
  const [boot] = useState(() => startAt(o.seed, o.jump, o.mode));
  const session = useRef(boot.session);
  const [stage, setStage] = useState<Stage>(boot.stage);
  const [step, setStep] = useState(() => (boot.stage.kind === 'show' ? Math.min(boot.stage.steps.length - 1, Math.max(0, o.step ?? boot.frozen ?? 0)) : 0));
  const [frozen, setFrozen] = useState(boot.frozen !== undefined);
  const [ps, setPs] = useState<PlanState>(() => {
    if (boot.stage.kind !== 'plan' || !boot.plan || o.untouched) return EMPTY_PLAN;
    const s = knownState(boot.stage.view);
    return boot.plan.reduce((p, a) => reducePlan(p, a.kind === 'play' ? { type: 'drop', ref: { kind: 'card', id: a.card }, to: a.to, replace: a.replace } : { type: 'drop', ref: { kind: 'unit', uid: a.unit }, to: a.to }, s, ME), EMPTY_PLAN);
  });
  const [choice, setChoice] = useState<FightChoice>(o.untouched ? NO_CHOICE : boot.choice ?? NO_CHOICE);
  /** The own unit the player dragged the aim line from: only a picture */
  const [aimFrom, setAimFrom] = useState<string | null>(null);

  const enter = useCallback((next: Stage) => {
    setStage(next); setStep(0); setFrozen(false);
    if (next.kind === 'plan') { setPs(EMPTY_PLAN); setChoice(NO_CHOICE); setAimFrom(null); }
  }, []);

  useEffect(() => {
    if (stage.kind !== 'show' || frozen) return;
    const t = setTimeout(() => { if (step + 1 < stage.steps.length) setStep(step + 1); else enter(stage.next); }, stage.steps[step].ms);
    return () => clearTimeout(t);
  }, [stage, step, frozen, enter]);

  const known = useMemo(() => (stage.kind === 'plan' ? knownState(stage.view) : null), [stage]);
  const scene: Scene = useMemo(() => {
    if (stage.kind === 'plan') return planScene(stage.view, ps.plan);
    if (stage.kind === 'show') return stage.steps[step].scene;
    return stage.scene;
  }, [stage, ps.plan, step]);
  const glow = useMemo(() => (known ? actors(known, ME, ps.plan) : NOBODY), [known, ps.plan]);
  const slots: [Target, Target, Target] | null = useMemo(() => {
    if (!known || !ps.pick) return null;
    if (ps.ask) return [0, 1, 2].map((at) => (at === ps.ask!.to ? 'replace' : null)) as [Target, Target, Target];
    return targetsOf(known, ME, ps.plan, ps.pick);
  }, [known, ps]);

  /** Where a card or unit may go, while it is being dragged */
  const targetsFor = useCallback((ref: Ref): [Target, Target, Target] | null => (known ? targetsOf(known, ME, ps.plan, ref) : null), [known, ps.plan]);
  const plan = useCallback((a: PlanAction) => { if (stage.kind === 'plan') setPs((p) => reducePlan(p, a, knownState(stage.view), ME)); }, [stage]);
  const fight = useCallback((a: FightAction, from?: string | null) => {
    if (stage.kind !== 'fight') return;
    setChoice((c) => reduceFight(c, a, stage.options));
    if (a.type === 'target') setAimFrom(from ?? null);
  }, [stage]);
  const confirm = useCallback(() => {
    if (stage.kind === 'plan') enter(confirmPlan(session.current, stage.view, ps.plan, o.mode));
    else if (stage.kind === 'fight') enter(confirmFight(session.current, stage, choice, o.mode));
  }, [stage, ps.plan, choice, o.mode, enter]);
  /** A tap during a reveal: a standing picture starts moving, a moving one jumps to its end */
  const skip = useCallback(() => {
    if (stage.kind !== 'show') return;
    if (frozen) setFrozen(false); else enter(stage.next);
  }, [stage, frozen, enter]);

  const ready = stage.kind === 'plan' ? glow.cards.size + glow.units.size === 0 : stage.kind === 'fight' ? fightComplete(choice, stage.options) : false;
  const tick = stage.kind === 'show' ? `${scene.round}-${stage.steps[step].key}` : `${scene.round}-${stage.kind}`;
  return { stage, scene, tick, ps, choice, aimFrom, glow, slots, targetsFor, ready, plan, fight, confirm, skip };
}
