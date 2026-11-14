// formats: stages, standings, ranking rules, brackets and Swiss (ADR-14).
// Owns how a stage orders its teams: the ranking rules a stage stores and the pure function
// that turns teams and match results into a table. It does not own results (the `results`
// feature) or stored data; callers map their rows to the plain inputs in ranking/types.ts.
// Entry points: computeStandings, parseRankingRules, defaultRankingRules.

export { computeStandings } from './domain/standings';
export { countsForStandings, seriesOutcome, type SeriesOutcome } from './domain/series';
export { orderTeams, type OrderedTeams, type OrderOptions, type RankedTier } from './domain/ranking/engine';
export { defaultRankingRules, ROUND_ROBIN_DEFAULT, SWISS_DEFAULT } from './domain/ranking/defaults';
export {
  parseRankingRules,
  rankingRulesSchema,
  isDecisionTiebreaker,
  TIEBREAKER_IDS,
  AUTOMATIC_TIEBREAKERS,
  DECISION_TIEBREAKERS,
  type RankingRules,
  type PointsRule,
  type ManualOrder,
  type TiebreakerId,
} from './domain/ranking/schema';
export { TIEBREAKERS } from './domain/ranking/tiebreakers/catalogue';
export type { Tiebreaker, TiebreakStep } from './domain/ranking/tiebreaker';
export type { RankingContext } from './domain/ranking/records';
export type {
  MatchKind,
  MatchStatus,
  OpenTie,
  StandingRow,
  Standings,
  StandingsInput,
  StandingsMatch,
  StandingsTeam,
  TeamId,
  TeamRecord,
  TiebreakerValue,
} from './domain/ranking/types';
