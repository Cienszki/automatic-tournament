// draft-prep: players' stored game histories, for match preparation and the teams view's hero lists.
// Owns the shape of a stored game, how new games are merged in, when an account is due for an
// update, the hero lists computed from it, and the OpenDota and STRATZ clients with their timeouts.
// Does not yet own the table, the jobs or the screens (WP-66 parts 2 to 5).
// Entry points: mergeGames, historyWindowDays, updateDue, mostPlayedHeroes, createOpenDotaClient,
// createStratzClient, UpstreamError.

export { fromOpenDota, fromStratz, PUB, LEAGUE, type GameRow, type OpenDotaPlayerMatch, type StratzPlayerGame } from './domain/game-row';
export { mergeGames, type MergeResult } from './domain/merge';
export { historyWindowDays, newestStart, updateDue, DEFAULT_UPDATE_POLICY, type UpdatePolicy, type UpdateReason } from './domain/window';
export { mostPlayedHeroes, type HeroCount, type MostPlayedHeroes, type HeroListOptions } from './domain/hero-lists';
export { createOpenDotaClient, type OpenDotaClient, type OpenDotaProfile } from './clients/opendota';
export { createStratzClient, type StratzClient } from './clients/stratz';
export { UpstreamError, UPSTREAM_CODES, timeBudget, type Budget, type UpstreamCode, type UpstreamFailure, type UpstreamSource } from './clients/upstream';
