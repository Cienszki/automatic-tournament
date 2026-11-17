// Jumping to a state of a match by address (screenshots are taken without clicking): the first
// rounds are played by the plain computer player in the player's seat against the chosen level,
// and the match stops in the state asked for.
import { makeAgent, type Agent } from '@/features/cards/domain/v2/ai/agents';
import { makeOpponent } from '@/features/cards/domain/v2/ai/levels';
import { hashSeed } from '@/features/cards/domain/v2/ai/rng';
import { contested, oneGuard, oneTarget } from '@/features/cards/domain/v2/fight';
import type { Plan } from '@/features/cards/domain/v2/types';
import type { FightChoice } from './fight';
import { confirmFight, confirmPlan, firstStage, newSession, rivalMid, rivalView, type Cast, type Session, type Stage } from './game';
import type { Mode } from './reveal';
import { knownState, ME, RIVAL } from './scene';

export interface Jump { to: 'plan' | 'fight' | 'reveal' | 'end'; round?: number }
export interface Started {
  session: Session;
  stage: Stage;
  /** The computer player, already as far into the match as the session */
  rival: Agent;
  /** A plan or a fight choice already begun, so the picture shows the state in use */
  plan?: Plan;
  choice?: FightChoice;
  /** The reveal step to stand still on */
  frozen?: number;
}

/** The computer opponent of a session, seeded from it */
export const opponentFor = (seed: number, cast: Cast): Agent => makeOpponent(cast.level, { pool: cast.pool, seed: hashSeed(`rival:${seed}`) });

/** `strict` asks for a fight with at least two contested objectives */
function runTo(seed: number, cast: Cast, jump: Jump, mode: Mode, strict: boolean): Started | null {
  const session = newSession(seed, cast);
  const rival = opponentFor(seed, cast);
  const pilot = makeAgent('greedy', { pool: cast.pool, seed: hashSeed(`pilot:${seed}`) });
  const from = jump.round ?? (jump.to === 'fight' ? 2 : 3);
  let stage = firstStage(session);
  while (stage.kind === 'plan') {
    const { view } = stage;
    const round = view.public.round;
    const plan = pilot.decide(view).plan;
    if (jump.to === 'plan' && round >= from) return { session, stage, rival, plan: plan.slice(0, 1) };
    const shown = confirmPlan(session, view, plan, rival.decide(rivalView(session)).plan, mode);
    if (shown.next.kind !== 'fight') { stage = shown.next; continue; }
    const fight = shown.next;
    const k = pilot.strike(session.mid!, ME);
    const choice: FightChoice = { target: oneTarget(k) ?? null, guard: oneGuard(k) ?? null };
    const busy = contested(knownState(fight.mid)).length >= 2;
    if (jump.to === 'fight' && round >= from && (busy || !strict)) return { session, stage: fight, rival, choice };
    const clash = confirmFight(session, fight, choice, rival.strike(rivalMid(session), RIVAL), mode);
    if (jump.to === 'reveal' && round >= from && (busy || !strict)) {
      const steps = [...shown.steps, ...clash.steps];
      return { session, rival, stage: { kind: 'show', steps, next: clash.next }, frozen: Math.max(0, steps.findIndex((s) => s.key.startsWith('verdict'))) };
    }
    stage = clash.next;
  }
  return jump.to === 'end' ? { session, stage, rival } : null;
}

export function startAt(seed: number, cast: Cast, jump: Jump | null, mode: Mode = 'together'): Started {
  if (jump) {
    const hit = runTo(seed, cast, jump, mode, true) ?? runTo(seed, cast, jump, mode, false) ?? runTo(seed, cast, { to: jump.to, round: 1 }, mode, false);
    if (hit) return hit;
  }
  const session = newSession(seed, cast);
  return { session, stage: firstStage(session), rival: opponentFor(seed, cast) };
}
