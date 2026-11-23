// computeTournament: the one function from all of a tournament's rows to every number that
// combines games. It runs over every row each time; nothing it returns is stored or updated
// piece by piece (WP-15, owner 2026-11-23). A new statistic is a new part of this function and is
// right for every past game at once.

import { buildDataset } from './dataset/build-dataset';
import { deriveModel, type Model } from './derive';
import type { TournamentInput } from './input';
import { buildOverview, type OverviewData } from './overview';
import { performanceRankings, type PerformanceRankings } from './rankings';
import { seasonSummary, type SeasonSummary } from './season-summary';
import { standingsPerGroup, type GroupStandings } from './standings';
import type { StatsDataset } from './types';

export interface TournamentStats {
  /** What the stats hub draws from (served by `/api/v1/stats/dataset`). */
  dataset: StatsDataset;
  /** The season numbers the hub shows, as plain data. */
  season: SeasonSummary;
  /** The table of every group of every round-robin and Swiss stage. */
  standings: GroupStandings[];
  /** The rankings page: each position's players, and the teams, by average performance score. */
  rankings: PerformanceRankings;
  /** The cross-referenced model and the overview, for code in the same process. They hold references; do not serialize them. */
  model: Model;
  overview: OverviewData;
}

export function computeTournament(input: TournamentInput): TournamentStats {
  const dataset = buildDataset(input);
  const model = deriveModel(dataset);
  const overview = buildOverview(model, input.tournament.formatPreset);
  return {
    dataset,
    season: seasonSummary(model, overview),
    standings: standingsPerGroup(input),
    rankings: performanceRankings(model),
    model,
    overview,
  };
}
