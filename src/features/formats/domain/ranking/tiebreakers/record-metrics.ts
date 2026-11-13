// Tie-breakers that compare one number of each team's own record or roster.

import type { RankingContext } from '../records';
import { tiersByValue, type Tiebreaker } from '../tiebreaker';
import type { TeamRecord } from '../types';

type Rule<Id extends string> = Tiebreaker<RankingContext, Id>;

function byRecord<Id extends string>(id: Id, value: (r: TeamRecord) => number): Rule<Id> {
  return {
    id,
    decision: false,
    apply: (tied, ctx) => tiersByValue(tied, (team) => value(ctx.records.get(team)!), 'higher'),
  };
}

/** Games won minus games lost, over every counting series. */
export const gameDifference = byRecord('game_difference', (r) => r.gamesWon - r.gamesLost);

/** Games won, over every counting series. */
export const gamesWon = byRecord('games_won', (r) => r.gamesWon);

/** Series won. */
export const matchWins = byRecord('match_wins', (r) => r.wins);

/**
 * The team with the lower total MMR is ahead: it reached the same result as the underdog. A team
 * without a known MMR is placed after every team with one, never ahead of it.
 */
export const lowerMmr: Rule<'lower_mmr'> = {
  id: 'lower_mmr',
  decision: false,
  apply: (tied, ctx) => tiersByValue(tied, (team) => ctx.teams.get(team)?.mmr ?? null, 'lower'),
};
