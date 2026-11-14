// Inputs and outputs of the standings computation. Plain data on purpose: the caller maps its
// rows (database, import, fixture) to these shapes, so this code never depends on storage.

import type { RankingRules, TiebreakerId } from './schema';

export type TeamId = string;

/** A team that plays in the table (one group of one stage). */
export interface StandingsTeam {
  id: TeamId;
  name: string;
  /** Total MMR of the roster, for `lower_mmr`. Unknown MMR is left out, not 0. */
  mmr?: number;
  /** Seed within the group. Not used by any tie-breaker; carried for seeding (WP-34). */
  seed?: number;
}

/** The values of `matches.status` (SCHEMA.md). */
export type MatchStatus = 'scheduled' | 'live' | 'completed' | 'bye' | 'void';

/** The values of `matches.kind` (SCHEMA.md). */
export type MatchKind = 'regular' | 'tiebreak' | 'rematch' | 'showmatch' | 'other';

/** One series. A bye is a match with status `bye` and one team; the other side is null. */
export interface StandingsMatch {
  id: string;
  teamAId: TeamId | null;
  teamBId: TeamId | null;
  /** Series score: games won by each side. Null until a result is recorded. */
  scoreA: number | null;
  scoreB: number | null;
  status: MatchStatus;
  kind: MatchKind;
  /** True when a rematch replays this match; it then counts nowhere. */
  replaced: boolean;
  round: number;
}

/** A team's numbers from the matches that count. */
export interface TeamRecord {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  gamesWon: number;
  gamesLost: number;
  points: number;
  /** Points of beaten opponents plus half the points of opponents drawn with. */
  neustadtl: number;
  /** Points of every opponent faced, once per match; byes add nothing. */
  buchholz: number;
}

/** A tie that waits for the organizer: a tiebreaker match to be played, or a manual order. */
export interface OpenTie {
  /** The tied teams, in team id order. */
  teamIds: TeamId[];
  /** The decision rules that were reached and could not order them. */
  awaiting: Array<'tiebreak_match' | 'manual'>;
  /** The places the teams share. */
  places: { first: number; last: number };
}

export interface TiebreakerValue {
  rule: TiebreakerId;
  /** What the rule compared; null when the team has none (no MMR, no decision yet). For `head_to_head` and `head_to_head_wins` it is relative to the teams tied when the rule was applied. */
  value: number | null;
}

export interface StandingRow {
  teamId: TeamId;
  teamName: string;
  /** 1-based. Teams that share a place have the same number; the next place skips (1, 2, 2, 4). */
  place: number;
  sharedPlace: boolean;
  record: TeamRecord;
  /** The tie-breakers applied to this team's tie, in order, with this team's value. Empty when points alone placed it. */
  tiebreakers: TiebreakerValue[];
  openTie?: OpenTie;
}

export interface Standings {
  /** Best first. Teams sharing a place are listed in team id order. */
  rows: StandingRow[];
  openTies: OpenTie[];
}

export interface StandingsInput {
  teams: readonly StandingsTeam[];
  matches: readonly StandingsMatch[];
  rules: RankingRules;
  /** Count only matches up to and including this round (the table after round n). */
  throughRound?: number;
  /**
   * Whether a tie over these places decides something (a playoff place, relegation, a prize).
   * Used only when `rules.tiebreakOnlyWhenDecisive` is set; advancement (WP-34) provides it.
   * Without it every tie counts as decisive.
   */
  isDecisive?: (places: { first: number; last: number }) => boolean;
}
