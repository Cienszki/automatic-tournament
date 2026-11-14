// Checking a plan: what it costs in orders (with the free moves of Smoke and Twin Gates) and
// whether it is legal against the board at the start of the round.
import type { Action, FreeKind, MatchState, Plan, Side, Slot, Unit } from './types';

type Move = Extract<Action, { kind: 'move' }>;
type Play = Extract<Action, { kind: 'play' }>;

/** Objectives where this side had a Soft Support at the start of the round (Smoke) */
export function smokeSlots(s: MatchState, side: Side): Set<Slot> {
  const out = new Set<Slot>();
  if (!s.rules.abilities.smoke) return out;
  for (const u of s.units) if (u.side === side && u.card.role === 'Soft Support') out.add(u.at);
  return out;
}

/** The Twin Gates slot if this side controlled it at the end of the previous round */
export function gatesSlot(s: MatchState, side: Side): Slot | null {
  const g = s.objectives.indexOf('gates');
  return g >= 0 && s.control[g] === side ? (g as Slot) : null;
}

/**
 * Which moves the free moves pay for: at most one Smoke move and one Twin Gates move, never the
 * same move twice, as many as possible (players never choose this; the cheapest reading applies).
 */
export function freeMoves(s: MatchState, side: Side, plan: Plan): Map<string, FreeKind> {
  const moves = plan.filter((a): a is Move => a.kind === 'move');
  const smoke = smokeSlots(s, side);
  const gates = gatesSlot(s, side);
  const at = (uid: string) => s.units.find((u) => u.uid === uid)?.at;
  const smokeOk = moves.filter((m) => { const a = at(m.unit); return a !== undefined && smoke.has(a); }).map((m) => m.unit);
  const gatesOk = gates === null ? [] : moves.filter((m) => at(m.unit) === gates).map((m) => m.unit);
  const out = new Map<string, FreeKind>();
  // Give the Gates move to a unit Smoke cannot pay for when there is a choice
  const g = gatesOk.find((u) => !smokeOk.includes(u)) ?? gatesOk[0];
  const sm = smokeOk.find((u) => u !== g);
  if (sm !== undefined) out.set(sm, 'smoke');
  if (g !== undefined) out.set(g, 'gates');
  return out;
}

/** Orders the plan uses */
export function planCost(s: MatchState, side: Side, plan: Plan): number {
  return plan.length - freeMoves(s, side, plan).size;
}

function checkPlays(s: MatchState, side: Side, plays: Play[], mine: Map<string, Unit>): string | null {
  const hand = new Set(s.sides[side].hand.map((c) => c.id));
  const seen = new Set<string>();
  for (const p of plays) {
    if (!hand.has(p.card)) return `card ${p.card} is not in hand`;
    if (seen.has(p.card)) return `card ${p.card} is played twice`;
    seen.add(p.card);
    if (p.replace === undefined) continue;
    if (!s.rules.replace) return 'replacing is switched off';
    const r = mine.get(p.replace);
    if (!r || r.at !== p.to) return `replace target ${p.replace} is not an own unit on that objective`;
  }
  return null;
}

function checkMoves(moves: Move[], mine: Map<string, Unit>, replaced: Set<string>): string | null {
  const seen = new Set<string>();
  for (const m of moves) {
    const u = mine.get(m.unit);
    if (!u) return `unit ${m.unit} is not an own unit on the board`;
    if (seen.has(m.unit)) return `unit ${m.unit} moves twice`;
    if (replaced.has(m.unit)) return `unit ${m.unit} is discarded and moved`;
    if (u.at === m.to) return `unit ${m.unit} is already there`;
    seen.add(m.unit);
  }
  return null;
}

/** Capacity at the end of the plan; a replace is legal only where it is needed to make room */
function checkCapacity(s: MatchState, side: Side, plan: Plan, mine: Map<string, Unit>): string | null {
  const cap = s.rules.capacity;
  for (const slot of [0, 1, 2] as Slot[]) {
    let n = 0;
    for (const u of mine.values()) if (u.at === slot) n++;
    let replaces = 0;
    for (const a of plan) {
      if (a.kind === 'move') {
        if (mine.get(a.unit)!.at === slot) n--;
        if (a.to === slot) n++;
      } else if (a.to === slot) {
        n++;
        if (a.replace !== undefined) replaces++;
      }
    }
    if (replaces > Math.max(0, n - cap)) return `a replace on objective ${slot} is not needed`;
    if (n - replaces > cap) return `more than ${cap} units on objective ${slot}`;
  }
  return null;
}

/** Why the plan is illegal for this side this round, or null when it is legal */
export function validatePlan(s: MatchState, side: Side, plan: Plan): string | null {
  if (s.result) return 'the match is over';
  const mine = new Map(s.units.filter((u) => u.side === side).map((u) => [u.uid, u]));
  const plays = plan.filter((a): a is Play => a.kind === 'play');
  const moves = plan.filter((a): a is Move => a.kind === 'move');
  const replaced = new Set(plays.flatMap((p) => (p.replace === undefined ? [] : [p.replace])));
  if (replaced.size !== plays.filter((p) => p.replace !== undefined).length) return 'a unit is replaced twice';
  const problem = checkPlays(s, side, plays, mine) ?? checkMoves(moves, mine, replaced) ?? checkCapacity(s, side, plan, mine);
  if (problem) return problem;
  const used = planCost(s, side, plan);
  if (used > s.orders[side]) return `plan needs ${used} orders, side has ${s.orders[side]}`;
  return null;
}
