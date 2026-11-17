// Points flying from an objective to an Ancient. A scene's hit points already include the round's
// damage; the bar shows the damage only when its flyer lands, as today's game does with `owed`.
// So the bar shown is the scene's hit points plus whatever is still in the air.
import { other, type Side, type Slot } from '@/features/cards/domain/v2/types';
import type { Fx } from './scene';

export interface Flight {
  id: string;
  /** Whose Ancient it hits */
  side: Side;
  from: Slot;
  amount: number;
}
export interface Ledger { flying: Flight[]; launched: string[] }
export const EMPTY_LEDGER: Ledger = { flying: [], launched: [] };

/** The damage of a step takes off (each one once, however often the step is drawn) */
export function launch(l: Ledger, stepId: string, fx: Fx[]): Ledger {
  const fresh: Flight[] = [];
  for (const f of fx) {
    if (f.kind !== 'damage') continue;
    const id = `${stepId}:${f.at}`;
    if (l.launched.includes(id)) continue;
    fresh.push({ id, side: other(f.side), from: f.at, amount: f.amount });
  }
  return fresh.length ? { flying: [...l.flying, ...fresh], launched: [...l.launched, ...fresh.map((x) => x.id)] } : l;
}

export const land = (l: Ledger, id: string): Ledger => ({ ...l, flying: l.flying.filter((x) => x.id !== id) });
/** A skipped reveal: everything lands at once */
export const landAll = (l: Ledger): Ledger => ({ ...l, flying: [] });

/** The hit points the Ancients show */
export function shownHp(hp: [number, number], l: Ledger): [number, number] {
  const out: [number, number] = [hp[0], hp[1]];
  for (const f of l.flying) out[f.side] += f.amount;
  return out;
}
