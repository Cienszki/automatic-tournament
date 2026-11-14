// Builders for tests of the v2 engine: cards with a chosen cost, and boards set up by hand.
import type { GCard, RoleKey } from '@/lib/card-lab/cards';
import { POS } from '@/lib/card-lab/cards';
import { cardStrength, type ObjId } from '@/lib/card-lab/outposts';
import type { PlayerX, TeamX } from '@/lib/stats-lab/derive';
import { FIRST_RULES, makeRules, type RulesPatch } from './rules';
import type { MatchState, Side, Slot, Unit } from './types';

/** The lowest rating that gives this cost (rating strength) */
export function ovrFor(costWanted: number): number {
  for (let ovr = 45; ovr <= 99; ovr++) if (cardStrength({ ovr } as GCard) === costWanted) return ovr;
  throw new Error(`no rating gives strength ${costWanted}`);
}

let n = 0;
export interface CardSpec { id?: string; role?: RoleKey; cost?: number; team?: string; totw?: boolean; pid?: string }
export function aCard(spec: CardSpec = {}): GCard {
  const id = spec.id ?? `c${String(++n).padStart(3, '0')}`;
  const role = spec.role ?? 'Carry';
  const team = spec.team ? ({ id: spec.team, name: spec.team } as unknown as TeamX) : undefined;
  return {
    id, pid: spec.pid ?? id, name: id, player: { id: spec.pid ?? id, name: id } as unknown as PlayerX, team, role, pos: POS[role],
    ovr: ovrFor(spec.cost ?? 5), attrs: { WAL: 50, FAR: 50, ROZ: 50, OBR: 50, WIZ: 50, DRU: 50 }, heroId: 1,
    series: { matchId: 'm', result: '2:0', games: 2, start: 0 }, standin: false, totw: spec.totw ?? false,
  };
}

export interface BoardSpec {
  rules?: RulesPatch;
  objectives?: [ObjId, ObjId, ObjId];
  units?: Array<{ card: GCard; side: Side; at: Slot; growth?: number; played?: number }>;
  hands?: [GCard[], GCard[]];
  decks?: [GCard[], GCard[]];
  control?: MatchState['control'];
  round?: number;
  hp?: [number, number];
  orders?: [number, number];
}

/** A match state put together by hand (round 2 by default, so units on the board can move).
 *  Rules: the first candidate set unless the spec changes them, so each test names the variant it is about. */
export function aBoard(spec: BoardSpec = {}): MatchState {
  const rules = makeRules(spec.rules, FIRST_RULES);
  const units: Unit[] = (spec.units ?? []).map((u) => ({ uid: `${u.side}:${u.card.id}`, card: u.card, side: u.side, at: u.at, growth: u.growth ?? 0, played: u.played ?? 1 }));
  const side = (i: Side) => ({ hp: spec.hp?.[i] ?? rules.hp, hand: [...(spec.hands?.[i] ?? [])], deck: [...(spec.decks?.[i] ?? [])], grave: [], known: [] });
  return {
    rules, round: spec.round ?? 2, objectives: spec.objectives ?? ['outpost', 'gates', 'lotus'],
    control: spec.control ?? [null, null, null], units, sides: [side(0), side(1)],
    orders: spec.orders ?? [rules.orders, rules.orders], result: null,
  };
}
