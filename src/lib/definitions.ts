
import type { z } from "zod";
import type { LucideIcon } from "lucide-react";

export const TEAM_MMR_CAP = 30000;
export const FANTASY_BUDGET_MMR = 30000;

export const PlayerRoles = ["Carry", "Mid", "Offlane", "Soft Support", "Hard Support"] as const;
export type PlayerRole = typeof PlayerRoles[number];

export const TournamentStatuses = ["Not Verified", "Active", "Eliminated", "Champions"] as const;
export type TournamentStatus = typeof TournamentStatuses[number];

export type Player = {
  id: string;
  nickname: string;
  mmr: number;
  role: PlayerRole;
  steamProfileUrl: string;
  profileScreenshotUrl?: string;
  openDotaProfileUrl?: string;
  fantasyPointsEarned?: number;
};

export type TournamentPlayer = Player & {
    teamId: string;
    teamName: string;
    teamTag: string;
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
  tag: string;
  motto: string;
  logoUrl: string;
  captainId: string;
  players: Player[];
  status: TournamentStatus;
  standIns?: StandIn[];
  wins: number;
  losses: number;
  averageKillsPerGame?: number;
  averageDeathsPerGame?: number;
  averageAssistsPerGame?: number;
  averageFantasyPoints?: number;
  averageMatchDurationMinutes?: number;
  matchesPlayed?: number;
  mostPlayedHeroes?: HeroPlayStats[];
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
  teamA: { id: string, name: string, score: number, logoUrl?: string };
  teamB: { id: string, name: string, score: number, logoUrl?: string };
  teams: string[];
  dateTime: string;
  status: 'upcoming' | 'live' | 'completed';
  openDotaMatchUrl?: string;
  playerPerformances?: PlayerPerformanceInMatch[];
  round?: string;
};

export type Group = {
  id: string;
  name: string;
  teams: Team[];
};

export type PlayoffData = {
    rounds: {
        name: string;
        matches: Match[];
    }[];
};

export type FantasyLineup = {
  [key in PlayerRole]?: TournamentPlayer;
};

export type FantasyData = {
    userId: string;
    participantName: string;
    totalFantasyPoints: number;
    currentLineup: FantasyLineup;
    roundId: string;
    lastUpdated: Date;
};

export type PickemPrediction = {
    userId: string;
    predictions: { [key: string]: string[] };
    lastUpdated: Date;
};
