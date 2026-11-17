// Where a card or unit (or a group of them) may go while the player plans, what sending it there
// would cost and give, and why a place is refused. Every answer is the engine's: a placement is
// legal when validatePlan accepts the plan with it, its cost is planCost, the total is the
// engine's own reveal of the player's side with an empty rival plan.
import { freeMoves, planCost, validatePlan } from '@/features/cards/domain/v2/plan';
import { revealRound } from '@/features/cards/domain/v2/resolve';
import { power } from '@/features/cards/domain/v2/strength';
import { SLOTS, type Action, type FreeKind, type MatchState, type Plan, type Side, type Slot } from '@/features/cards/domain/v2/types';
import { plural } from '@/lib/plural';

/** A thing the player can give an order to: a card in the hand or an own unit on the board */
export type Ref = { kind: 'card'; id: string } | { kind: 'unit'; uid: string };

export const refKey = (r: Ref): string => (r.kind === 'card' ? `card:${r.id}` : `unit:${r.uid}`);
export const sameRef = (a: Ref | null, b: Ref | null): boolean => !!a && !!b && refKey(a) === refKey(b);

const isOf = (a: Action, ref: Ref): boolean => (a.kind === 'play' ? ref.kind === 'card' && a.card === ref.id : ref.kind === 'unit' && a.unit === ref.uid);
/** The planned action of this card or unit, if it has one */
export const actionOf = (plan: Plan, ref: Ref): Action | undefined => plan.find((a) => isOf(a, ref));
export const without = (plan: Plan, ref: Ref): Plan => plan.filter((a) => !isOf(a, ref));
export const legal = (s: MatchState, side: Side, plan: Plan): boolean => validatePlan(s, side, plan) === null;

/** Drops actions from the end until the engine accepts what is left */
export function trim(s: MatchState, side: Side, plan: Plan): Plan {
  let p = plan;
  while (p.length && !legal(s, side, p)) p = p.slice(0, -1);
  return p;
}

export function exists(s: MatchState, side: Side, ref: Ref): boolean {
  return ref.kind === 'card' ? s.sides[side].hand.some((c) => c.id === ref.id) : s.units.some((u) => u.uid === ref.uid && u.side === side);
}

/** Where a card or unit stands on the planning board: a planned card where it is played, a planned
 *  unit where it goes, a card with no order in the hand (null) */
export function shownAt(s: MatchState, plan: Plan, ref: Ref): Slot | null {
  const a = actionOf(plan, ref);
  if (a) return a.to;
  return ref.kind === 'unit' ? s.units.find((u) => u.uid === ref.uid)?.at ?? null : null;
}

type Placed = { plan: Plan } | { ask: string[] } | null;

/** The plan with this card or unit sent to an objective (its earlier order, if any, is replaced) */
export function place(s: MatchState, side: Side, plan: Plan, ref: Ref, to: Slot, replace?: string): Placed {
  if (!exists(s, side, ref)) return null;
  const base = without(plan, ref);
  if (ref.kind === 'unit') {
    // Back to where it stands: the move is taken back
    if (s.units.find((u) => u.uid === ref.uid)!.at === to) return actionOf(plan, ref) ? { plan: trim(s, side, base) } : null;
    const next: Plan = [...base, { kind: 'move', unit: ref.uid, to }];
    return legal(s, side, next) ? { plan: next } : null;
  }
  const play = (r?: string): Plan => [...base, { kind: 'play', card: ref.id, to, ...(r === undefined ? {} : { replace: r }) }];
  if (replace !== undefined && legal(s, side, play(replace))) return { plan: play(replace) };
  if (legal(s, side, play())) return { plan: play() };
  if (replace !== undefined) return null;
  const options = s.units.filter((u) => u.side === side && u.at === to && legal(s, side, play(u.uid))).map((u) => u.uid);
  return options.length ? { ask: options } : null;
}

/** A group sent to one objective is waiting for the player to say which own unit makes room */
export interface Ask { to: Slot; ref: Ref; options: string[]; done: Plan; rest: Ref[] }
export type GroupPlaced = { plan: Plan } | { ask: Ask } | null;

/** Sends a group one by one; all of it goes or none of it. `replace` answers the first question. */
export function placeGroup(s: MatchState, side: Side, plan: Plan, refs: Ref[], to: Slot, replace?: string): GroupPlaced {
  let p = plan; let answer = replace;
  for (let i = 0; i < refs.length; i++) {
    const r = place(s, side, p, refs[i], to, answer);
    if (!r) return null;
    if ('ask' in r) return { ask: { to, ref: refs[i], options: r.ask, done: p, rest: refs.slice(i + 1) } };
    if (answer !== undefined && r.plan.some((a) => a.kind === 'play' && a.replace === answer)) answer = undefined;
    p = r.plan;
  }
  return { plan: p };
}

/** Like placeGroup, but every question answered with its first option: can the group go at all */
function autoPlace(s: MatchState, side: Side, plan: Plan, refs: Ref[], to: Slot): { plan: Plan; asked: boolean } | null {
  let r = placeGroup(s, side, plan, refs, to); let asked = false;
  for (let guard = 0; r && 'ask' in r && guard < refs.length; guard++) {
    asked = true;
    const q = r.ask;
    const first = place(s, side, q.done, q.ref, to, q.options[0]);
    if (!first || 'ask' in first) return null;
    r = placeGroup(s, side, first.plan, q.rest, to);
  }
  return r && 'plan' in r ? { plan: r.plan, asked } : null;
}

export type Target = 'ok' | 'replace' | null;

/** What sending a group to one objective means: allowed or not and why, the orders it adds (less
 *  than 0 when it frees one), the free move that pays for it, and the player's total there after */
export interface TargetInfo { kind: 'ok' | 'replace' | 'off' | 'here'; why?: string; cost: number; free?: FreeKind; total?: number }

export const ordersWord = (n: number) => `${n} ${plural(n, 'rozkaz', 'rozkazy', 'rozkazów')}`;

export function targetInfo(s: MatchState, side: Side, plan: Plan, refs: Ref[]): [TargetInfo, TargetInfo, TargetInfo] {
  const used = planCost(s, side, plan);
  return SLOTS.map((to): TargetInfo => {
    if (refs.length && refs.every((r) => shownAt(s, plan, r) === to)) return { kind: 'here', cost: 0 };
    const r = autoPlace(s, side, plan, refs, to);
    if (!r) {
      const rich: MatchState = { ...s, orders: side === 0 ? [99, s.orders[1]] : [s.orders[0], 99] };
      const left = s.orders[side] - used;
      const why = autoPlace(rich, side, plan, refs, to) ? (left <= 0 ? 'Brak rozkazów' : `Masz ${ordersWord(left)}`) : 'Brak miejsca';
      return { kind: 'off', why, cost: 0 };
    }
    const cost = planCost(s, side, r.plan) - used;
    const free = cost <= 0 ? [...freeMoves(s, side, r.plan).entries()].find(([uid]) => refs.some((x) => x.kind === 'unit' && x.uid === uid))?.[1] : undefined;
    if (r.asked) return { kind: 'replace', cost, free };
    const mine = revealRound(s, side === 0 ? [r.plan, []] : [[], r.plan], { trusted: true }).state;
    return { kind: 'ok', cost, free, total: power(mine, to)[side] };
  }) as [TargetInfo, TargetInfo, TargetInfo];
}

/** Where a single card or unit may go now: 'replace' = only by discarding an own unit there */
export function targetsOf(s: MatchState, side: Side, plan: Plan, ref: Ref): [Target, Target, Target] {
  return SLOTS.map((to): Target => {
    const r = place(s, side, plan, ref, to);
    return !r ? null : 'ask' in r ? 'replace' : 'ok';
  }) as [Target, Target, Target];
}

/** Cards and units that have no order yet and could still get one: these glow */
export function actors(s: MatchState, side: Side, plan: Plan): { cards: Set<string>; units: Set<string> } {
  const can = (ref: Ref) => !actionOf(plan, ref) && targetsOf(s, side, plan, ref).some((t) => t !== null);
  return {
    cards: new Set(s.sides[side].hand.filter((c) => can({ kind: 'card', id: c.id })).map((c) => c.id)),
    units: new Set(s.units.filter((u) => u.side === side && can({ kind: 'unit', uid: u.uid })).map((u) => u.uid)),
  };
}

/** Own units with no order that a free move could carry now (a Support played from the hand brings
 *  one unit to its objective; the Twin Gates let one unit leave them), by the kind that pays */
export function freeOffers(s: MatchState, side: Side, plan: Plan): Map<string, FreeKind> {
  const out = new Map<string, FreeKind>();
  const used = planCost(s, side, plan);
  for (const u of s.units) {
    if (u.side !== side || actionOf(plan, { kind: 'unit', uid: u.uid })) continue;
    for (const to of SLOTS) {
      if (to === u.at) continue;
      const next: Plan = [...plan, { kind: 'move', unit: u.uid, to }];
      if (!legal(s, side, next) || planCost(s, side, next) !== used) continue;
      const kind = freeMoves(s, side, next).get(u.uid);
      if (kind) { out.set(u.uid, kind); break; }
    }
  }
  return out;
}
