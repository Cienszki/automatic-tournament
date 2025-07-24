// src/lib/definitions.ts

// This is the official ID for the tournament league on the OpenDota API.
// You should replace 0 with the actual ID for your league.
export const LEAGUE_ID = 0;
export const TEAM_MMR_CAP = 24000;

export type TeamStatus = 'pending' | 'verified' | 'rejected' | 'warning' | 'banned';
export const PlayerRoles = ['Carry', 'Mid', 'Offlane', 'Soft Support', 'Hard Support'] as const;
export type PlayerRole = typeof PlayerRoles[number];

export interface Player {
  id: string;
  nickname: string;
  mmr: number;
  role: PlayerRole;
  steamId: string;
  steamId32: string;
  profileScreenshotUrl: string;
  avatar?: string;
  avatarmedium?: string;
  avatarfull?: string;
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
  createdAt: string; // Stored as ISO string
  players: Player[];
  // Optional fields for test accounts
  testCaptainEmail?: string;
  testCaptainPassword?: string;
}

export interface Match {
  id: string;
  teamA: { id: string; name: string; score: number; logoUrl: string; };
  teamB: { id: string; name: string; score: number; logoUrl: string; };
  teams: string[];
  status: 'scheduled' | 'completed' | 'live';
  scheduled_for: string; // ISO string for the scheduling deadline
  defaultMatchTime: string; // ISO string
  dateTime?: string; // ISO string for the confirmed match time
  group_id?: string;
  playoff_round?: number;
  // Fields for the time proposal system
  schedulingStatus: 'unscheduled' | 'proposed' | 'confirmed';
  proposedTime?: string; // ISO string
  proposingCaptainId?: string;
  // Data from OpenDota
  opendota_match_id?: number;
  // Completion timestamp
  completed_at?: string; // ISO string
}

export interface GroupStanding {
  teamId: string;
  teamName: string;
  teamLogoUrl: string;
  matchesPlayed: number;
  points: number;
  wins: number;
  losses: number;
  headToHead: { [opponentId: string]: 'win' | 'loss' };
  neustadtlScore: number;
  status: 'pending' | 'updated';
}

export interface Group {
  id: string;
  name: string;
  standings: { [teamId: string]: GroupStanding };
}

export interface PlayoffData {
    id: string; // e.g., 'round-1', 'grand-finals'
    round: number;
    name: string;
    matches: Match[];
}

export interface TournamentPlayer extends Player {
    teamId: string;
    teamName: string;
    teamTag: string;
}

// Fantasy & Pick'em
export interface FantasyLineup {
    userId: string;
    players: TournamentPlayer[];
    totalScore: number;
}

export interface FantasyData {
    players: TournamentPlayer[];
    lineups: FantasyLineup[];
}

export interface PickemPrediction {
    userId: string;
    matchId: string;
    predictedWinnerId: string;
}

// Stats Page
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

export interface PlayerPerformanceInMatch {
    playerId: string;
    matchId: string;
    kills: number;
    deaths: number;
    assists: number;
    gpm: number;
    xpm: number;
    lastHits: number;
    denies: number;
    heroDamage: number;
    towerDamage: number;
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
