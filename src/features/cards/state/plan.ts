// The plan a player builds before "Zatwierdź": one reducer. It only ever holds a plan the engine
// accepts (validatePlan), so the confirm button can send it as it stands. Nothing here resolves a
// round; the preview of the player's own side is the engine's reveal with an empty rival plan.
//
// Several things can be picked at once and sent with one tap, as in today's game: hand cards (as
// many as the orders allow), or units shown on one objective. A group goes whole or not at all.
import { freeMoves, planCost } from '@/features/cards/domain/v2/plan';
import { revealRound } from '@/features/cards/domain/v2/resolve';
import type { MatchState, Plan, Side, Slot } from '@/features/cards/domain/v2/types';
import type { MatchView } from '@/features/cards/domain/v2/view';
import { actionOf, exists, freeOffers, placeGroup, place, sameRef, shownAt, targetInfo, trim, without, type Ask, type Ref } from './place';
import { knownState, ME, objectiveModels, RIVAL, unitModel, type Scene } from './scene';

export { actionOf, actors, sameRef, targetsOf, targetInfo, type Ref, type Target, type TargetInfo } from './place';

export interface PlanState {
  plan: Plan;
  /** Picked and waiting for an objective (tap, then tap): cards, or units shown on one objective */
  picks: Ref[];
  /** The picked group goes onto a full objective: one of these own units must make room */
  ask: Ask | null;
  /** Counts refused actions, so the screen can spring the refused thing back */
  refused: number;
  /** Why the last action was refused (Polish, for the prompt line) */
  why: string | null;
}

export type PlanAction =
  /** A tap on a card or unit: adds it to the group, or takes it out; null puts everything down */
  | { type: 'pick'; ref: Ref | null }
  /** The picked group goes to an objective; `replace` answers which own unit makes room */
  | { type: 'send'; to: Slot; replace?: string }
  /** Pick and send in one (a drag); `replace` = it was dropped onto that own unit */
  | { type: 'drop'; refs: Ref[]; to: Slot; replace?: string }
  /** Takes back one action: the one of `ref`, or the last one */
  | { type: 'undo'; ref?: Ref }
  | { type: 'clear' };

export const EMPTY_PLAN: PlanState = { plan: [], picks: [], ask: null, refused: 0, why: null };

/** Can this card or unit be picked up at all: it has an order to change, or somewhere to go */
const movable = (s: MatchState, side: Side, plan: Plan, ref: Ref): boolean =>
  !!actionOf(plan, ref) || targetInfo(s, side, plan, [ref]).some((t) => t.kind === 'ok' || t.kind === 'replace');

/** Could this group still be sent somewhere together */
const sendable = (s: MatchState, side: Side, plan: Plan, refs: Ref[]): boolean =>
  targetInfo(s, side, plan, refs).some((t) => t.kind === 'ok' || t.kind === 'replace');

/** Why a group cannot grow by one more: the orders, or no common place */
function growWhy(s: MatchState, side: Side, plan: Plan): string {
  const left = s.orders[side] - planCost(s, side, plan);
  return left <= 0 ? 'Brak rozkazów' : `Masz ${left === 1 ? '1 rozkaz' : `${left} rozkazy`}`;
}

function pick(ps: PlanState, ref: Ref | null, s: MatchState, side: Side): PlanState {
  const refuse = (why: string): PlanState => ({ ...ps, ask: null, refused: ps.refused + 1, why });
  if (!ref) return { ...ps, picks: [], ask: null, why: null };
  if (ps.picks.some((p) => sameRef(p, ref))) return { ...ps, picks: ps.picks.filter((p) => !sameRef(p, ref)), ask: null, why: null };
  if (!exists(s, side, ref)) return refuse(ref.kind === 'unit' ? 'To jednostka rywala' : 'Tej karty nie masz');
  if (!movable(s, side, ps.plan, ref)) return refuse(growWhy(s, side, ps.plan) === 'Brak rozkazów' ? 'Brak rozkazów' : 'Nie ma dokąd iść');
  const first = ps.picks[0];
  // A card after units, a unit after cards, or a unit from another objective starts a new group
  const joins = first && first.kind === ref.kind && (ref.kind === 'card' || shownAt(s, ps.plan, first) === shownAt(s, ps.plan, ref));
  if (!joins) return { ...ps, picks: [ref], ask: null, why: null };
  const group = [...ps.picks, ref];
  if (!sendable(s, side, ps.plan, group)) return refuse(growWhy(s, side, ps.plan));
  return { ...ps, picks: group, ask: null, why: null };
}

function send(ps: PlanState, refs: Ref[], to: Slot, s: MatchState, side: Side, replace?: string): PlanState {
  const refuse = (): PlanState => {
    const t = targetInfo(s, side, ps.plan, refs)[to];
    return { ...ps, ask: null, refused: ps.refused + 1, why: t.kind === 'off' ? t.why ?? null : null };
  };
  if (!refs.length) return ps;
  // The answer to an open question: the asked card replaces that unit, then the rest of the group
  if (ps.ask && replace !== undefined && ps.ask.to === to && refs.length === ps.ask.rest.length + 1 && sameRef(refs[0], ps.ask.ref)) {
    const r = place(s, side, ps.ask.done, ps.ask.ref, to, replace);
    if (!r || 'ask' in r) return refuse();
    const rest = placeGroup(s, side, r.plan, ps.ask.rest, to);
    if (!rest) return refuse();
    if ('ask' in rest) return { ...ps, picks: [rest.ask.ref, ...rest.ask.rest], ask: rest.ask, why: null };
    return { ...ps, plan: rest.plan, picks: [], ask: null, why: null };
  }
  const r = placeGroup(s, side, ps.plan, refs, to, replace);
  if (!r) return refuse();
  if ('ask' in r) return { ...ps, picks: refs, ask: r.ask, why: null };
  return { ...ps, plan: r.plan, picks: [], ask: null, why: null };
}

export function reducePlan(ps: PlanState, a: PlanAction, s: MatchState, side: Side): PlanState {
  switch (a.type) {
    case 'pick': return pick(ps, a.ref, s, side);
    case 'send':
      if (ps.ask) return send(ps, [ps.ask.ref, ...ps.ask.rest], a.to, s, side, a.replace);
      return send(ps, ps.picks, a.to, s, side, a.replace);
    case 'drop': return send({ ...ps, ask: null }, a.refs, a.to, s, side, a.replace);
    case 'undo': {
      if (!ps.plan.length) return { ...ps, picks: [], ask: null, why: null };
      const plan = trim(s, side, a.ref ? without(ps.plan, a.ref) : ps.plan.slice(0, -1));
      return { ...ps, plan, picks: [], ask: null, why: null };
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
  const free = freeMoves(known, ME, plan);
  const offers = freeOffers(known, ME, plan);
  return {
    round: known.round,
    // A total is shown where the player has units; an empty side has nothing to add up
    objectives: objectiveModels(mine, (at) => (mine.units.some((u) => u.side === ME && u.at === at) ? 'mine' : 'none')),
    units: [
      ...known.units.filter((u) => u.side === RIVAL).map((u) => unitModel(known, u)),
      ...mine.units.filter((u) => u.side === ME).map((u) => {
        const was = before.get(u.uid);
        const planned = was ? (was.at !== u.at ? { planned: 'move' as const, free: free.get(u.uid) } : {}) : { planned: 'play' as const };
        return { ...unitModel(mine, u), ...planned, ...(offers.has(u.uid) ? { offer: offers.get(u.uid) } : {}) };
      }),
    ],
    hp: [view.hp, view.rival.hp],
    hand: mine.sides[ME].hand,
    rivalHand: view.rival.handSize,
    orders: { have: known.orders[ME], used: planCost(known, ME, plan) },
    fx: [],
  };
}
