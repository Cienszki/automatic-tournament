// Everything computeTournament reads: the rows of one tournament, as plain data. The loader
// (queries.ts) selects exactly these columns; tests build them from fixtures. Nothing here holds
// a number that combines games: those are all computed from these rows (WP-15).

export interface InputTournament {
  id: string;
  /** `league`, `mmr-limited` or `swiss`: chooses how the hub slices the season into periods. */
  formatPreset: string;
  /** `draft`, `registration`, `active`, `completed` or `archived`. */
  status: string;
}

export interface InputStage {
  id: string;
  position: number;
  kind: 'round_robin' | 'swiss' | 'bracket';
  name: string;
  /** `stages.ranking` as stored; parsed by the formats feature. Null: the stage kind's defaults. */
  ranking: unknown;
}

export interface InputGroup {
  id: string;
  stageId: string;
  name: string;
  position: number;
  tier: number | null;
}

export interface InputGroupTeam { groupId: string; teamId: string; seed: number | null }

export interface InputTeam {
  id: string;
  name: string;
  tag: string | null;
  logoUrl: string | null;
  status: string;
}

/** A roster entry, with the Steam picture of the player. */
export interface InputMember {
  id: string;
  teamId: string;
  steamId64: string | null;
  kind: 'player' | 'substitute' | 'coach';
  position: string | null;
  nickname: string;
  mmr: number | null;
  joinedAt: Date;
  leftAt: Date | null;
  /** `players.avatar_medium_url`, else the full or small one. */
  avatarUrl: string | null;
}

/** Someone who played as a stand-in: an approved request, or a registration in the stand-in pool. */
export interface InputStandin {
  steamId64: string | null;
  nickname: string;
}

export interface InputMatch {
  id: string;
  stageId: string;
  groupId: string | null;
  round: number;
  matchday: number | null;
  kind: 'regular' | 'tiebreak' | 'rematch' | 'showmatch' | 'other';
  replacesMatchId: string | null;
  teamAId: string | null;
  teamBId: string | null;
  status: 'scheduled' | 'live' | 'completed' | 'bye' | 'void';
  scoreA: number | null;
  scoreB: number | null;
  winnerTeamId: string | null;
  completedAt: Date | null;
  scheduledAt: Date | null;
  forfeitTeamId: string | null;
  forfeitScope: 'series' | 'games' | null;
  /** Bracket code shown on the bracket (`U2B`, `GF`). */
  code: string | null;
}

export interface InputPickBan { heroId: number; isPick: boolean; order: number; team: 0 | 1 }

export interface InputGame {
  id: string;
  matchId: string;
  number: number;
  radiantTeamId: string | null;
  direTeamId: string | null;
  radiantWin: boolean | null;
  isForfeit: boolean;
  startedAt: Date | null;
  durationSeconds: number | null;
  firstBloodSeconds: number | null;
  picksBans: InputPickBan[];
}

export interface InputPerformance {
  gameId: string;
  steamId64: string;
  teamId: string | null;
  heroId: number | null;
  kills: number; deaths: number; assists: number; lastHits: number; denies: number; gpm: number; xpm: number;
  netWorth: number; totalGold: number; goldSpent: number; heroDamage: number; towerDamage: number; heroHealing: number;
  obsPlaced: number; senPlaced: number; observerKills: number; sentryKills: number; courierKills: number;
  roshanKills: number; towerKills: number; neutralKills: number; laneKills: number; campsStacked: number;
  runesPickedUp: number; buybacks: number; firstBlood: boolean; highestKillStreak: number;
  doubleKills: number; tripleKills: number; ultraKills: number; rampages: number;
}

export interface TournamentInput {
  tournament: InputTournament;
  /** When the rows were read; the dataset's `generatedAt`. */
  loadedAt: Date;
  stages: InputStage[];
  groups: InputGroup[];
  groupTeams: InputGroupTeam[];
  teams: InputTeam[];
  members: InputMember[];
  standins: InputStandin[];
  matches: InputMatch[];
  games: InputGame[];
  performances: InputPerformance[];
}
