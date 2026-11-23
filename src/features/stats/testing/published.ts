// Test helper: the old site's published numbers for a fixture (fixtures/exports/<slug>/published,
// WP-12), and the new compute's output in the same shape and rounding, so the two compare with
// one `toEqual`. The shape is that of scripts/tools/capture/published/build.ts.

import { readFileSync } from 'node:fs';
import type { TournamentStats } from '../domain/compute';
import type { PlayerRef } from '../domain/season-summary';
import type { StatsDataset } from '../domain/types';
import { FIXTURES, type FixtureSlug } from './imported';

const round = (n: number, d = 4) => Math.round(n * 10 ** d) / 10 ** d;
const readJson = <T>(file: string): T => JSON.parse(readFileSync(file, 'utf8')) as T;

export interface PublishedRankingRow { name: string; teamName: string; games: number; avgScore: number }
export interface PublishedTotals {
  counts: Record<string, number>;
  totals: Record<string, number>;
  overview: Record<string, unknown>;
  scoreRanking: unknown[];
  rankingsView: Array<{ role: string; gameCount: number | null; entries: PublishedRankingRow[] }>;
}

export const publishedDataset = (slug: FixtureSlug) => readJson<StatsDataset>(`${FIXTURES}${slug}/published/stats-dataset.json`);
export const publishedTotals = (slug: FixtureSlug) => readJson<PublishedTotals & Record<string, unknown>>(`${FIXTURES}${slug}/published/stats-totals.json`);

const player = (p: PlayerRef) => ({ id: p.id, name: p.name, teamId: p.teamId });

/** The hub's season numbers from the new compute, as stats-totals.json stores them. */
export function totalsOf(stats: TournamentStats): Omit<PublishedTotals, 'rankingsView'> {
  const s = stats.season;
  return {
    counts: s.counts,
    totals: Object.fromEntries(Object.entries(s.totals).map(([k, v]) => [k, round(v)])),
    overview: {
      leaders: s.leaders.map((l) => ({ player: player(l.player), value: round(l.value) })),
      bestPerRole: s.bestPerRole.map((r) => ({ role: r.role, player: player(r.player), value: round(r.value) })),
      bestTeam: s.bestTeam ? { teamId: s.bestTeam.teamId, value: round(s.bestTeam.value) } : null,
      records: s.records,
      topHeroes: s.topHeroes,
      teamOfTheWeek: s.teamOfTheWeek
        ? { label: s.teamOfTheWeek.label, picks: s.teamOfTheWeek.picks.map((p) => ({ role: p.role, player: player(p.player), avg: round(p.avg) })) }
        : null,
      achievements: { lit: s.achievements.lit, total: s.achievements.total, top: s.achievements.top ? { player: player(s.achievements.top.player), points: s.achievements.top.points } : null },
      elo: s.elo.map((e) => ({ teamId: e.teamId, rating: round(e.rating, 2) })),
    },
    scoreRanking: s.scoreRanking.map((r) => ({ player: player(r.player), games: r.games, value: round(r.value) })),
  };
}

/** The rankings page from the new compute, in the shape of the stored documents' copy. */
export function rankingsViewOf(stats: TournamentStats): PublishedTotals['rankingsView'] {
  const { gameCount, ...lists } = stats.rankings;
  return Object.entries(lists).map(([role, entries]) => ({
    role, gameCount, entries: entries.map((e) => ({ name: e.name, teamName: e.teamName, games: e.games, avgScore: e.avgScore })),
  }));
}
