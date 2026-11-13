// Every tie-breaker an organizer can choose, by the id stored in `stages.ranking.tiebreakers`.

import type { RankingContext } from '../records';
import type { TiebreakerId } from '../schema';
import type { Tiebreaker } from '../tiebreaker';
import { manual, tiebreakMatch } from './decisions';
import { headToHead, headToHeadWins } from './head-to-head';
import { gameDifference, gamesWon, lowerMmr, matchWins } from './record-metrics';
import { buchholz, neustadtl } from './schedule-strength';

export const TIEBREAKERS: { readonly [Id in TiebreakerId]: Tiebreaker<RankingContext, Id> } = {
  head_to_head: headToHead,
  head_to_head_wins: headToHeadWins,
  game_difference: gameDifference,
  games_won: gamesWon,
  neustadtl,
  buchholz,
  match_wins: matchWins,
  lower_mmr: lowerMmr,
  tiebreak_match: tiebreakMatch,
  manual,
};
