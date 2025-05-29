
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
  points?: number;
  mostPlayedHeroes?: HeroPlayStats[];
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
};

export type Group = {
  id: string;
  name: string;
  teams: Team[];
};

// For registration form state with react-hook-form
// File fields are File | undefined because user might not have selected one yet.
// Zod schema will enforce they are 'File' upon validation if 'requiredFileSchema' is used.
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

// For server action state (remains in definitions.ts as it's used by actions and page)
export type RegistrationFormState = {
  message: string;
  errors?: z.ZodIssue[];
  success: boolean;
};


// For Stats Page
export type StatItem = {
  id: string;
  category: string;
  playerName?: string;
  teamName?: string;
  playerId?: string; 
  teamId?: string;   
  value: string | number;
  heroName?: string;
  matchContext?: string;
  icon: LucideIcon;
};

export type TournamentHighlightRecord = {
  id: string;
  title: string;
  value: string;
  details?: string;
  icon: LucideIcon;
};

