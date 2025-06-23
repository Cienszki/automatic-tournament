
import type { z } from "zod";
import type { LucideIcon } from "lucide-react";

export const PlayerRoles = ["Carry", "Mid", "Offlane", "Soft Support", "Hard Support"] as const;
export type PlayerRole = typeof PlayerRoles[number];

export const TournamentStatuses = ["Not Verified", "Active", "Eliminated", "Champions"] as const;
export type TournamentStatus = typeof TournamentStatuses[number];

export type Player = {
  id: string; // For mock data, base player ID like "p1", team-specific is "p1-t1"
  nickname: string;
  mmr: number;
  role: PlayerRole;
  status: TournamentStatus;
  profileScreenshotUrl?: string; // URL after upload
  steamProfileUrl: string;
  openDotaProfileUrl?: string;
  fantasyPointsEarned?: number;
  avgKills?: number;
  avgDeaths?: number;
  avgAssists?: number;
  avgGPM?: number;
  avgXPM?: number;
};

export type HeroPlayStats = {
  name: string;
  gamesPlayed: number;
};

export const StandInStatuses = ["approved", "pending"] as const;
export type StandInStatus = (typeof StandInStatuses)[number];

export type StandIn = {
  id: string;
  nickname: string;
  mmr: number;
  steamProfileUrl: string;
  status: StandInStatus;
};

export type Team = {
  id: string;
  name: string;
  logoUrl?: string; // URL after upload
  motto?: string; // Added team motto
  players: Player[]; // These players will have team-specific IDs like "p1-t1"
  status: TournamentStatus;
  standIns?: StandIn[];
  matchesPlayed?: number;
  matchesWon?: number;
  matchesLost?: number;
  points?: number; // Overall tournament points based on wins/draws
  mostPlayedHeroes?: HeroPlayStats[];
  averageMatchDurationMinutes?: number;
  averageKillsPerGame?: number;
  averageDeathsPerGame?: number;
  averageAssistsPerGame?: number;
  averageFantasyPoints?: number;
};

export type PlayerPerformanceInMatch = {
  playerId: string; // Team-specific player ID like "p1-t1"
  teamId: string;
  hero: string;
  kills: number;
  deaths: number;
  assists: number;
  gpm: number;
  xpm: number;
  fantasyPoints: number;
  lastHits: number;
  denies: number;
  netWorth: number;
  heroDamage: number;
  towerDamage: number;
};

export type Match = {
  id: string;
  teamA: Team;
  teamB: Team;
  teamAScore?: number;
  teamBScore?: number;
  dateTime: Date;
  status: 'upcoming' | 'live' | 'completed';
  openDotaMatchUrl?: string;
  performances?: PlayerPerformanceInMatch[];
  round?: string; // e.g., "Group Stage R2", "WB Semifinals"
};

export type Group = {
  id: string;
  name: string;
  teams: Team[];
};


// Details for each ranked entry in an expandable stats category
export type CategoryRankingDetail = {
  rank: number;
  playerName?: string;
  teamName?: string;
  playerId?: string; // base player id e.g. p1
  teamId?: string;
  value: string | number; // The actual stat value
  heroName?: string;       // For single match records
  matchContext?: string;   // For single match records, e.g. "vs TeamX"
  openDotaMatchUrl?: string; // For single match records
};

// Structure for displaying a category with its top rankings
export type CategoryDisplayStats = {
  id: string; // Unique ID for the category row, e.g., 'single-most-kills'
  categoryName: string;
  icon: LucideIcon;
  rankings: CategoryRankingDetail[]; // Array of top 5 records
};


export type TournamentHighlightRecord = {
  id: string;
  title: string;
  value: string;
  details?: string;
  icon: LucideIcon;
};

export type PlayerFormData = {
  nickname: string;
  mmr: string; // string for form input, Zod will transform to number
  profileScreenshot: File | undefined;
  steamProfileUrl: string;
  role: PlayerRole | ""; 
};

export type TeamRegistrationFormData = {
  teamName: string;
  teamLogo: File | undefined;
  teamMotto?: string; // Added team motto
  player1: PlayerFormData;
  player2: PlayerFormData;
  player3: PlayerFormData;
  player4: PlayerFormData;
  player5: PlayerFormData;
  rulesAgreed: boolean;
};

// Fantasy League Definitions
export type FantasyLineup = {
  [key in PlayerRole]?: Player; // Player object or undefined if not selected
};

export type FantasyLeagueParticipant = {
  id: string; // User ID, e.g., Discord user ID
  discordUsername: string;
  avatarUrl?: string; // URL to user's Discord avatar
  selectedLineup: FantasyLineup; // Current round lineup (or being built)
  previousLineup?: FantasyLineup; // Lineup from the previous locked round
  totalMMRCost: number;
  totalFantasyPoints: number;
  rank?: number;
};

// Form state for Server Actions
export type RegistrationFormState = {
  message: string;
  errors?: z.ZodIssue[];
  success: boolean;
};
