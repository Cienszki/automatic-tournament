// The rules each existing tournament uses today, so its tables look the same on the new platform.
// WP-33 writes them into `stages.ranking` on import; the wizard offers them as presets.

import type { RankingRules } from './schema';

/**
 * Leagues and group stages on the old site (`useDivisionData`, `usePDLData`): 2 points for a
 * series win, 1 for a draw; then head-to-head wins among the teams level on points, Neustadtl,
 * and the lower total MMR.
 */
export const ROUND_ROBIN_DEFAULT: RankingRules = {
  points: { win: 2, draw: 1, loss: 0 },
  tiebreakers: ['head_to_head_wins', 'neustadtl', 'lower_mmr'],
};

/**
 * Swiss on the old site (`compareForTable` in `src/lib/swiss/pairing.ts`): one point per game
 * won; then Buchholz, series won, and game difference.
 */
export const SWISS_DEFAULT: RankingRules = {
  points: 'games_won',
  tiebreakers: ['buchholz', 'match_wins', 'game_difference'],
};

export function defaultRankingRules(stageKind: 'round_robin' | 'swiss'): RankingRules {
  return stageKind === 'swiss' ? SWISS_DEFAULT : ROUND_ROBIN_DEFAULT;
}
