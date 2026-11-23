// stats: everything derived from results (ADR-11). Owns computeTournament, the one pure function
// from a tournament's rows to the stats hub's dataset and season numbers, the standings of every
// group (through the formats feature) and the rankings page. Nothing derived is stored.
// Does not own results (matches, games, performances: the `results` feature) or fantasy scoring
// (WP-16). Entry points: computeTournament (pure); the server reads loadTournamentInput and
// getDataset are in queries.ts.

export { computeTournament, type TournamentStats } from './domain/compute';
export { buildDataset } from './domain/dataset/build-dataset';
export { deriveModel, type Model } from './domain/derive';
export { buildOverview, type OverviewData } from './domain/overview';
export { performanceRankings, RANKING_ROLES, type PerformanceRankings, type RankingEntry, type RankingRole } from './domain/rankings';
export { seasonSummary, type PlayerRef, type SeasonSummary } from './domain/season-summary';
export { standingsPerGroup, type GroupStandings } from './domain/standings';
export type * from './domain/input';
export type { StatsDataset } from './domain/types';
