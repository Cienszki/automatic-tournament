// Which collections a capture walks. Firestore's REST API lists subcollections
// (`listCollectionIds`) only for authenticated callers, so the names come from the code
// (`src/lib/api/paths.ts`, `firestore.rules`, `inventory/DATA.md`).
//
// `expect: 'private'` marks collections that the rules are known to refuse. They are still
// asked once, so the manifest records them as denied ("needs the owner's export") instead of
// leaving them out silently.

export interface CollectionNode {
  id: string;
  sub?: CollectionNode[];
  expect?: 'public' | 'private';
}

const c = (id: string, sub?: CollectionNode[]): CollectionNode => ({ id, sub });
const priv = (id: string): CollectionNode => ({ id, expect: 'private' });

/** Under `tournaments/{id}`. */
export const TOURNAMENT_PLAN: CollectionNode[] = [
  // WP-12's list
  c('teams', [c('players'), priv('transfers')]),
  c('matches', [c('games', [c('performances')])]),
  c('divisions'),
  c('groups'),
  c('standings'),
  c('swissRounds'),
  c('playoffs'),
  c('playoff_matches'),
  c('announcements'),
  c('rules', [c('paragraphs')]),
  c('prizes'),
  c('standins'),
  c('standinRequests'),
  c('fantasyLineups', [c('rounds')]),
  c('pickems'),
  // Also publicly readable, so captured too
  c('scrimSlots'),
  c('commentators'),
  c('commentatorRequests'),
  c('stats'),
  c('playerStats'),
  c('teamStats'),
  c('performanceRankings'),
  c('playerGameHistory', [c('games')]),
  // Refused by the rules; listed so the manifest says so
  priv('fantasyRounds'),
  priv('admins'),
  priv('config'),
  priv('casters'),
  priv('processedGames'),
  priv('skippedGames'),
  priv('unparsedMatches'),
];

/** Letnia, which predates `tournaments/{id}` and lives in root collections. */
export const LEGACY_ROOT_PLAN: CollectionNode[] = [
  c('teams', [c('players')]),
  c('matches', [c('games', [c('performances')])]),
  c('groups'),
  c('stages'),
  c('configs'),
  c('tournament'),
  c('playoffs'),
  c('announcements'),
  c('standins'),
  c('standinRequests'),
  c('fantasyLineups', [c('rounds')]),
  c('pickems'),
  c('tournamentStats'),
  c('playerStats'),
  c('teamStats'),
  // Read by legacy code, refused by the rules (catch-all deny)
  priv('metaStats'),
  priv('processedGames'),
  priv('blockedGames'),
  priv('fantasyLeaderboards'),
  priv('fantasyPlayerStats'),
  priv('fantasyUserSummaries'),
  priv('fantasyUserTotals'),
  priv('tournamentPlayers'),
  priv('playerRoundStats'),
  priv('userProfiles'),
];

/**
 * The card game's collections (`src/server/card-lab/*`). They are root collections keyed by
 * tournament id (`cardRewards/{tid}`, `cardRankings/{tid}`, `cardCollections/{tid}__{uid}`),
 * written only by the server. A scoped capture probes them for its tournament and records
 * each answer in `manifest.probes`. Documents are not stored from a probe (their paths are
 * outside the tournament's root); if one ever answers, add it to a plan.
 */
export const CARD_ROOT_COLLECTIONS = [
  'cardCollections', 'cardDuels', 'cardRankings', 'cardActivity', 'cardRewards', 'cardGrants', 'cardReports', 'cardReportLimits',
] as const;

/** Paths under the card collections that name the tournament, `{tid}` replaced by its id. */
export const CARD_TOURNAMENT_PATHS = {
  documents: ['cardRewards/{tid}', 'cardRankings/{tid}'],
  collections: ['cardRankings/{tid}/players', 'cardRankings/{tid}/pairs'],
} as const;

/** Not tournament scoped, but publicly readable and needed by the import. */
export const GLOBAL_PLAN: CollectionNode[] = [
  c('tournaments'),
  c('players'),
  // Platform collections, refused: the owner's export brings them
  priv('users'),
  priv('accounts'),
  priv('admins'),
  priv('tournamentCreators'),
  priv('discordLinks'),
  priv('steamLinks'),
];
