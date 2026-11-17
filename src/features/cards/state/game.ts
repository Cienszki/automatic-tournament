// A match against the computer: the engine's state and the stage the screen is in. The true state
// lives in the session and never reaches a component; stages carry only the player's view
// (viewFor) and scenes built from it and from the round's events.
//
// The computer's plan and fight choice are inputs here, not calls: the screen asks for them from a
// web worker (they take a few hundred milliseconds), tests and the address jumps ask an agent
// directly. Either way the computer only ever sees its own view (`rivalView`, `rivalMid`).
import type { GCard } from '@/lib/card-lab/cards';
import type { Level } from '@/features/cards/domain/v2/ai/levels';
import { hashSeed, mulberry32 } from '@/features/cards/domain/v2/ai/rng';
import type { Strikes } from '@/features/cards/domain/v2/fight';
import { finishRound, revealRound } from '@/features/cards/domain/v2/resolve';
import { DEFAULT_RULES, type Rules } from '@/features/cards/domain/v2/rules';
import { newMatch } from '@/features/cards/domain/v2/setup';
import type { MatchEvent, MatchResult, MatchState, Plan } from '@/features/cards/domain/v2/types';
import { viewFor, type MatchView } from '@/features/cards/domain/v2/view';
import { fightOptions, hasFight, toStrikes, type FightChoice, type FightOptions } from './fight';
import { clashSteps, fightScene, revealSteps, type Mode, type Step } from './reveal';
import { knownState, ME, RIVAL, type Scene } from './scene';

/** Who plays: the two decks (the player's first), the cards the computer guesses unseen ones
 *  from, its level and the rules */
export interface Cast { decks: [GCard[], GCard[]]; pool: GCard[]; level: Level; rules?: Rules }

/** One round of the match as it was shown, for the combat log */
export interface RoundLog { round: number; events: MatchEvent[] }

export interface Session {
  seed: number;
  cast: Cast;
  /** The whole truth, the rival's hand included: only this file reads it */
  state: MatchState;
  /** The board between the two halves of a round */
  mid: MatchState | null;
  /** The events of the first half of the round being played */
  half: MatchEvent[];
  log: RoundLog[];
}

export type Stage =
  | { kind: 'plan'; view: MatchView }
  /** A reveal being played; `next` is where the screen is once it ends or is skipped */
  | { kind: 'show'; steps: Step[]; next: Stage }
  | { kind: 'fight'; mid: MatchView; options: FightOptions; scene: Scene }
  | { kind: 'end'; result: MatchResult; scene: Scene; rounds: number };

export type Show = Extract<Stage, { kind: 'show' }>;
export type Fight = Extract<Stage, { kind: 'fight' }>;

export function newSession(seed: number, cast: Cast): Session {
  const state = newMatch(cast.decks, mulberry32(hashSeed(`deal:${seed}`)), cast.rules ?? DEFAULT_RULES);
  return { seed, cast, state, mid: null, half: [], log: [] };
}

export const firstStage = (se: Session): Stage => ({ kind: 'plan', view: viewFor(se.state, ME) });

/** What the computer may see when it plans the round */
export const rivalView = (se: Session): MatchView => viewFor(se.state, RIVAL);
/** What the computer may see when it chooses its fight: the board after the reveal, its own hand */
export const rivalMid = (se: Session): MatchState => knownState(viewFor(se.mid!, RIVAL));

/** Ends the round from the board after the reveal, with both sides' fight choices */
function finish(se: Session, midView: MatchView, mine: Strikes, theirs: Strikes, mode: Mode): Show {
  const mid = se.mid!;
  const strikes: [Strikes, Strikes] = [mine, theirs];
  const out = finishRound(mid, strikes);
  se.log = [...se.log, { round: mid.round, events: [...se.half, ...out.events] }];
  se.state = out.state;
  se.mid = null;
  se.half = [];
  const next = viewFor(out.state, ME);
  const steps = clashSteps(midView, strikes, out.events, next, mode);
  const result = out.state.result;
  return { kind: 'show', steps, next: result ? { kind: 'end', result, scene: steps[steps.length - 1].scene, rounds: result.round } : { kind: 'plan', view: next } };
}

/** "Zatwierdź" on a plan, with the computer's plan made from its own view. A round with nothing to
 *  hit and nothing to guard has no fight question and plays straight through (then neither side
 *  can hit anything, so the computer's fight choice is empty too). */
export function confirmPlan(se: Session, view: MatchView, plan: Plan, rivalPlan: Plan, mode: Mode = 'together'): Show {
  const out = revealRound(se.state, [plan, rivalPlan]);
  se.mid = out.state;
  se.half = out.events;
  const mid = viewFor(out.state, ME);
  const steps = revealSteps(view, plan, mid, out.events, mode);
  const options = fightOptions(knownState(mid), ME);
  if (hasFight(options)) return { kind: 'show', steps, next: { kind: 'fight', mid, options, scene: fightScene(mid) } };
  const rest = finish(se, mid, [], [], mode);
  return { kind: 'show', steps: [...steps, ...rest.steps], next: rest.next };
}

/** "Zatwierdź" on the fight, with the computer's choice made on the same board */
export function confirmFight(se: Session, stage: Fight, choice: FightChoice, rivalStrikes: Strikes, mode: Mode = 'together'): Show {
  return finish(se, stage.mid, toStrikes(knownState(stage.mid), choice), rivalStrikes, mode);
}
