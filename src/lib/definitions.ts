// src/lib/definitions.ts

// ... (other definitions remain the same)

export interface PlayerPerformanceInGame {
    playerId: string;
    teamId: string;
    heroId: number;
    kills: number;
    deaths: number;
    assists: number;
    gpm: number;
    xpm: number;
    lastHits: number;
    denies: number;
    netWorth: number;
    heroDamage: number;
    towerDamage: number;
    obsPlaced: number;
    senPlaced: number;
    courierKills: number;
    firstBloodClaimed: boolean;
    observerKills: number;
    sentryKills: number;
    highestKillStreak: number;
    buybackCount: number;
    heroHealing: number;
    fantasyPoints: number;
}

export interface Game {
    id: string; // OpenDota match_id
    radiant_win: boolean;
    duration: number;
    start_time: number;
    firstBloodTime: number;
    picksBans?: any[];
    radiant_team?: { id: string; name: string; };
    dire_team?: { id: string; name: string; };
}

export interface Match {
  id: string;
  teamA: { id: string; name: string; score: number; logoUrl: string; };
  teamB: { id: string; name: string; score: number; logoUrl: string; };
  teams: string[];
  status: 'scheduled' | 'completed' | 'live';
  scheduled_for: string; 
  defaultMatchTime: string; 
  dateTime?: string; 
  group_id?: string;
  playoff_round?: number;
  schedulingStatus: 'unscheduled' | 'proposed' | 'confirmed';
  proposedTime?: string;
  proposingCaptainId?: string; 
  proposedById?: string; 
  game_ids?: number[]; // This now holds the IDs of the individual games
  completed_at?: string;
  series_format?: 'bo1' | 'bo2' | 'bo3' | 'bo5'; // Series format (BO2 for groups, BO1/BO3/BO5 for playoffs)
  winnerId?: string | null; // Winner of the match, null for draws
  playerPerformances?: PlayerPerformanceInMatch[];
  openDotaMatchUrl?: string;
  standinInfo?: { 
    [teamId: string]: {
      teamId: string;
      unavailablePlayers: string[];
      standins: string[];
    }
  };
}

export interface PlayerPerformanceInMatch {
  playerId: string;
  teamId: string;
  hero: string;
  kills: number;
  deaths: number;
  assists: number;
  gpm: number;
  xpm: number;
  fantasyPoints: number;
}

// ... (rest of definitions)
export const LEAGUE_ID = 18559;
export const TEAM_MMR_CAP = 24000;
export const FANTASY_BUDGET_MMR = 24000;

export type TeamStatus = 'pending' | 'verified' | 'rejected' | 'warning' | 'banned' | 'eliminated';
export const PlayerRoles = ['Carry', 'Mid', 'Offlane', 'Soft Support', 'Hard Support'] as const;
export type PlayerRole = typeof PlayerRoles[number];

export interface Player {
  id: string;
  nickname: string;
  mmr: number;
  role: PlayerRole;
  steamId: string;
  steamId32: string;
  steamProfileUrl?: string;
  openDotaAccountId?: number;
  profileScreenshotUrl: string;
  avatar?: string;
  avatarmedium?: string;
  avatarfull?: string;
}

export interface UserProfile {
  uid: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
  discordUsername?: string;
  roles?: {
    admin?: boolean;
  };
}

export interface Team {
  id:string;
  name: string;
  tag: string;
  logoUrl: string;
  captainId: string;
  discordUsername: string;
  motto: string;
  status: TeamStatus;
  createdAt: string;
  players: Player[];
  openDotaTeamId?: number;
  testCaptainEmail?: string;
  testCaptainPassword?: string;
  
  // Team statistics
  matchesPlayed?: number;
  wins?: number;
  draws?: number;
  losses?: number;
  averageKillsPerGame?: number;
  averageDeathsPerGame?: number;
  averageAssistsPerGame?: number;
  averageFantasyPoints?: number;
  averageMatchDurationMinutes?: number;
  averageGpm?: number;
  averageXpm?: number;
  averageLastHits?: number;
  averageNetWorth?: number;
  averageHeroDamage?: number;
  averageTowerDamage?: number;
  averageHeroHealing?: number;
  mostPlayedHeroes?: Array<{
    name: string;
    gamesPlayed: number;
  }>;
  captainDiscordUsername?: string;
}

export interface GroupStanding {
  teamId: string;
  teamName: string;
  teamLogoUrl: string;
  matchesPlayed: number;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  headToHead: { [opponentId: string]: 'win' | 'loss' | 'draw' };
  neustadtlScore: number;
  status: 'pending' | 'updated';
  totalMMR: number;
}

export interface Group {
  id: string;
  name: string;
  standings: { [teamId: string]: GroupStanding };
}

export interface TournamentPlayer extends Player {
    teamId: string;
    teamName: string;
    teamTag: string;
}

export interface FantasyLineup {
    userId: string;
    lineup: Partial<Record<PlayerRole, TournamentPlayer>>;
    totalFantasyScore: number;
}

export interface FantasyData {
    players: TournamentPlayer[];
    lineups: FantasyLineup[];
}

export interface Pickem {
    userId: string;
    predictions: {
        champion: string[];
        runnerUp: string[];
        thirdPlace: string[];
        fourthPlace: string[];
        fifthToSixth: string[];
        seventhToEighth: string[];
        ninthToTwelfth: string[];
        thirteenthToSixteenth: string[];
        pool: string[];
    };
    scores: Record<string, number>;
    lastUpdated: any;
}

export interface PickemPrediction {
    userId: string;
    matchId: string;
    predictedWinnerId: string;
}

export interface CategoryDisplayStats {
    categoryName: string;
    leader: {
        playerId: string;
        playerNickname: string;
        teamName: string;
        teamTag: string;
        value: number;
    };
}

export interface CategoryRankingDetail {
    playerId: string;
    playerNickname: string;
    teamName: string;
    teamTag: string;
    averageValue: number;
    matchesPlayed: number;
}

export interface TournamentHighlightRecord {
    category: string;
    playerId: string;
    playerNickname: string;
    teamName: string;
    teamTag: string;
    value: number;
    matchId: string;
}

export interface Announcement {
    id: string;
    title: string;
    content: string;
    authorId: string;
    authorName: string;
    createdAt: Date;
}

export type StandinStatus = 'pending' | 'verified';

export interface Standin {
    id: string;
    userId: string;
    nickname: string;
    discordUsername: string;
    mmr: number;
    profileScreenshotUrl: string;
    steamProfileUrl: string;
    steamId?: string;
    steamId32?: string;
    roles: string[]; // Array of roles they can play: 'Carry', 'Mid', 'Offlane', 'Soft Support', 'Hard Support'
    description: string; // Max 300 characters - when available, heroes they play, additional info
    status: StandinStatus;
    createdAt: string;
    verifiedAt?: string;
    matches?: string[]; // Array of match IDs where they are standing in
}

export interface StandinRequest {
    id: string;
    matchId: string;
    teamId: string;
    captainId: string;
    unavailablePlayers: string[]; // Player IDs who won't be available
    requestedStandins: string[]; // Standin IDs requested
    createdAt: string;
    status: 'pending' | 'approved' | 'rejected';
}

// Playoff System Types
export type PlayoffMatchFormat = 'bo1' | 'bo3' | 'bo5';
export type PlayoffMatchStatus = 'scheduled' | 'live' | 'completed' | 'bye';
export type PlayoffBracketType = 'upper' | 'lower' | 'wildcard' | 'final';

export interface PlayoffSlot {
    id: string;
    position: number; // Position in bracket (1-8 for upper, 1-8 for lower, etc.)
    teamId?: string; // null if slot is empty
    bracketType: PlayoffBracketType;
    round: number; // Which round this slot belongs to
}

export interface PlayoffMatch {
    id: string;
    matchId?: string; // Reference to regular Match if created
    bracketType: PlayoffBracketType;
    round: number;
    position: number; // Position within the round
    teamASlotId?: string; // Reference to playoff slot
    teamBSlotId?: string; // Reference to playoff slot
    teamA?: { id: string; name: string; logoUrl?: string; };
    teamB?: { id: string; name: string; logoUrl?: string; };
    winnerSlotId?: string; // Where winner advances to
    loserSlotId?: string; // Where loser goes (for upper bracket)
    format: PlayoffMatchFormat; // bo1, bo3, bo5
    status: PlayoffMatchStatus;
    result?: {
        winnerId: string;
        loserId: string;
        teamAScore: number;
        teamBScore: number;
        completedAt: string;
    };
    scheduledFor?: string;
    createdAt: string;
    updatedAt: string;
}

export interface PlayoffBracket {
    id: string;
    name: string; // e.g., "Upper Bracket", "Lower Bracket", "Wildcards"
    type: PlayoffBracketType;
    slots: PlayoffSlot[];
    matches: PlayoffMatch[];
    isActive: boolean;
}

export interface PlayoffData {
    id: string;
    name: string; // Tournament name
    brackets: PlayoffBracket[];
    wildcardSlots: number; // Number of wildcard spots (default 2)
    isSetup: boolean; // Whether admin has completed initial setup
    createdAt: string;
    updatedAt: string;
}
