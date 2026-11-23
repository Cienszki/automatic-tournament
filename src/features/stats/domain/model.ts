// The stats hub's season model: the dataset cross-referenced (games, performances, players,
// teams, heroes) with each one's aggregates. Built by deriveModel (derive.ts).

import type { DsGame, DsMatch, DsPlayer, DsTeam, PerfNumField, StatsDataset } from './types';
import type { MetricKey } from './metrics';

export type Perf = Record<PerfNumField, number> & {
  idx: number;
  game: GameX;
  pid: string;
  tid: string;
  player?: PlayerX;
  team?: TeamX;
  win: boolean;
  radiant: boolean;
  /** game length in minutes */
  min: number;
  parsed: boolean;
  teamKills: number;
  kda: number;
  hdpm: number;
  lhpm: number;
  kp: number;
  /** Performance score (rankings page formula); NaN when unscored (no role / cross-team standin) */
  score: number;
};

export interface GameX extends DsGame {
  idx: number;
  match?: DsMatch;
  radiantTeam?: TeamX;
  direTeam?: TeamX;
  winnerId: string;
  loserId: string;
  perfs: Perf[];
  radiantKills: number;
  direKills: number;
  kills: number;
  radiantNW: number;
  direNW: number;
  parsed: boolean;
  /** Highest performance score of the game (highest fantasy points when nobody is scored) */
  mvp?: Perf;
  /** First-blood claimer (parsed games only) */
  fbPerf?: Perf;
}

export interface MetricAgg {
  avg: number | null;
  total: number;
  best: Perf | null;
  /** games counted for the average */
  n: number;
}

export interface HeroUse { heroId: number; games: number; wins: number }

export interface PlayerX extends DsPlayer {
  team?: TeamX;
  perfs: Perf[];
  games: number;
  wins: number;
  losses: number;
  wr: number;
  agg: Record<MetricKey, MetricAgg>;
  heroes: HeroUse[];
  /** Longest run of consecutive won games */
  bestWinStreak: number;
  fbCount: number;
}

export interface TeamAverages {
  kills: number; deaths: number; assists: number; gpm: number; heroDamage: number; towerDamage: number;
  wards: number; dewards: number; stacks: number; roshans: number; netWorth: number; duration: number;
  winDuration: number | null; lossDuration: number | null; fbRate: number | null; heroHealing: number;
}

export interface TeamX extends DsTeam {
  players: PlayerX[];
  games: GameX[];
  wins: number;
  losses: number;
  wr: number;
  series: { w: number; d: number; l: number };
  /** Per-game team averages */
  avg: TeamAverages;
  radiant: { games: number; wins: number };
  dire: { games: number; wins: number };
  heroPicks: HeroUse[];
  bansBy: Array<{ heroId: number; count: number }>;
  bansAgainst: Array<{ heroId: number; count: number }>;
  /** Chronological W/L per game */
  form: boolean[];
}

export interface HeroX {
  heroId: number;
  picks: number;
  wins: number;
  bans: number;
  contest: number;
  pickRate: number;
  banRate: number;
  contestRate: number;
  wr: number;
  radiant: { picks: number; wins: number };
  dire: { picks: number; wins: number };
  firstPhaseBans: number;
  perfs: Perf[];
  avgK: number; avgD: number; avgA: number; avgGpm: number;
  players: Array<{ player: PlayerX; games: number; wins: number }>;
}

export interface SeasonTotals {
  kills: number; deaths: number; assists: number; rampages: number; ultraKills: number; tripleKills: number;
  roshans: number; towers: number; wards: number; dewards: number; stacks: number; runes: number;
  buybacks: number; couriers: number; heroDamage: number; gold: number; hours: number; healing: number;
  lastHits: number; denies: number;
}

export interface Model {
  ds: StatsDataset;
  games: GameX[];
  perfs: Perf[];
  /** Named players only */
  players: PlayerX[];
  playerById: Map<string, PlayerX>;
  teams: TeamX[];
  teamById: Map<string, TeamX>;
  heroes: HeroX[];
  heroById: Map<number, HeroX>;
  draftGames: number;
  parsedGames: number;
  /** Default "qualified" threshold for per-game averages */
  minGames: number;
  totals: SeasonTotals;
}

export const mean = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
export const inc = <K>(m: Map<K, number>, k: K, by = 1) => m.set(k, (m.get(k) ?? 0) + by);
