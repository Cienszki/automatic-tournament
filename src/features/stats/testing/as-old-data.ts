// Test helper: a tournament's rows changed back to how the old site's data had them, where the
// import repaired the data. Running the compute on them shows that the repairs are the whole
// difference between the new numbers and the old site's published ones.

import type { TournamentInput } from '../domain/input';

export interface OldData {
  /** Games the old data stored under another match: game id → that match. */
  movedGames?: Record<string, string>;
  /** Games the old data stored twice, under their match and under this one: game id → the other match. */
  copiedGames?: Record<string, string>;
  /** Matches the old stats left out. */
  droppedMatches?: readonly string[];
}

export function asOldData(input: TournamentInput, old: OldData): TournamentInput {
  const dropped = new Set(old.droppedMatches ?? []);
  const moved = old.movedGames ?? {};
  const copied = old.copiedGames ?? {};
  const games = input.games.map((g) => (moved[g.id] ? { ...g, matchId: moved[g.id] } : g));
  const copies = input.games.filter((g) => copied[g.id]).map((g) => ({ ...g, id: `${g.id}-copy`, matchId: copied[g.id] }));
  const copiedPerfs = input.performances.filter((p) => copied[p.gameId]).map((p) => ({ ...p, gameId: `${p.gameId}-copy` }));
  return {
    ...input,
    matches: input.matches.filter((m) => !dropped.has(m.id)),
    games: [...games, ...copies],
    performances: [...input.performances, ...copiedPerfs],
  };
}

/**
 * Wiosenna. Two Dota games were stored under a group match and under the playoff match of the
 * same two teams; ten series lost by forfeiting both games were left out of the old stats.
 */
export const WIOSENNA_OLD = {
  twoMatchGames: { '8904592446': 'cxozIoYGO0ViB55POI36', '8910469903': 'HVwwRd87bSFsCzkph25p' },
  forfeitedBothGames: [
    'Id81mNPOvSmIK4SSE6Ge', 'JZp7D6M2wsdVpnKRXBlJ', 'MbUrCcg2LDJQnPJV7WIR', 'ODtefs8S6qJZQENm4FfI', 'UOW07MKlM70RaTR3ro2e',
    'ayOWKqs3kiAMAeIn4bTq', 'dQ3zX7yMz4GJ6yKmXytX', 'hAgLxarejlI3cnB6bY7F', 'pSbcGrKODPeag6yiHjyw', 'qaWx4R8xlXo8wyNop43G',
  ],
} as const;
