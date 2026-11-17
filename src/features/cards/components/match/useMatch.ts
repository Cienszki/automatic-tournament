'use client';

// The match as the screen holds it: the stage (plan, reveal playing, fight, end), the plan being
// built, the fight choice, the clock that walks through a reveal's steps, the points in the air,
// and the computer's answers. Every decision is made in state/ (pure code) or by the engine; this
// hook only keeps them between renders and in order.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { hashSeed } from '@/features/cards/domain/v2/ai/rng';
import type { Strikes } from '@/features/cards/domain/v2/fight';
import type { Plan } from '@/features/cards/domain/v2/types';
import { fightComplete, NO_CHOICE, reduceFight, type FightAction, type FightChoice } from '@/features/cards/state/fight';
import { confirmFight, confirmPlan, rivalMid, rivalView, type Cast, type RoundLog, type Stage } from '@/features/cards/state/game';
import { startAt, type Jump } from '@/features/cards/state/jump';
import { EMPTY_LEDGER, land, landAll, launch, type Ledger } from '@/features/cards/state/ledger';
import type { NameFx } from '@/features/cards/state/names';
import { actors, EMPTY_PLAN, planScene, reducePlan, targetInfo, type PlanAction, type PlanState, type Ref, type TargetInfo } from '@/features/cards/state/plan';
import { knownState, ME, type Scene } from '@/features/cards/state/scene';
import { useRival } from './useRival';

export interface MatchOptions { seed: number; cast: Cast; jump: Jump | null }
const NOBODY = { cards: new Set<string>(), units: new Set<string>() };

function bootPlan(stage: Stage, plan?: Plan): PlanState {
  if (stage.kind !== 'plan' || !plan) return EMPTY_PLAN;
  const s = knownState(stage.view);
  return plan.reduce((p, a) => reducePlan(p, { type: 'drop', refs: [a.kind === 'play' ? { kind: 'card', id: a.card } : { kind: 'unit', uid: a.unit }], to: a.to, replace: a.kind === 'play' ? a.replace : undefined }, s, ME), EMPTY_PLAN);
}

export function useMatch(o: MatchOptions) {
  const [boot] = useState(() => startAt(o.seed, o.cast, o.jump));
  const se = useRef(boot.session);
  // A match started by a jump goes on with a computer seeded from where it starts
  const round0 = boot.session.state.round;
  const { decide, strike, thinking } = useRival({ level: o.cast.level, pool: o.cast.pool, seed: hashSeed(o.jump ? `rival:${o.seed}:${round0}` : `rival:${o.seed}`) });
  const [stage, setStage] = useState<Stage>(boot.stage);
  const [step, setStep] = useState(() => (boot.stage.kind === 'show' ? boot.frozen ?? 0 : 0));
  const [frozen, setFrozen] = useState(boot.frozen !== undefined);
  const [ps, setPs] = useState<PlanState>(() => bootPlan(boot.stage, boot.plan));
  const [choice, setChoice] = useState<FightChoice>(boot.choice ?? NO_CHOICE);
  /** The own unit the player dragged the aim line from: only a picture */
  const [aimFrom, setAimFrom] = useState<string | null>(null);
  const [ledger, setLedger] = useState<Ledger>(EMPTY_LEDGER);
  const [waiting, setWaiting] = useState(false);
  const [paused, setPaused] = useState(false);
  const [log, setLog] = useState<RoundLog[]>(boot.session.log);
  const [names, setNames] = useState<NameFx[]>([]);
  const seen = useRef(new Set<string>());
  const asked = useRef<{ key: string; plan?: Promise<Plan>; strikes?: Promise<Strikes> }>({ key: '' });

  const enter = useCallback((next: Stage) => {
    setStage(next); setStep(0); setFrozen(false);
    if (next.kind !== 'show') setLog(se.current.log);
    if (next.kind === 'plan') { setPs(EMPTY_PLAN); setChoice(NO_CHOICE); setAimFrom(null); }
  }, []);

  // The computer thinks while the player does: its plan from the start of the round, its fight
  // choice as soon as the board after the reveal exists
  const round = stage.kind === 'plan' ? stage.view.public.round : se.current.mid?.round ?? 0;
  const wantsStrike = stage.kind === 'fight' || (stage.kind === 'show' && stage.next.kind === 'fight');
  useEffect(() => {
    if (stage.kind === 'plan' && asked.current.key !== `plan:${round}`) asked.current = { key: `plan:${round}`, plan: decide(rivalView(se.current)) };
    if (wantsStrike && se.current.mid && asked.current.key !== `strike:${round}`) asked.current = { key: `strike:${round}`, strikes: strike(rivalMid(se.current)) };
  }, [stage, round, wantsStrike, decide, strike]);

  // The reveal's clock (it stands still while the combat log is open)
  useEffect(() => {
    if (stage.kind !== 'show' || frozen || paused) return;
    const t = setTimeout(() => { if (step + 1 < stage.steps.length) setStep(step + 1); else enter(stage.next); }, stage.steps[step].ms);
    return () => clearTimeout(t);
  }, [stage, step, frozen, paused, enter]);

  const scene: Scene = useMemo(() => {
    if (stage.kind === 'plan') return planScene(stage.view, ps.plan);
    if (stage.kind === 'show') return stage.steps[step].scene;
    return stage.scene;
  }, [stage, ps.plan, step]);
  const tick = stage.kind === 'show' ? `${scene.round}-${stage.steps[step].key}` : `${scene.round}-${stage.kind}`;

  // Damage takes off when its step shows; each ability is named the first time it happens
  useEffect(() => {
    // Only a reveal launches damage: the end shows the last step's board, whose damage has flown
    if (stage.kind === 'show') setLedger((l) => launch(l, tick, scene.fx));
    const fresh: NameFx[] = [];
    for (const f of scene.fx) if (f.kind === 'name' && !seen.current.has(f.what)) { seen.current.add(f.what); fresh.push(f); }
    if (fresh.length) setNames(fresh);
  }, [tick, scene, stage.kind]);

  const known = useMemo(() => (stage.kind === 'plan' ? knownState(stage.view) : null), [stage]);
  const glow = useMemo(() => (known ? actors(known, ME, ps.plan) : NOBODY), [known, ps.plan]);
  /** Where a group may go and what it gives: what is picked, or what is being dragged */
  const targetsFor = useCallback((refs: Ref[]): [TargetInfo, TargetInfo, TargetInfo] | null => (known && refs.length ? targetInfo(known, ME, ps.plan, refs) : null), [known, ps.plan]);
  const targets = useMemo(() => targetsFor(ps.ask ? [ps.ask.ref, ...ps.ask.rest] : ps.picks), [targetsFor, ps]);

  const plan = useCallback((a: PlanAction) => { if (stage.kind === 'plan' && !waiting) setPs((p) => reducePlan(p, a, knownState(stage.view), ME)); }, [stage, waiting]);
  const fight = useCallback((a: FightAction, from?: string | null) => {
    if (stage.kind !== 'fight' || waiting) return;
    setChoice((c) => reduceFight(c, a, stage.options));
    if (a.type === 'target') setAimFrom(from ?? null);
  }, [stage, waiting]);

  const confirm = useCallback(async () => {
    if (waiting) return;
    const cur = stage; const s = se.current;
    if (cur.kind === 'plan' && asked.current.plan) {
      setWaiting(true);
      const theirs = await asked.current.plan;
      setWaiting(false); setPs((p) => ({ ...p, picks: [], ask: null }));
      enter(confirmPlan(s, cur.view, ps.plan, theirs));
    } else if (cur.kind === 'fight' && asked.current.strikes) {
      setWaiting(true);
      const theirs = await asked.current.strikes;
      setWaiting(false);
      enter(confirmFight(s, cur, choice, theirs));
    }
  }, [stage, ps.plan, choice, waiting, enter]);

  /** A tap during a reveal: a standing picture starts moving, a moving one jumps to its end */
  const skip = useCallback(() => {
    if (stage.kind !== 'show') return;
    if (frozen) { setFrozen(false); return; }
    setLedger(landAll);
    enter(stage.next);
  }, [stage, frozen, enter]);

  const ready = stage.kind === 'plan' ? glow.cards.size + glow.units.size === 0 && !ps.picks.length : stage.kind === 'fight' ? fightComplete(choice, stage.options) : false;
  return {
    stage, scene, tick, step, ps, choice, aimFrom, glow, targets, targetsFor, ready, waiting, thinking, ledger, log, names,
    rules: se.current.state.rules, level: o.cast.level, debug: () => ({ seed: o.seed, state: se.current.state, mid: se.current.mid, stage: stage.kind, tick }),
    plan, fight, confirm, skip, setPaused, landed: (id: string) => setLedger((l) => land(l, id)),
  };
}

export type MatchApi = ReturnType<typeof useMatch>;
