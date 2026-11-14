// The computer players of v2. None sees the rival's hand, deck order or plan, except `omniscient`,
// which is a measuring instrument: it is handed the true state and the rival's actual plan.
//   random     a random legal plan that spends its orders
//   greedy     the best plan if the rival did nothing this round (beam search, search.ts)
//   responder  predicts the rival with greedy on guessed hands, answers those predictions
//   planner    planner.ts; `planner-mixed` picks among near-best plans at random
//   omniscient best answer to the rival's actual plan
//   exploiter  knows the rival is the deterministic planner and repeats its reasoning on guessed
//              hands (the planner's guesses use a public seed, so only its hand is unknown)
import type { GCard } from '@/lib/card-lab/cards';
import { other, type MatchState, type Plan } from '../types';
import { viewFor, type MatchView } from '../view';
import { candidateActions } from './actions';
import { guessState, plausibleCards } from './guess';
import { PLANNER, plannerDecide, type Decision, type PlannerConfig } from './planner';
import { mulberry32, type Rnd } from './rng';
import { beamSearch, rankPlans, type Scenario } from './search';

export type AgentName = 'random' | 'greedy' | 'responder' | 'planner' | 'planner-mixed' | 'omniscient' | 'exploiter';
export const AGENT_NAMES: AgentName[] = ['random', 'greedy', 'responder', 'planner', 'planner-mixed', 'omniscient', 'exploiter'];

/** Only for `omniscient` */
export interface Insight { state: MatchState; rivalPlan: Plan }

export interface Agent {
  name: AgentName;
  /** True if the match runner must hand it the rival's plan */
  omniscient: boolean;
  decide(v: MatchView, insight?: Insight): Decision;
}

const SEARCH = { width: PLANNER.width, keep: PLANNER.keep };

function randomPlan(v: MatchView, pool: GCard[], rnd: Rnd): Plan {
  const s = guessState(v, pool, rnd);
  const plan: Plan = [];
  for (;;) {
    const acts = candidateActions(s, v.side, plan);
    // Every candidate is legal, so this stops when the orders (and free moves) are spent
    if (!acts.length) return plan;
    plan.push(acts[Math.floor(rnd() * acts.length)]);
  }
}

function greedyPlan(v: MatchView, pool: GCard[], rnd: Rnd): Plan {
  const state = guessState(v, pool, rnd);
  return beamSearch(v.side, [{ state, plan: [], weight: 1 }], SEARCH)[0].plan;
}

function responderPlan(v: MatchView, pool: GCard[], rnd: Rnd, samples: number): Plan {
  const op = other(v.side);
  const plausible = plausibleCards(v, pool);
  const predicted: Scenario[] = [];
  for (let i = 0; i < samples; i++) {
    const state = guessState(v, pool, rnd, plausible);
    predicted.push({ state, plan: beamSearch(op, [{ state, plan: [], weight: 1 }], SEARCH)[0].plan, weight: 1 });
  }
  return beamSearch(v.side, predicted, SEARCH)[0].plan;
}

function omniscientPlan(v: MatchView, insight: Insight): Plan {
  const real: Scenario[] = [{ state: insight.state, plan: insight.rivalPlan, weight: 1 }];
  const answers = beamSearch(v.side, real, SEARCH);
  const greedy = beamSearch(v.side, [{ state: insight.state, plan: [], weight: 1 }], SEARCH);
  return rankPlans(v.side, [...answers, ...greedy].map((p) => p.plan), real, { race: true })[0].plan;
}

function exploiterPlan(v: MatchView, pool: GCard[], rnd: Rnd, samples: number, model: PlannerConfig): Plan {
  const op = other(v.side);
  const plausible = plausibleCards(v, pool);
  const predicted: Scenario[] = [];
  for (let i = 0; i < samples; i++) {
    const state = guessState(v, pool, rnd, plausible);
    const plan = plannerDecide(viewFor(state, op), pool, { ...model, mixed: false }).plan;
    predicted.push({ state, plan, weight: 1 });
  }
  const answers = beamSearch(v.side, predicted, SEARCH);
  return rankPlans(v.side, answers.map((p) => p.plan), predicted, { race: true })[0].plan;
}

export interface AgentOptions { pool: GCard[]; seed: number; planner?: Partial<PlannerConfig>; samples?: number }

export function makeAgent(name: AgentName, opts: AgentOptions): Agent {
  const rnd = mulberry32(opts.seed);
  const cfg: PlannerConfig = { ...PLANNER, ...opts.planner, mixed: name === 'planner-mixed' || !!opts.planner?.mixed };
  const samples = opts.samples ?? PLANNER.samples;
  const agent = (decide: Agent['decide'], omniscient = false): Agent => ({ name, omniscient, decide });
  switch (name) {
    case 'random': return agent((v) => ({ plan: randomPlan(v, opts.pool, rnd) }));
    case 'greedy': return agent((v) => ({ plan: greedyPlan(v, opts.pool, rnd) }));
    case 'responder': return agent((v) => ({ plan: responderPlan(v, opts.pool, rnd, samples) }));
    case 'planner':
    case 'planner-mixed': return agent((v) => plannerDecide(v, opts.pool, cfg, rnd));
    case 'omniscient': return agent((v, insight) => ({ plan: omniscientPlan(v, insight!) }), true);
    case 'exploiter': return agent((v) => ({ plan: exploiterPlan(v, opts.pool, rnd, samples, cfg) }));
  }
}

