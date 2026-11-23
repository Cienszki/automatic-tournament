// The rankings page: players of each position, and teams, by average performance score, with the
// average of each part of the score. Computed from the season model's scored performances (the
// same population and formula as the hub's "score" metric); nothing is stored.

import { scoringMinutes } from './derive-games';
import type { Model, Perf } from './model';
import { calcPerformanceScore, type ScoreComponents } from './performance-score';

/** The rankings page's lists, keyed as the page reads them. */
export const RANKING_ROLES = {
  carry: 'Carry', mid: 'Mid', offlane: 'Offlane', 'soft-support': 'Soft Support', 'hard-support': 'Hard Support',
} as const;
export type RankingRole = keyof typeof RANKING_ROLES;

/** One row of the rankings page (the shape `RankingsView` draws). */
export interface RankingEntry {
  name: string;
  teamName: string;
  avgScore: number;
  /** Scored games. */
  games: number;
  killPts?: number; assistPts?: number; deathPts?: number; farmPts?: number; dmgPts?: number;
  wardPts?: number; dewardPts?: number; campPts?: number; miscPts?: number;
}

export type PerformanceRankings = Record<RankingRole | 'teams', RankingEntry[]> & {
  /** Scored performances in the tournament. */
  gameCount: number;
};

const PARTS = ['killPts', 'assistPts', 'deathPts', 'farmPts', 'dmgPts', 'wardPts', 'dewardPts', 'campPts', 'miscPts'] as const;

const byScore = (a: RankingEntry, b: RankingEntry) => b.avgScore - a.avgScore || b.games - a.games || a.name.localeCompare(b.name);

function playerEntry(list: Perf[], avgGameMins: number): RankingEntry {
  const player = list[0].player!;
  const sums = Object.fromEntries(PARTS.map((k) => [k, 0])) as Record<(typeof PARTS)[number], number>;
  for (const p of list) {
    const parts: ScoreComponents = calcPerformanceScore(player.role!, { ...p, firstBloodClaimed: p.firstBloodClaimed > 0 }, p.min, avgGameMins);
    for (const k of PARTS) sums[k] += parts[k];
  }
  return {
    name: player.name,
    teamName: player.team?.name ?? '',
    avgScore: list.reduce((s, p) => s + p.score, 0) / list.length,
    games: list.length,
    ...Object.fromEntries(PARTS.map((k) => [k, sums[k] / list.length])),
  };
}

function group<K>(perfs: readonly Perf[], key: (p: Perf) => K): Map<K, Perf[]> {
  const out = new Map<K, Perf[]>();
  for (const p of perfs) {
    const k = key(p);
    if (!out.has(k)) out.set(k, []);
    out.get(k)!.push(p);
  }
  return out;
}

export function performanceRankings(model: Model): PerformanceRankings {
  const scored = model.perfs.filter((p) => Number.isFinite(p.score));
  const avgGameMins = scoringMinutes(scored);
  const byPlayer = [...group(scored.filter((p) => p.player?.role), (p) => p.pid).values()];
  const roles = Object.fromEntries(Object.entries(RANKING_ROLES).map(([key, role]) => [
    key, byPlayer.filter((list) => list[0].player!.role === role).map((list) => playerEntry(list, avgGameMins)).sort(byScore),
  ])) as Record<RankingRole, RankingEntry[]>;
  const teams = [...group(scored.filter((p) => p.team), (p) => p.tid).values()].map((list) => ({
    name: list[0].team!.name, teamName: list[0].team!.name,
    avgScore: list.reduce((s, p) => s + p.score, 0) / list.length, games: list.length,
  })).sort(byScore);
  return { ...roles, teams, gameCount: scored.length };
}
