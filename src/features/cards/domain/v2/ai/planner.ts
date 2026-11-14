// The planner: plays well without seeing the rival's hand or plan.
//  1. Guess the rival's hand `samples` times (guess.ts).
//  2. For each guess, find the rival's good plans assuming this side does nothing (its greedy
//     pool), and model three rival plans: its greedy best (weight 2), a random other plan from its
//     pool (weight 1, the noise), and the pool plan that does best against this side's own greedy
//     plan (weight 1.5, a rival who reads us).
//  3. Candidate plans for this side: its own greedy pool, plus the best plans against the rival's
//     greedy bests.
//  4. Score each candidate against all modelled rival plans, with the damage-race look-ahead
//     (evaluate.ts), and play the best; `mixed` picks at random among plans within `mixEps`.
import type { GCard } from '@/lib/card-lab/cards';
import { other, type Plan } from '../types';
import type { MatchView } from '../view';
import { guessState, plausibleCards } from './guess';
import { hashSeed, mulberry32, type Rnd } from './rng';
import { beamSearch, rankPlans, type Scenario, type Scored } from './search';

export interface PlannerConfig { samples: number; width: number; keep: number; mixed: boolean; mixEps: number }
export const PLANNER: PlannerConfig = { samples: 3, width: 4, keep: 8, mixed: false, mixEps: 0.75 };

export interface Decision { plan: Plan; greedy?: Plan }

/** A seed from what both players can see, so a rival can repeat this player's guesses exactly */
export function publicSeed(v: MatchView): number {
  const hp = v.side === 0 ? [v.hp, v.rival.hp] : [v.rival.hp, v.hp];
  const hands = v.side === 0 ? [v.hand.length, v.rival.handSize] : [v.rival.handSize, v.hand.length];
  const units = v.public.units.map((u) => `${u.uid}@${u.at}+${u.growth}`).sort().join(',');
  return hashSeed(`${v.side}|${v.public.round}|${hp}|${hands}|${v.grave.length},${v.rival.grave.length}|${units}`);
}

/** The rival plans the planner prepares for, one set per guessed hand */
export function modelRival(v: MatchView, pool: GCard[], rnd: Rnd, cfg: PlannerConfig, myGreedy: Plan): Scenario[] {
  const op = other(v.side);
  const plausible = plausibleCards(v, pool);
  const out: Scenario[] = [];
  for (let i = 0; i < cfg.samples; i++) {
    const state = guessState(v, pool, rnd, plausible);
    const theirs = beamSearch(op, [{ state, plan: [], weight: 1 }], { width: cfg.width, keep: 4 });
    out.push({ state, plan: theirs[0].plan, weight: 2 });
    if (theirs.length > 1) out.push({ state, plan: theirs[1 + Math.floor(rnd() * (theirs.length - 1))].plan, weight: 1 });
    const reads = rankPlans(op, theirs.map((t) => t.plan), [{ state, plan: myGreedy, weight: 1 }]);
    out.push({ state, plan: reads[0].plan, weight: 1.5 });
  }
  return out;
}

export function choose(ranked: Scored[], cfg: Pick<PlannerConfig, 'mixed' | 'mixEps'>, rnd: Rnd): Plan {
  if (!cfg.mixed) return ranked[0].plan;
  const near = ranked.filter((r) => r.score >= ranked[0].score - cfg.mixEps);
  return near[Math.floor(rnd() * near.length)].plan;
}

/**
 * The planner's decision. Its guesses use a seed from public information, so the same board gives
 * the same plan (an exploiter can repeat it); `mixRnd` is private and only used when `mixed`.
 */
export function plannerDecide(v: MatchView, pool: GCard[], cfg: PlannerConfig = PLANNER, mixRnd: Rnd = Math.random): Decision {
  const rnd = mulberry32(publicSeed(v));
  const base = guessState(v, pool, rnd);
  const greedyPool = beamSearch(v.side, [{ state: base, plan: [], weight: 1 }], { width: cfg.width, keep: cfg.keep });
  const greedy = greedyPool[0].plan;
  const rival = modelRival(v, pool, rnd, cfg, greedy);
  const bests = rival.filter((r) => r.weight === 2);
  const answers = beamSearch(v.side, bests, { width: cfg.width, keep: cfg.keep });
  const ranked = rankPlans(v.side, [...greedyPool, ...answers].map((p) => p.plan), rival, { race: true });
  return { plan: choose(ranked, cfg, mixRnd), greedy };
}

