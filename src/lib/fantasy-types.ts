import type { PlayerRole, TournamentPlayer } from "./definitions";

// Fantasy scoring interfaces - client-safe
export interface FantasyUserSummary {
  userId: string;
  displayName: string;
  totalScore: number;
  averageScore: number;
  gamesPlayed: number;
  rank: number;
  lineupHistory: Array<{
    round: string;
    lineup: Partial<Record<PlayerRole, TournamentPlayer>>;
    score: number;
    gamesInRound: number;
  }>;
}

export interface FantasyPlayerStats {
  playerId: string;
  nickname: string;
  teamName: string;
  role: PlayerRole;
  totalScore: number;
  averageScore: number;
  totalMatches: number;
  rank: number;
  matchHistory: Array<{
    matchId: string;
    date: string;
    opponent: string;
    score: number;
    kills: number;
    deaths: number;
    assists: number;
    lastHits: number;
    denies: number;
    gpm: number;
    xpm: number;
    netWorth: number;
    heroDamage: number;
    towerDamage: number;
    heroHealing: number;
    isWin: boolean;
  }>;
}

export interface FantasyLeaderboards {
  overall: Array<{
    userId: string;
    displayName: string;
    averageScore: number;
    gamesPlayed: number;
    rank: number;
  }>;
  byRole: {
    [K in PlayerRole]: Array<{
      playerId: string;
      nickname: string;
      teamName: string;
      averageScore: number;
      totalMatches: number;
      rank: number;
    }>;
  };
}

// Round display names - client-safe constants
export const ROUND_DISPLAY_NAMES: Record<string, string> = {
  initial: "Pre-Tournament Setup",
  pre_season: "Pre-Season",
  group_stage: "Group Stage",
  wildcards: "Wildcards",
  playoffs_round1: "Round 1",
  playoffs_round2: "Round 2", 
  playoffs_round3: "Round 3",
  playoffs_round4: "Round 4",
  playoffs_round5: "Round 5",
  playoffs_round6: "Round 6",
  playoffs_semifinals: "Semifinals",
  playoffs_grandfinals: "Grand Finals"
};

// Client-safe utility function
export function getNextRoundForLineup(currentTournamentRound: string): string {
  const roundOrder = [
    'initial',
    'pre_season', 
    'group_stage',
    'wildcards',
    'playoffs_round1',
    'playoffs_round2',
    'playoffs_round3',
    'playoffs_round4',
    'playoffs_round5',
    'playoffs_round6',
    'playoffs_semifinals',
    'playoffs_grandfinals'
  ];
  
  const currentIndex = roundOrder.indexOf(currentTournamentRound);
  if (currentIndex === -1 || currentIndex === roundOrder.length - 1) {
    return currentTournamentRound;
  }
  
  return roundOrder[currentIndex + 1];
}