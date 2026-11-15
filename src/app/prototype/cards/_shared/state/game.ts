// A prototype match against the computer: the engine's state, the computer player, and the stage
// the screen is in. The true state lives in the session and never reaches a component; stages
// carry only the player's view (viewFor) and scenes built from it and from the round's events.
import { makeAgent, type Agent } from '@/features/cards/domain/v2/ai/agents';
import { makeOpponent } from '@/features/cards/domain/v2/ai/levels';
import { hashSeed, mulberry32 } from '@/features/cards/domain/v2/ai/rng';
import { contested, oneGuard, oneTarget, type Strikes } from '@/features/cards/domain/v2/fight';
import { finishRound, revealRound } from '@/features/cards/domain/v2/resolve';
import { DEFAULT_RULES } from '@/features/cards/domain/v2/rules';
import { newMatch } from '@/features/cards/domain/v2/setup';
import type { MatchResult, MatchState, Plan } from '@/features/cards/domain/v2/types';
import { viewFor, type MatchView } from '@/features/cards/domain/v2/view';
import { DECKS, POOL } from '../data';
import { fightOptions, hasFight, toStrikes, type FightChoice, type FightOptions } from './fight';
import { clashSteps, fightScene, revealSteps, type Mode, type Step } from './reveal';
import { knownState, ME, RIVAL, type Scene } from './scene';

export interface Session {
  seed: number;
  /** The whole truth, the rival's hand included: only this file reads it */
  state: MatchState;
  /** The board between the two halves of a round */
  mid: MatchState | null;
  rival: Agent;
}

export type Stage =
  | { kind: 'plan'; view: MatchView }
  /** A reveal being played; `next` is where the screen is once it ends or is skipped */
  | { kind: 'show'; steps: Step[]; next: Stage }
  | { kind: 'fight'; mid: MatchView; options: FightOptions; scene: Scene }
  | { kind: 'end'; result: MatchResult; scene: Scene; rounds: number };

export type Show = Extract<Stage, { kind: 'show' }>;
export type Fight = Extract<Stage, { kind: 'fight' }>;

export function newSession(seed: number): Session {
  const n = DECKS.length;
  const mine = ((seed % n) + n) % n;
  const state = newMatch([DECKS[mine], DECKS[(mine + 3) % n]], mulberry32(hashSeed(`deal:${seed}`)), DEFAULT_RULES);
  return { seed, state, mid: null, rival: makeOpponent('easy', { pool: POOL, seed: hashSeed(`rival:${seed}`) }) };
}

export const firstStage = (se: Session): Stage => ({ kind: 'plan', view: viewFor(se.state, ME) });

/** Ends the round from the board after the reveal: the computer's strikes, the engine's second half */
function finish(se: Session, midView: MatchView, mine: Strikes, mode: Mode): Show {
  const mid = se.mid!;
  const strikes: [Strikes, Strikes] = [mine, se.rival.strike(mid, RIVAL)];
  const out = finishRound(mid, strikes);
  se.state = out.state;
  se.mid = null;
  const next = viewFor(out.state, ME);
  const steps = clashSteps(midView, strikes, out.events, next, mode);
  const result = out.state.result;
  return { kind: 'show', steps, next: result ? { kind: 'end', result, scene: steps[steps.length - 1].scene, rounds: result.round } : { kind: 'plan', view: next } };
}

/** "Zatwierdź" on a plan: the computer plans from its own view, the engine reveals. A round with
 *  nothing to hit and nothing to guard has no fight question and plays straight through. */
export function confirmPlan(se: Session, view: MatchView, plan: Plan, mode: Mode): Show {
  const rivalPlan = se.rival.decide(viewFor(se.state, RIVAL)).plan;
  const out = revealRound(se.state, [plan, rivalPlan]);
  se.mid = out.state;
  const mid = viewFor(out.state, ME);
  const steps = revealSteps(view, plan, mid, out.events, mode);
  const options = fightOptions(knownState(mid), ME);
  if (hasFight(options)) return { kind: 'show', steps, next: { kind: 'fight', mid, options, scene: fightScene(mid) } };
  const rest = finish(se, mid, [], mode);
  return { kind: 'show', steps: [...steps, ...rest.steps], next: rest.next };
}

/** "Zatwierdź" on the fight */
export function confirmFight(se: Session, stage: Fight, choice: FightChoice, mode: Mode): Show {
  return finish(se, stage.mid, toStrikes(knownState(stage.mid), choice), mode);
}

// ── Jumping to a state by address (screenshots are taken without clicking) ──────────────────

export interface Jump { to: 'plan' | 'fight' | 'reveal' | 'end'; round?: number }
export interface Started {
  session: Session;
  stage: Stage;
  /** A plan or a fight choice already begun, so the picture shows the state in use */
  plan?: Plan;
  choice?: FightChoice;
  /** The reveal step to stand still on */
  frozen?: number;
}

/** Plays the first rounds with the plain computer player in the player's seat, and stops in the
 *  asked state. `strict` asks for a fight with at least two contested objectives. */
function runTo(seed: number, jump: Jump, mode: Mode, strict: boolean): Started | null {
  const session = newSession(seed);
  const pilot = makeAgent('greedy', { pool: POOL, seed: hashSeed(`pilot:${seed}`) });
  const from = jump.round ?? (jump.to === 'fight' ? 2 : 3);
  let stage = firstStage(session);
  while (stage.kind === 'plan') {
    const { view } = stage;
    const round = view.public.round;
    const plan = pilot.decide(view).plan;
    if (jump.to === 'plan' && round >= from) return { session, stage, plan: plan.slice(0, 1) };
    const shown = confirmPlan(session, view, plan, mode);
    if (shown.next.kind !== 'fight') { stage = shown.next; continue; }
    const fight = shown.next;
    const k = pilot.strike(session.mid!, ME);
    const choice: FightChoice = { target: oneTarget(k) ?? null, guard: oneGuard(k) ?? null };
    const busy = contested(knownState(fight.mid)).length >= 2;
    if (jump.to === 'fight' && round >= from && (busy || !strict)) return { session, stage: fight, choice };
    const clash = confirmFight(session, fight, choice, mode);
    if (jump.to === 'reveal' && round >= from && (busy || !strict)) {
      const steps = [...shown.steps, ...clash.steps];
      return { session, stage: { kind: 'show', steps, next: clash.next }, frozen: Math.max(0, steps.findIndex((s) => s.key.startsWith('verdict'))) };
    }
    stage = clash.next;
  }
  return jump.to === 'end' ? { session, stage } : null;
}

export function startAt(seed: number, jump: Jump | null, mode: Mode): Started {
  if (jump) {
    const hit = runTo(seed, jump, mode, true) ?? runTo(seed, jump, mode, false) ?? runTo(seed, { to: jump.to, round: 1 }, mode, false);
    if (hit) return hit;
  }
  const session = newSession(seed);
  return { session, stage: firstStage(session) };
}
