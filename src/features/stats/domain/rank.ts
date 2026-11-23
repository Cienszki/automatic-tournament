// Questions the hub asks of the season model: players ranked by a metric, the best single games,
// percentile ranks, and a performance's opponent.

import { metric, type MetricKey } from './metrics';
import type { Model, Perf, PlayerX, TeamX } from './model';

export type RankMode = 'avg' | 'total' | 'best';

export interface RankRow { player: PlayerX; value: number; perf?: Perf | null }

/** Players ranked by a metric; 'avg' only includes players with ≥ minGames */
export function rankPlayers(model: Model, key: MetricKey, mode: RankMode, minGames = model.minGames): RankRow[] {
  const m = metric(key);
  const rows: RankRow[] = [];
  for (const p of model.players) {
    const a = p.agg[key];
    if (!a.n) continue;
    if (mode === 'avg') { if (p.games < minGames || a.avg == null) continue; rows.push({ player: p, value: a.avg }); }
    else if (mode === 'total') rows.push({ player: p, value: a.total });
    else if (a.best) rows.push({ player: p, value: m.get(a.best), perf: a.best });
  }
  const dir = m.better === 'low' && mode === 'avg' ? 1 : -1;
  return rows.sort((a, b) => dir * (a.value - b.value) || b.player.games - a.player.games);
}

/** Best single-game performances for a metric (named players only unless `all`) */
export function topPerfs(model: Model, key: MetricKey, n = 10, all = false): Perf[] {
  const m = metric(key);
  return model.perfs
    .filter(p => (all || p.player) && (!m.parsedOnly || p.parsed) && Number.isFinite(m.get(p)))
    .sort((a, b) => m.get(b) - m.get(a) || a.game.start - b.game.start)
    .slice(0, n);
}

/** Fraction of `values` strictly below v (0..1); ties count half */
export function pctRank(values: number[], v: number): number {
  if (!values.length) return 0;
  let below = 0; let eq = 0;
  for (const x of values) { if (x < v) below++; else if (x === v) eq++; }
  return (below + eq / 2) / values.length;
}

export function opponentOf(p: Perf): TeamX | undefined {
  return p.radiant ? p.game.direTeam : p.game.radiantTeam;
}
