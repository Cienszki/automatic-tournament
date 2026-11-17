// The combat log ("Przebieg meczu"): each round as rows, newest round first, from the engine's
// events of that round as they were shown.
import type { GCard } from '@/lib/card-lab/cards';
import type { FreeKind, Side, Slot } from '@/features/cards/domain/v2/types';
import type { RoundLog } from './game';

export type LogRow =
  | { kind: 'play'; side: Side; card: GCard; to: Slot; replaced?: GCard }
  | { kind: 'move'; side: Side; card: GCard; from: Slot; to: Slot; free?: FreeKind }
  | { kind: 'gank'; side: Side; mid: GCard; target: GCard | null; at: Slot }
  /** `side` hit `target` there; `guarded` = it broke on a shield */
  | { kind: 'strike'; side: Side; target: GCard; at: Slot; guarded: boolean }
  /** Who held the objective this round, the totals, and the damage it dealt */
  | { kind: 'control'; at: Slot; power: [number, number]; controller: Side | null; damage: number };

export interface LogRound { round: number; rows: LogRow[] }

export function logRows(r: RoundLog): LogRow[] {
  const rows: LogRow[] = [];
  for (const e of r.events) {
    switch (e.kind) {
      case 'play': rows.push({ kind: 'play', side: e.side, card: e.card, to: e.to, replaced: e.replaced }); break;
      case 'move': rows.push({ kind: 'move', side: e.side, card: e.card, from: e.from, to: e.to, free: e.free }); break;
      case 'gank': rows.push({ kind: 'gank', side: e.side, mid: e.mid, target: e.target, at: e.at }); break;
      case 'strike': if (e.target) rows.push({ kind: 'strike', side: e.side, target: e.target, at: e.at, guarded: e.guarded }); break;
      case 'control': {
        // Objectives where nobody stood say nothing
        if (e.power[0] === 0 && e.power[1] === 0) break;
        const dmg = r.events.find((d) => d.kind === 'damage' && d.at === e.at);
        rows.push({ kind: 'control', at: e.at, power: e.power, controller: e.controller, damage: dmg && dmg.kind === 'damage' ? dmg.amount : 0 });
        break;
      }
      default: break;
    }
  }
  return rows;
}

/** Newest round first */
export const logRounds = (log: RoundLog[]): LogRound[] => [...log].reverse().map((r) => ({ round: r.round, rows: logRows(r) }));
