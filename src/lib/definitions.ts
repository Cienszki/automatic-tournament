
import type { z } from "zod";
import type { LucideIcon } from "lucide-react";

export const PlayerRoles = ["Carry", "Mid", "Offlane", "Soft Support", "Hard Support"] as const;
export type PlayerRole = typeof PlayerRoles[number];

export const TournamentStatuses = ["Not Verified", "Active", "Eliminated", "Champions"] as const;
export type TournamentStatus = typeof TournamentStatuses[number];

export type Player = {
  id: string;
  nickname: string;
  mmr: number;
  role: PlayerRole;
  status: TournamentStatus;
  profileScreenshotUrl?: string; // URL after upload
  steamProfileUrl: string;
  openDotaProfileUrl?: string;
};

export type HeroPlayStats = {
  name: string;
  gamesPlayed: number;
};

export type Team = {
  id: string;
  name: string;
  logoUrl?: string; // URL after upload
  players: Player[];
  status: TournamentStatus;
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
  playerId: string;
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
};

export type Group = {
  id: string;
  name: string;
  teams: Team[];
};

export type RegistrationFormState = {
  message: string;
  errors?: z.ZodIssue[];
  success: boolean;
};


// For Stats Page (Original StatItem, potentially for other uses or as a base)
export type StatItem = {
  id: string; // Unique ID for the stat entry
  category: string;
  playerName?: string;
  teamName?: string;
  playerId?: string;
  teamId?: string;
  value: string | number;
  heroName?: string;
  matchContext?: string;
  openDotaMatchUrl?: string;
  icon: LucideIcon; // Icon for the category
};

// Details for each ranked entry in an expandable stats category
export type CategoryRankingDetail = {
  rank: number;
  playerName?: string;
  teamName?: string;
  playerId?: string;
  teamId?: string;
  value: string | number; // The actual stat value
  heroName?: string;       // For single match records
  matchContext?: string;   // For single match records
  openDotaMatchUrl?: string; // For single match records
};

// Structure for displaying a category with its top rankings
export type CategoryDisplayStats = {
  id: string; // Unique ID for the category row, e.g., 'single-most-kills'
  categoryName: string;
  icon: LucideIcon;
  // rankings[0] is the top performer for the collapsed (AccordionTrigger) view
  // rankings[1] to rankings[4] are for the expanded (AccordionContent) view
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
};

export type TeamRegistrationFormData = {
  teamName: string;
  teamLogo: File | undefined;
  player1: PlayerFormData;
  player2: PlayerFormData;
  player3: PlayerFormData;
  player4: PlayerFormData;
  player5: PlayerFormData;
  rulesAgreed: boolean;
};
