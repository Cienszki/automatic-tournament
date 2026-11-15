// The computer opponents a player can choose, and the one that plays Kolejka's team decks.
// Each level is a way of planning, a way of fighting, and (for the easy one) a rate of slips.
// None of them sees the rival's hand, deck order or plan, and none uses the `answer` way of
// fighting: it beats a player who fights the obvious way far too often for a practice opponent.
import type { GCard } from '@/lib/card-lab/cards';
import { validatePlan } from '../plan';
import type { Plan } from '../types';
import { makeAgent, type Agent, type AgentName } from './agents';
import { guessState } from './guess';
import type { PlannerConfig } from './planner';
import { mulberry32 } from './rng';
import type { StrikePolicy } from './strikes';

export type Level = 'easy' | 'medium' | 'hard';
/** `kolejka` plays a real team's deck: the plain player, so that the difficulty is the deck */
export type Opponent = Level | 'kolejka';

export interface LevelSpec {
  /** Polish name shown to the player */
  name: string;
  color: string;
  agent: AgentName;
  strikes: StrikePolicy;
  /** Share of rounds in which it leaves the last action of its plan undone */
  slip: number;
  /** Search settings, when they differ from the planner's own */
  planner?: Partial<PlannerConfig>;
}

export const LEVELS: Record<Opponent, LevelSpec> = {
  easy: { name: 'Łatwy', color: '#3fbf7f', agent: 'greedy', strikes: 'obvious', slip: 0.3 },
  medium: { name: 'Średni', color: '#f0c419', agent: 'responder', strikes: 'mixed', slip: 0 },
  hard: { name: 'Trudny', color: '#e5534b', agent: 'planner', strikes: 'mixed', slip: 0, planner: { samples: 6, width: 6, keep: 12 } },
  kolejka: { name: 'Kolejka', color: '#5ab0ff', agent: 'greedy', strikes: 'obvious', slip: 0 },
};

export interface LevelOptions { pool: GCard[]; seed: number }

/** The computer player for a level */
export function makeOpponent(level: Opponent, opts: LevelOptions): Agent {
  const spec = LEVELS[level];
  const base = makeAgent(spec.agent, { pool: opts.pool, seed: opts.seed, strikes: spec.strikes, planner: spec.planner });
  if (!spec.slip) return base;
  const rnd = mulberry32(opts.seed ^ 0x2545f491);
  return {
    ...base,
    decide(v, insight) {
      const d = base.decide(v, insight);
      if (d.plan.length === 0 || rnd() >= spec.slip) return d;
      // A slip: the last action is forgotten, if what is left is still a legal plan
      const shorter: Plan = d.plan.slice(0, -1);
      const legal = validatePlan(guessState(v, opts.pool, rnd), v.side, shorter) === null;
      return legal ? { ...d, plan: shorter } : d;
    },
  };
}
