// Shared shape of the raw stats dataset served by /api/stats/dataset and consumed by the
// stats-redesign pages. Everything here is already in Firestore (matches → games →
// performances, teams, rosters); the API just packs it into one compact payload.

export interface DsTeam {
  id: string;
  name: string;
  tag?: string;
  logoUrl?: string;
}

export interface DsPlayer {
  /** steamId64 (or the legacy performance playerId) — the key used in performances */
  id: string;
  name: string;
  /** Roster team; standins have none and get their most-played team client-side */
  teamId?: string;
  role?: string;
  avatar?: string;
  /** True when the player only appears as an approved standin */
  standin?: boolean;
}

export interface DsGroup {
  id: string;
  name: string;
  tier?: number;
}

export interface DsMatch {
  id: string;
  /** Division / group id (absent for playoff mirrors) */
  groupId?: string;
  teamA: string;
  teamB: string;
  scoreA: number;
  scoreB: number;
  winnerId: string | null;
  round?: number;
  matchday?: number;
  isPlayoff?: boolean;
  playoffCode?: string;
  /** ms epoch */
  completedAt?: number;
}

/** [hero_id, is_pick (1/0), team (0 radiant / 1 dire), order] */
export type DsPickBan = [number, number, number, number];

export interface DsGame {
  id: string;
  matchId: string;
  radiant: string;
  dire: string;
  radiantWin: boolean;
  duration: number;
  /** unix seconds */
  start: number;
  firstBlood: number;
  pb: DsPickBan[];
}

/**
 * Per-player-per-game numbers, columnar: `perfs[i][PERF_FIELDS.indexOf(f)]`.
 * Column 0..2 are indices into games / player ids / team ids (see DsPerfRow).
 */
export const PERF_NUM_FIELDS = [
  'heroId', 'kills', 'deaths', 'assists', 'gpm', 'xpm', 'lastHits', 'denies', 'netWorth',
  'heroDamage', 'towerDamage', 'heroHealing', 'obsPlaced', 'senPlaced', 'observerKills',
  'sentryKills', 'courierKills', 'firstBloodClaimed', 'highestKillStreak', 'buybackCount',
  'fantasyPoints', 'doubleKills', 'tripleKills', 'ultraKills', 'rampages', 'roshanKills',
  'towerKills', 'neutralKills', 'laneKills', 'totalGold', 'goldSpent', 'runesPickedUp',
  'campsStacked',
] as const;
export type PerfNumField = typeof PERF_NUM_FIELDS[number];

export interface StatsDataset {
  tournamentId: string;
  generatedAt: string;
  teams: DsTeam[];
  /** Divisions / groups (may be empty) */
  groups?: DsGroup[];
  players: DsPlayer[];
  matches: DsMatch[];
  games: DsGame[];
  /** Each row: [gameIndex, playerId, teamId, ...PERF_NUM_FIELDS values] */
  perfs: Array<[number, string, string, ...number[]]>;
}
