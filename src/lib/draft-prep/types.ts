// Shapes shared by the draft-preparation API routes and pages.

export interface DpPlayer {
  sid64: string;
  sid32: string;
  name: string;
  role?: string;
  avatar?: string;
  mmr?: number;
  /** Registered smurf accounts (their ids are never sent to the browser) */
  smurfs: number;
}

export interface DpPastStandin { sid32: string; name: string; /** matches played for this team */ n: number; last?: string }

export interface DpTeam { id: string; name: string; tag?: string; logoUrl?: string; captainId?: string; players: DpPlayer[]; /** Standins who played for the team earlier in the tournament */ pastStandins?: DpPastStandin[] }

export interface DpStandin {
  teamId: string;
  /** steamId64 of the roster player being replaced */
  replaces: string;
  sid32: string;
  name: string;
  status: 'approved' | 'pending';
  /** Games of the series it covers; empty = whole series */
  games: number[];
}

export interface DpUpcoming { id: string; teamA: string; teamB: string; status: string; scheduledFor?: string; bestOf?: number; standins: DpStandin[] }

export interface DpContext { teams: DpTeam[]; matches: DpUpcoming[] }

/** [matchId, startUnix, heroId, win 0/1, kind 0 public / 1 league lobby, laneRole 0-4, position 0-5 (STRATZ, 0 = unknown), accountIndex?] */
export type DpMatchRow = [number, number, number, number, number, number, number, number?];

export interface DpHistory { name?: string; avatar?: string; rankTier?: number; accounts: number; rows: DpMatchRow[]; /** games with a known position (STRATZ) */ positions?: number }

export interface DpMeta {
  patches: Array<{ name: string; start: number }>;
  heroes: Array<{ id: number; cm: boolean; proPick: number; proWin: number; proBan: number; hiPick: number; hiWin: number; pubPick: number; pubWin: number }>;
}
