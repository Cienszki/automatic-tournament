
import type { z } from "zod";

export const PlayerRoles = ["Carry", "Mid", "Offlane", "Soft Support", "Hard Support"] as const;
export type PlayerRole = typeof PlayerRoles[number];

export type Player = {
  id: string;
  nickname: string;
  mmr: number;
  role: PlayerRole;
  profileScreenshotUrl?: string; // URL after upload
  steamProfileUrl: string;
  openDotaProfileUrl?: string;
};

export type Team = {
  id: string;
  name: string;
  logoUrl?: string; // URL after upload
  players: Player[];
  matchesPlayed?: number;
  matchesWon?: number;
  matchesLost?: number;
  points?: number;
  mostPlayedHeroes?: string[];
};

export type Match = {
  id: string;
  teamA: Team;
  teamB: Team;
  teamAScore?: number;
  teamBScore?: number;
  dateTime: Date;
  status: 'upcoming' | 'live' | 'completed';
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
  rulesAgreed: boolean; // Form state before validation
};

// For server action state
export type RegistrationFormState = {
  message: string;
  errors?: z.ZodIssue[];
  success: boolean;
};
