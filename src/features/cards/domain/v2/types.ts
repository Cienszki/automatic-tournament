// The state of a v2 match, the plans players submit and the events a round produces.
import type { GCard } from '@/lib/card-lab/cards';
import type { ObjId } from '@/lib/card-lab/outposts';
import type { Rules } from './rules';

export type Side = 0 | 1;
/** One of the three objectives on the board, by position */
export type Slot = 0 | 1 | 2;
export const SLOTS: readonly Slot[] = [0, 1, 2];
export const other = (s: Side): Side => (s === 0 ? 1 : 0);

export interface Unit {
  /** `${side}:${card.id}`: a card is on the board at most once */
  uid: string;
  card: GCard;
  side: Side;
  /** The round in which a gank put this unit out (it does not count in that round) */
  out?: number;
  /** A hit that weakens instead: [round, strength lost in that round] */
  hurt?: [number, number];
  at: Slot;
  /** Farma growth (Carry) */
  growth: number;
  /** The round it was played in */
  played: number;
}

export interface SideState {
  hp: number;
  hand: GCard[];
  /** Draw order: the first card is drawn next */
  deck: GCard[];
  grave: GCard[];
  /** Ids of hand cards the rival has seen (units returned by a gank) */
  known: string[];
}

export type EndReason = 'ancient' | 'cap' | 'cap-objectives' | 'draw';
export interface MatchResult { winner: Side | null; reason: EndReason; round: number }

export interface MatchState {
  rules: Rules;
  /** The round being planned, from 1 */
  round: number;
  objectives: [ObjId, ObjId, ObjId];
  /** Who controlled each objective at the end of the previous round */
  control: [Side | null, Side | null, Side | null];
  units: Unit[];
  sides: [SideState, SideState];
  /** Orders each side has this round */
  orders: [number, number];
  result: MatchResult | null;
}

export type Action =
  /** A hand card onto an objective; `replace` = own unit there discarded to make room */
  | { kind: 'play'; card: string; to: Slot; replace?: string }
  /** An own unit from its objective to another */
  | { kind: 'move'; unit: string; to: Slot };
export type Plan = Action[];

export type FreeKind = 'smoke' | 'gates';

export type MatchEvent =
  | { kind: 'play'; side: Side; card: GCard; to: Slot; replaced?: GCard }
  | { kind: 'move'; side: Side; card: GCard; from: Slot; to: Slot; free?: FreeKind }
  | { kind: 'gank'; side: Side; mid: GCard; at: Slot; target: GCard | null; blocked: boolean; toHand: boolean }
  /** Fight step: `side` hit `target` (null = no hit); `guarded` = the rival had guarded it */
  | { kind: 'strike'; side: Side; at: Slot; target: GCard | null; guarded: boolean }
  /** Each unit's strength as it counts for control this round, part by part (after the fight), so a
   *  screen can show which card gives which bonus. `hit` is what a landed hit took off. */
  | { kind: 'strength'; side: Side; uid: string; at: Slot; parts: { base: number; growth: number; aura: number; team: number; highGround: number }; hit: number; total: number }
  | { kind: 'control'; at: Slot; power: [number, number]; controller: Side | null }
  | { kind: 'damage'; side: Side; at: Slot; amount: number }
  | { kind: 'farm'; side: Side; card: GCard; growth: number }
  | { kind: 'bonus'; side: Side; aura: number; team: number; highGround: number }
  | { kind: 'draw'; side: Side; cards: number; why: 'round' | 'lotus' | 'tormentor' }
  | { kind: 'end'; result: MatchResult };

export interface RoundOutcome { state: MatchState; events: MatchEvent[] }
