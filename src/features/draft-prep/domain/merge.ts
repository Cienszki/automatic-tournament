import type { GameRow } from './game-row';

export interface MergeResult {
  rows: GameRow[];
  /** Games that were not stored before */
  added: number;
  /** Stored games whose row changed */
  changed: number;
}

/**
 * Merges newly fetched games into a stored history by match id. A newer source wins, except
 * that a lane or position it does not know (0) never erases one already stored: OpenDota knows
 * no positions and STRATZ no lanes, so each would otherwise wipe what the other added.
 */
export function mergeGames(stored: readonly GameRow[], incoming: readonly GameRow[]): MergeResult {
  const byId = new Map<number, GameRow>();
  for (const row of stored) byId.set(row[0], row);
  const before = new Map(byId);

  for (const row of incoming) {
    const prev = byId.get(row[0]);
    byId.set(row[0], prev ? combine(prev, row) : [...row]);
  }

  let added = 0;
  let changed = 0;
  for (const [id, row] of byId) {
    const old = before.get(id);
    if (!old) added++;
    else if (!sameRow(old, row)) changed++;
  }

  const rows = [...byId.values()].sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  return { rows, added, changed };
}

function combine(prev: GameRow, next: GameRow): GameRow {
  return [next[0], next[1], next[2], next[3], next[4], next[5] || prev[5], next[6] || prev[6]];
}

function sameRow(a: GameRow, b: GameRow): boolean {
  return a.every((v, i) => v === b[i]);
}
