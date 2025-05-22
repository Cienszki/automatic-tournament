
import type { z } from "zod";

export type Player = {
  id: string;
  nickname: string;
  mmr: number;
  profileScreenshotUrl?: string; // URL after upload
  steamProfileUrl: string;
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

// For registration form
export type PlayerFormData = {
  nickname: string;
  mmr: string; // string for form input, convert to number later
  profileScreenshot?: FileList;
  steamProfileUrl: string;
};

export type TeamRegistrationFormData = {
  teamName: string;
  teamLogo?: FileList;
  player1: PlayerFormData;
  player2: PlayerFormData;
  player3: PlayerFormData;
  player4: PlayerFormData;
  player5: PlayerFormData;
};

// For server action state
export type RegistrationFormState = {
  message: string;
  errors?: z.ZodIssue[];
  success: boolean;
};
