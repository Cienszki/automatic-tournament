// Named players of the season model: their games, records, per-metric aggregates and heroes.
// Accounts that are not in the dataset's player list stay anonymous: their performances still
// count for teams and heroes.

import { METRIC_LIST, type MetricKey } from './metrics';
import { inc, type HeroUse, type MetricAgg, type Perf, type PlayerX, type TeamX } from './model';
import type { DsPlayer, StatsDataset } from './types';

function aggregates(list: Perf[]): Record<MetricKey, MetricAgg> {
  const agg = {} as Record<MetricKey, MetricAgg>;
  for (const m of METRIC_LIST) {
    const pool = m.parsedOnly ? list.filter(p => p.parsed) : list;
    let best: Perf | null = null;
    let total = 0;
    let n = 0;
    for (const p of pool) {
      const v = m.get(p);
      if (!Number.isFinite(v)) continue;
      total += v; n++;
      if (!best || v > m.get(best)) best = p;
    }
    agg[m.key] = { avg: n ? total / n : null, total, best, n };
  }
  return agg;
}

function playerOf(base: DsPlayer, list: Perf[], teamById: Map<string, TeamX>): PlayerX {
  list.sort((a, b) => a.game.start - b.game.start);
  const teamCount = new Map<string, number>();
  list.forEach(p => inc(teamCount, p.tid));
  // A stand-in has no roster team: they belong to the team they played for most.
  const teamId = base.teamId && teamById.has(base.teamId) ? base.teamId : [...teamCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const heroMap = new Map<number, HeroUse>();
  let streak = 0; let bestStreak = 0;
  for (const p of list) {
    const h = heroMap.get(p.heroId) ?? { heroId: p.heroId, games: 0, wins: 0 };
    h.games++; if (p.win) h.wins++;
    heroMap.set(p.heroId, h);
    streak = p.win ? streak + 1 : 0;
    bestStreak = Math.max(bestStreak, streak);
  }
  const wins = list.filter(p => p.win).length;
  return {
    ...base, teamId, team: teamId ? teamById.get(teamId) : undefined,
    perfs: list, games: list.length, wins, losses: list.length - wins, wr: wins / list.length, agg: aggregates(list),
    heroes: [...heroMap.values()].sort((a, b) => b.games - a.games || b.wins - a.wins),
    bestWinStreak: bestStreak, fbCount: list.filter(p => p.firstBloodClaimed && p.parsed).length,
  };
}

export function derivePlayers(ds: StatsDataset, perfs: Perf[], teamById: Map<string, TeamX>): Map<string, PlayerX> {
  const playerById = new Map<string, PlayerX>();
  const dsPlayers = new Map(ds.players.map(p => [p.id, p]));
  const byPid = new Map<string, Perf[]>();
  for (const p of perfs) { if (!byPid.has(p.pid)) byPid.set(p.pid, []); byPid.get(p.pid)!.push(p); }
  for (const [pid, list] of byPid) {
    const base = dsPlayers.get(pid);
    if (!base) continue;
    const px = playerOf(base, list, teamById);
    playerById.set(pid, px);
    list.forEach(p => { p.player = px; });
  }
  return playerById;
}
