// Finding good plans by beam search. A plan is built one action at a time; after each step only
// the `width` best partial plans are extended (scored as if they were the whole plan). Every plan
// scored on the way is kept, so the result is a ranked pool of distinct plans, not just the best.
// Cost: about width x (actions per step) x (steps) x (rival plans) round resolutions.
import { resolveRound } from '../resolve';
import type { MatchState, Plan, Side } from '../types';
import { candidateActions, planKey } from './actions';
import { evaluate, type EvalOptions } from './evaluate';

/** A rival plan to score against, in the hypothetical state it was made for */
export interface Scenario { state: MatchState; plan: Plan; weight: number }
export interface Scored { plan: Plan; score: number }

export interface SearchOptions { width: number; keep: number; eval?: EvalOptions }
export const DEFAULT_SEARCH: SearchOptions = { width: 4, keep: 8 };

/** Expected evaluation of `plan` for `side` over the scenarios */
export function scorePlan(side: Side, plan: Plan, scenarios: Scenario[], opts: EvalOptions = {}): number {
  let total = 0;
  let weight = 0;
  for (const sc of scenarios) {
    const plans: [Plan, Plan] = side === 0 ? [plan, sc.plan] : [sc.plan, plan];
    total += sc.weight * evaluate(resolveRound(sc.state, plans, { trusted: true }).state, side, opts);
    weight += sc.weight;
  }
  return weight ? total / weight : 0;
}

export function beamSearch(side: Side, scenarios: Scenario[], opts: SearchOptions = DEFAULT_SEARCH): Scored[] {
  const base = scenarios[0].state;
  const all = new Map<string, Scored>();
  const empty: Scored = { plan: [], score: scorePlan(side, [], scenarios, opts.eval) };
  all.set('', empty);
  let frontier = [empty];
  while (frontier.length) {
    const children: Scored[] = [];
    for (const p of frontier) {
      for (const a of candidateActions(base, side, p.plan)) {
        const plan = [...p.plan, a];
        const key = planKey(plan);
        if (all.has(key)) continue;
        const scored = { plan, score: scorePlan(side, plan, scenarios, opts.eval) };
        all.set(key, scored);
        children.push(scored);
      }
    }
    children.sort((a, b) => b.score - a.score);
    frontier = children.slice(0, opts.width);
  }
  return [...all.values()].sort((a, b) => b.score - a.score).slice(0, opts.keep);
}

/** The best of a set of plans against the scenarios, all scored */
export function rankPlans(side: Side, plans: Plan[], scenarios: Scenario[], opts: EvalOptions = {}): Scored[] {
  const seen = new Set<string>();
  const out: Scored[] = [];
  for (const plan of plans) {
    const key = planKey(plan);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ plan, score: scorePlan(side, plan, scenarios, opts) });
  }
  return out.sort((a, b) => b.score - a.score);
}
