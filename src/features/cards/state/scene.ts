// What the match screen draws: a scene. Every number in a scene comes from the engine (strength,
// totals, damage) or from its events; the screen only lays a scene out.
import type { GCard } from '@/lib/card-lab/cards';
import type { ObjId } from '@/lib/card-lab/outposts';
import { damageValue, power, strengthOf, strengthParts, type StrengthParts } from '@/features/cards/domain/v2/strength';
import { other, SLOTS, type FreeKind, type MatchState, type Side, type SideState, type Slot, type Unit } from '@/features/cards/domain/v2/types';
import type { MatchView } from '@/features/cards/domain/v2/view';

/** The player is always side 0 in the prototype */
export const ME: Side = 0;
export const RIVAL: Side = 1;

/**
 * The engine's state type filled with only what one player knows: the board, their own hand, and
 * of the rival nothing but hit points. The engine's helpers (strength, legality of the player's
 * own plan, fight targets) take a state, and none of them reads the rival's hand.
 */
export function knownState(v: MatchView): MatchState {
  const sides: [SideState, SideState] = [
    { hp: 0, hand: [], deck: [], grave: [], known: [] },
    { hp: 0, hand: [], deck: [], grave: [], known: [] },
  ];
  sides[v.side] = { hp: v.hp, hand: v.hand, deck: v.deck, grave: v.grave, known: v.known };
  sides[other(v.side)] = { hp: v.rival.hp, hand: [], deck: [], grave: v.rival.grave, known: [] };
  return { ...v.public, sides };
}

export interface UnitModel {
  uid: string;
  card: GCard;
  side: Side;
  at: Slot;
  /** Current strength, as the engine counts it */
  strength: number;
  parts: StrengthParts;
  /** Ganked: out of this round */
  out: boolean;
  /** Strength lost to a hit this round */
  lost: number;
  /** A rival card that is on the table but not turned over yet */
  faceDown?: boolean;
  /** The player's own plan, not yet confirmed */
  planned?: 'play' | 'move';
  /** A planned move that costs no order, and what pays for it */
  free?: FreeKind;
  /** A unit with no order that a free move could carry now (Smoke, Twin Gates) */
  offer?: FreeKind;
  /** The round it was played in */
  played?: number;
}

export type Fx =
  | { kind: 'gank'; by: string; target: string | null; at: Slot }
  | { kind: 'aim'; side: Side; target: string }
  | { kind: 'shield'; side: Side; uid: string }
  | { kind: 'hit'; uid: string; lost: number }
  | { kind: 'block'; uid: string }
  | { kind: 'count'; at: Slot }
  | { kind: 'verdict'; at: Slot; controller: Side | null }
  /** `side` deals it: the other side's Ancient loses `amount` */
  | { kind: 'damage'; side: Side; at: Slot; amount: number }
  | { kind: 'farm'; uid: string }
  | { kind: 'draw'; side: Side; cards: number };

/** One objective's line: who held it last round, what it deals now, and the totals that may be shown */
export interface ObjectiveModel { id: ObjId; holder: Side | null; damage: number; totals: [number | null, number | null] }

export interface Scene {
  round: number;
  objectives: [ObjectiveModel, ObjectiveModel, ObjectiveModel];
  units: UnitModel[];
  hp: [number, number];
  hand: GCard[];
  rivalHand: number;
  /** Order marks: how many the player has this round and how many the plan uses */
  orders: { have: number; used: number };
  fx: Fx[];
}

export function unitModel(s: MatchState, u: Unit): UnitModel {
  const strength = strengthOf(s, u);
  const parts = strengthParts(s, u);
  // What a hit took: the parts add up to the strength before it
  const whole = parts.base + parts.growth + parts.aura + parts.team + parts.highGround;
  return { uid: u.uid, card: u.card, side: u.side, at: u.at, strength, parts, out: u.out === s.round, lost: whole - strength, played: u.played };
}

export type TotalsShown = 'mine' | 'both' | 'none';

/** Objective lines of a state. `shown` per slot says which totals the screen may show there */
export function objectiveModels(s: MatchState, shown: (at: Slot) => TotalsShown, holder: MatchState['control'] = s.control): Scene['objectives'] {
  return SLOTS.map((at): ObjectiveModel => {
    const p = power(s, at);
    const sh = shown(at);
    return {
      id: s.objectives[at], holder: holder[at], damage: damageValue(s, at, s.round),
      totals: [sh === 'none' ? null : p[ME], sh === 'both' ? p[RIVAL] : null],
    };
  }) as Scene['objectives'];
}

/**
 * The unit a hit is drawn from. This is a picture, not a rule: a hit belongs to a side, and a unit
 * can only be hit where both sides stand, so the hitting side always has a unit on that objective.
 * `preferred` is the unit the player dragged from, when it stands there.
 */
export function aimOrigin(units: UnitModel[], side: Side, target: string, preferred?: string | null): string | null {
  const t = units.find((u) => u.uid === target);
  if (!t) return null;
  const here = units.filter((u) => u.side === side && u.at === t.at && !u.out);
  if (preferred && here.some((u) => u.uid === preferred)) return preferred;
  return [...here].sort((a, b) => b.strength - a.strength || (a.uid < b.uid ? -1 : 1))[0]?.uid ?? null;
}
