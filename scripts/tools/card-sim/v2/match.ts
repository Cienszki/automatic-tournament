// One v2 match between two computer players, with the record the experiments count.
// Each side decides from its own view (viewFor); an omniscient side is also handed the true state
// and the rival's plan, so the rival decides first.
import type { GCard } from '@/lib/card-lab/cards';
import type { ObjId } from '@/lib/card-lab/outposts';
import { makeAgent, type Agent, type AgentName } from '@/features/cards/domain/v2/ai/agents';
import type { PlannerConfig } from '@/features/cards/domain/v2/ai/planner';
import { planKey } from '@/features/cards/domain/v2/ai/actions';
import { planCost } from '@/features/cards/domain/v2/plan';
import { resolveRound } from '@/features/cards/domain/v2/resolve';
import type { Rules } from '@/features/cards/domain/v2/rules';
import { newMatch, type MatchOptions } from '@/features/cards/domain/v2/setup';
import type { EndReason, MatchEvent, Plan, Side } from '@/features/cards/domain/v2/types';
import { viewFor } from '@/features/cards/domain/v2/view';
import { stream, subSeed } from '../rng';

export interface SideRecord {
  plays: number; moves: number; freeMoves: number; smokeMoves: number; gatesMoves: number;
  unusedOrders: number; ordersTotal: number;
  ganks: number; gankBlocked: number; gankEmpty: number; ganked: number; replaces: number;
  farmGrowth: number; aura: number; team: number; highGround: number;
  handEnd: number; deckEnd: number;
  /** Damage dealt, by objective id */
  damage: Partial<Record<ObjId, number>>;
  /** Rounds where this side's chosen plan differed from its greedy plan (planner only) */
  differsFromGreedy: number; decisions: number;
}

export interface MatchRecord {
  winner: Side | null; reason: EndReason; rounds: number; objectives: ObjId[];
  /** HP of both Ancients after each round */
  hp: Array<[number, number]>;
  /** Controller of each objective in each round */
  control: Array<Array<Side | null>>;
  /** Rounds with at least one objective where both sides stood with equal strength */
  tiedRounds: number;
  /** Rounds with at least one objective nobody controlled (tie or empty) */
  openRounds: number;
  sides: [SideRecord, SideRecord];
  events?: MatchEvent[][];
}

const emptySide = (): SideRecord => ({
  plays: 0, moves: 0, freeMoves: 0, smokeMoves: 0, gatesMoves: 0, unusedOrders: 0, ordersTotal: 0, ganks: 0, gankBlocked: 0, gankEmpty: 0,
  ganked: 0, replaces: 0, farmGrowth: 0, aura: 0, team: 0, highGround: 0, handEnd: 0, deckEnd: 0, damage: {}, differsFromGreedy: 0, decisions: 0,
});

function count(rec: MatchRecord, events: MatchEvent[], objectives: ObjId[]): void {
  let tied = false; let open = false;
  const control: Array<Side | null> = [null, null, null];
  for (const e of events) {
    if (e.kind === 'play') { rec.sides[e.side].plays++; if (e.replaced) rec.sides[e.side].replaces++; }
    else if (e.kind === 'move') {
      const r = rec.sides[e.side]; r.moves++;
      if (e.free) { r.freeMoves++; if (e.free === 'smoke') r.smokeMoves++; else r.gatesMoves++; }
    } else if (e.kind === 'gank') {
      const r = rec.sides[e.side];
      if (e.blocked) r.gankBlocked++; else if (!e.target) r.gankEmpty++; else { r.ganks++; rec.sides[e.side === 0 ? 1 : 0].ganked++; }
    } else if (e.kind === 'control') {
      control[e.at] = e.controller;
      if (e.controller === null) { open = true; if (e.power[0] > 0 && e.power[0] === e.power[1]) tied = true; }
    } else if (e.kind === 'damage') {
      const d = rec.sides[e.side].damage; const id = objectives[e.at];
      d[id] = (d[id] ?? 0) + e.amount;
    } else if (e.kind === 'farm') rec.sides[e.side].farmGrowth++;
    else if (e.kind === 'bonus') { const r = rec.sides[e.side]; r.aura += e.aura; r.team += e.team; r.highGround += e.highGround; }
  }
  rec.control.push(control);
  if (tied) rec.tiedRounds++;
  if (open) rec.openRounds++;
}

export interface MatchSetup {
  decks: [GCard[], GCard[]];
  agents: [AgentName, AgentName];
  rules: Rules;
  seed: number;
  /** Cards the computer players guess unseen rival cards from (the tournament's pool) */
  pool: GCard[];
  options?: MatchOptions;
  planner?: Partial<PlannerConfig>;
  keepEvents?: boolean;
}

export function playMatch(m: MatchSetup): MatchRecord {
  let s = newMatch(m.decks, stream(m.seed, 'deal'), m.rules, m.options);
  const agents: [Agent, Agent] = [0, 1].map((i) => makeAgent(m.agents[i], { pool: m.pool, seed: subSeed(m.seed, 'agent', i), planner: m.planner })) as [Agent, Agent];
  const rec: MatchRecord = { winner: null, reason: 'draw', rounds: 0, objectives: [...s.objectives], hp: [], control: [], tiedRounds: 0, openRounds: 0, sides: [emptySide(), emptySide()], events: m.keepEvents ? [] : undefined };
  while (!s.result) {
    const plans: [Plan | null, Plan | null] = [null, null];
    for (const side of [0, 1] as Side[]) {
      if (agents[side].omniscient) continue;
      const d = agents[side].decide(viewFor(s, side));
      plans[side] = d.plan;
      if (d.greedy) { rec.sides[side].decisions++; if (planKey(d.greedy) !== planKey(d.plan)) rec.sides[side].differsFromGreedy++; }
    }
    for (const side of [0, 1] as Side[]) {
      if (!agents[side].omniscient) continue;
      const rivalPlan = plans[side === 0 ? 1 : 0] ?? [];
      plans[side] = agents[side].decide(viewFor(s, side), { state: s, rivalPlan }).plan;
    }
    for (const side of [0, 1] as Side[]) {
      const r = rec.sides[side];
      r.ordersTotal += s.orders[side];
      r.unusedOrders += s.orders[side] - planCost(s, side, plans[side]!);
    }
    const out = resolveRound(s, plans as [Plan, Plan]);
    count(rec, out.events, rec.objectives);
    rec.events?.push(out.events);
    s = out.state;
    rec.hp.push([s.sides[0].hp, s.sides[1].hp]);
  }
  rec.winner = s.result.winner; rec.reason = s.result.reason; rec.rounds = s.result.round;
  for (const side of [0, 1] as Side[]) { rec.sides[side].handEnd = s.sides[side].hand.length; rec.sides[side].deckEnd = s.sides[side].deck.length; }
  return rec;
}
