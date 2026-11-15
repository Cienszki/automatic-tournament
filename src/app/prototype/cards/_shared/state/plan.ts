// The plan a player builds before "Zatwierdź": one reducer. It only ever holds a plan the engine
// accepts (validatePlan), so the confirm button can send it as it stands. Nothing here resolves a
// round; the preview of the player's own side is the engine's reveal with an empty rival plan.
import { planCost, validatePlan } from '@/features/cards/domain/v2/plan';
import { revealRound } from '@/features/cards/domain/v2/resolve';
import { SLOTS, type Action, type MatchState, type Plan, type Side, type Slot } from '@/features/cards/domain/v2/types';
import type { MatchView } from '@/features/cards/domain/v2/view';
import { knownState, ME, objectiveModels, RIVAL, unitModel, type Scene } from './scene';

/** A thing the player can give an order to: a card in the hand or an own unit on the board */
export type Ref = { kind: 'card'; id: string } | { kind: 'unit'; uid: string };

export interface PlanState {
  plan: Plan;
  /** Tapped and waiting for its objective (tap, then tap) */
  pick: Ref | null;
  /** The picked card goes onto a full objective: one of these own units must make room */
  ask: { to: Slot; options: string[] } | null;
  /** Counts refused actions, so the screen can spring the refused thing back */
  refused: number;
}

export type PlanAction =
  | { type: 'pick'; ref: Ref | null }
  /** The picked thing goes to an objective */
  | { type: 'send'; to: Slot; replace?: string }
  /** Pick and send in one (a drag) */
  | { type: 'drop'; ref: Ref; to: Slot; replace?: string }
  /** Takes back one action: the one of `ref`, or the last one */
  | { type: 'undo'; ref?: Ref }
  | { type: 'clear' };

export const EMPTY_PLAN: PlanState = { plan: [], pick: null, ask: null, refused: 0 };

export const sameRef = (a: Ref | null, b: Ref | null): boolean =>
  !!a && !!b && a.kind === b.kind && (a.kind === 'card' ? a.id === (b as typeof a).id : a.uid === (b as typeof a).uid);

const isOf = (a: Action, ref: Ref): boolean => (a.kind === 'play' ? ref.kind === 'card' && a.card === ref.id : ref.kind === 'unit' && a.unit === ref.uid);
/** The planned action of this card or unit, if it has one */
export const actionOf = (plan: Plan, ref: Ref): Action | undefined => plan.find((a) => isOf(a, ref));
const without = (plan: Plan, ref: Ref): Plan => plan.filter((a) => !isOf(a, ref));
const legal = (s: MatchState, side: Side, plan: Plan): boolean => validatePlan(s, side, plan) === null;

/** Drops actions from the end until the engine accepts what is left */
function trim(s: MatchState, side: Side, plan: Plan): Plan {
  let p = plan;
  while (p.length && !legal(s, side, p)) p = p.slice(0, -1);
  return p;
}

function exists(s: MatchState, side: Side, ref: Ref): boolean {
  return ref.kind === 'card' ? s.sides[side].hand.some((c) => c.id === ref.id) : s.units.some((u) => u.uid === ref.uid && u.side === side);
}

type Placed = { plan: Plan } | { ask: string[] } | null;

/** The plan with this card or unit sent to an objective (its earlier order, if any, is replaced) */
function place(s: MatchState, side: Side, plan: Plan, ref: Ref, to: Slot, replace?: string): Placed {
  if (!exists(s, side, ref)) return null;
  const base = without(plan, ref);
  if (ref.kind === 'unit') {
    // Back to where it stands: the move is taken back
    if (s.units.find((u) => u.uid === ref.uid)!.at === to) return actionOf(plan, ref) ? { plan: trim(s, side, base) } : null;
    const next: Plan = [...base, { kind: 'move', unit: ref.uid, to }];
    return legal(s, side, next) ? { plan: next } : null;
  }
  const play = (r?: string): Plan => [...base, { kind: 'play', card: ref.id, to, ...(r === undefined ? {} : { replace: r }) }];
  if (replace !== undefined) return legal(s, side, play(replace)) ? { plan: play(replace) } : null;
  if (legal(s, side, play())) return { plan: play() };
  const options = s.units.filter((u) => u.side === side && u.at === to && legal(s, side, play(u.uid))).map((u) => u.uid);
  return options.length ? { ask: options } : null;
}

export type Target = 'ok' | 'replace' | null;

/** Where this card or unit may go now: 'replace' = only by discarding an own unit there */
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

export function reducePlan(ps: PlanState, a: PlanAction, s: MatchState, side: Side): PlanState {
  const refuse = (): PlanState => ({ ...ps, pick: null, ask: null, refused: ps.refused + 1 });
  const send = (ref: Ref, to: Slot, replace?: string): PlanState => {
    const r = place(s, side, ps.plan, ref, to, replace);
    if (!r) return refuse();
    if ('ask' in r) return { ...ps, pick: ref, ask: { to, options: r.ask } };
    return { plan: r.plan, pick: null, ask: null, refused: ps.refused };
  };
  switch (a.type) {
    case 'pick': {
      if (!a.ref || sameRef(ps.pick, a.ref)) return { ...ps, pick: null, ask: null };
      if (!exists(s, side, a.ref)) return refuse();
      // Something with no order and nowhere to go cannot be picked up
      if (!actionOf(ps.plan, a.ref) && !targetsOf(s, side, ps.plan, a.ref).some((t) => t !== null)) return refuse();
      return { ...ps, pick: a.ref, ask: null };
    }
    case 'send': return ps.pick ? send(ps.pick, a.to, a.replace) : ps;
    case 'drop': return send(a.ref, a.to, a.replace);
    case 'undo': {
      if (!ps.plan.length) return { ...ps, pick: null, ask: null };
      const plan = trim(s, side, a.ref ? without(ps.plan, a.ref) : ps.plan.slice(0, -1));
      return { plan, pick: null, ask: null, refused: ps.refused };
    }
    case 'clear': return { ...EMPTY_PLAN, refused: ps.refused };
  }
}

/** The board while planning: the rival as it stands, the player's side with the plan applied, and
 *  the player's own totals. Nothing about the rival's round is in it. */
export function planScene(view: MatchView, plan: Plan): Scene {
  const known = knownState(view);
  const mine = revealRound(known, view.side === ME ? [plan, []] : [[], plan]).state;
  const before = new Map(known.units.map((u) => [u.uid, u]));
  return {
    round: known.round,
    objectives: objectiveModels(mine, () => 'mine'),
    units: [
      ...known.units.filter((u) => u.side === RIVAL).map((u) => unitModel(known, u)),
      ...mine.units.filter((u) => u.side === ME).map((u) => {
        const was = before.get(u.uid);
        return { ...unitModel(mine, u), ...(was ? (was.at !== u.at ? { planned: 'move' as const } : {}) : { planned: 'play' as const }) };
      }),
    ],
    hp: [view.hp, view.rival.hp],
    hand: mine.sides[ME].hand,
    rivalHand: view.rival.handSize,
    orders: { have: known.orders[ME], used: planCost(known, ME, plan) },
    fx: [],
  };
}
