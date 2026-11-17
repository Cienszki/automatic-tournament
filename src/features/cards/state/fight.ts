// The player's choice in the fight step: one rival unit to hit and one own unit to guard, both
// changeable until confirmed. Which units may be chosen is the engine's answer (boardTargets).
import { boardTargets, type Strikes } from '@/features/cards/domain/v2/fight';
import type { MatchState, Side } from '@/features/cards/domain/v2/types';
import { other } from '@/features/cards/domain/v2/types';

export interface FightChoice { target: string | null; guard: string | null }
export const NO_CHOICE: FightChoice = { target: null, guard: null };

export interface FightOptions {
  /** Rival units the player may hit */
  targets: string[];
  /** Own units the rival may hit, so the ones worth a shield */
  guards: string[];
}

export function fightOptions(mid: MatchState, side: Side): FightOptions {
  return { targets: boardTargets(mid, side).map((u) => u.uid), guards: boardTargets(mid, other(side)).map((u) => u.uid) };
}

/** True when the round has a fight step for this player: something to hit or something to guard */
export const hasFight = (o: FightOptions): boolean => o.targets.length > 0 || o.guards.length > 0;

export type FightAction = { type: 'target'; uid: string } | { type: 'guard'; uid: string } | { type: 'clear' };

/** A unit that cannot be chosen changes nothing; choosing the same unit again takes the choice back */
export function reduceFight(c: FightChoice, a: FightAction, o: FightOptions): FightChoice {
  switch (a.type) {
    case 'target': return !o.targets.includes(a.uid) ? c : { ...c, target: c.target === a.uid ? null : a.uid };
    case 'guard': return !o.guards.includes(a.uid) ? c : { ...c, guard: c.guard === a.uid ? null : a.uid };
    case 'clear': return NO_CHOICE;
  }
}

/** Nothing is left to choose */
export const fightComplete = (c: FightChoice, o: FightOptions): boolean => (c.target !== null || !o.targets.length) && (c.guard !== null || !o.guards.length);

/** The choice in the engine's form */
export function toStrikes(mid: MatchState, c: FightChoice): Strikes {
  const at = (uid: string) => mid.units.find((u) => u.uid === uid)!.at;
  return [
    ...(c.target !== null ? [{ at: at(c.target), target: c.target }] : []),
    ...(c.guard !== null ? [{ at: at(c.guard), guard: c.guard }] : []),
  ];
}
