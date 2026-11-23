// One tournament's capture → rows, with no database: the mappers run in a fixed order, each
// reading what the earlier ones produced. Every kind in the capture must end up accounted for:
// mapped, merged into another row, dropped by a rule, or listed as not imported.

import { ImportContext } from './context';
import { mapContent } from './mappers/content';
import { mapFormats } from './mappers/formats';
import { mapGames } from './mappers/games';
import { mapIgnoredGames, mapTransfers } from './mappers/history';
import { mapMatches } from './mappers/matches';
import { mapPlayersTable, mapUsers } from './mappers/people';
import { newMapState, type MapOptions, type MapState } from './mappers/state';
import { mapStandinRequests } from './mappers/standins';
import { mapStandinRegistrations, mapTeams } from './mappers/teams';
import { mapTournament } from './mappers/tournament';
import { mapViewers } from './mappers/viewers';
import { RowSet } from './rows';
import { docsOf, type Capture, type GlobalCapture } from './source';

/** Kinds that hold derived or bookkeeping data only (SCHEMA.md 7.10, 3.2): dropped whole. */
export const DROPPED_KINDS: Record<string, string> = {
  playerStats: 'derived statistics (computed from performances)',
  teamStats: 'derived statistics (computed from performances)',
  stats: 'derived season totals',
  tournamentStats: 'derived season totals',
  performanceRankings: 'derived rankings',
  playerGameHistory: 'derived from performances',
  standings: 'derived standings',
  processedGames: 'a game is processed when its row exists',
  commentators: 'replaced by casters',
  commentatorRequests: 'replaced by casters',
  metaStats: 'derived statistics',
  fantasyLeaderboards: 'derived fantasy totals',
  fantasyPlayerStats: 'derived fantasy totals',
  fantasyUserSummaries: 'derived fantasy totals',
  fantasyUserTotals: 'derived fantasy totals',
  tournamentPlayers: 'a frozen copy of rosters',
  playerRoundStats: 'derived statistics',
  configs: 'an empty legacy collection',
  stages: 'an empty legacy collection',
};

/** Kinds the import does not map yet, with the work package that owns them. */
export const NOT_IMPORTED_KINDS: Record<string, string> = {
  unparsedMatches: 'retries belong to the job queue (WP-14); the next sync finds the game again',
  botSyncTasks: 'replaced by jobs (WP-14)',
};

export interface MappedTournament {
  capture: Capture;
  rows: RowSet;
  ctx: ImportContext;
  state: MapState;
}

export function mapCapture(capture: Capture, global: GlobalCapture | null, options: MapOptions, slugToId: Map<string, string>): MappedTournament {
  const ctx = new ImportContext(capture.tournamentId);
  const rows = new RowSet((table, key) => ctx.finding({
    kind: table, code: 'conflict', reason: 'two different rows with the same key; the first is kept', ref: key,
  }));
  const state = newMapState({ capture, global, ctx, rows, options, slugToId });

  mapTournament(state);
  mapFormats(state);
  mapTeams(state);
  mapStandinRegistrations(state);
  mapTransfers(state);
  mapMatches(state);
  mapGames(state);
  mapStandinRequests(state);
  mapContent(state);
  mapViewers(state);
  mapIgnoredGames(state);
  for (const [kind, reason] of Object.entries(DROPPED_KINDS)) {
    const docs = docsOf(capture, kind);
    if (docs.length) ctx.dropKind(kind, docs, reason);
  }
  for (const [kind, reason] of Object.entries(NOT_IMPORTED_KINDS)) {
    const docs = docsOf(capture, kind);
    ctx.read(kind, docs);
    for (const doc of docs) ctx.outcome(kind, 'unmapped', reason, doc.path);
  }
  for (const [kind, docs] of capture.kinds) {
    if (docs.length && !ctx.accounts.has(kind)) {
      ctx.read(kind, docs);
      for (const doc of docs) ctx.outcome(kind, 'unmapped', 'no mapper reads this collection', doc.path);
    }
  }
  mapPlayersTable(state);
  mapUsers(state);
  return { capture, rows, ctx, state };
}
