// src/lib/stats-types.ts
// Shared type definitions for stats calculation to eliminate `any` usage

/**
 * Represents a team reference in a match document
 */
export interface MatchTeamRef {
  id: string;
  name: string;
  logoUrl?: string;
  tag?: string;
}

/**
 * Represents a match document from Firestore
 */
export interface MatchDocument {
  id: string;
  status?: string;
  teamA: MatchTeamRef;
  teamB: MatchTeamRef;
  scheduledDate?: string;
  result?: {
    winnerId?: string;
    scoreA?: number;
    scoreB?: number;
  };
}

/**
 * Represents a game (single map) within a match, enriched with parent match data
 */
export interface GameData {
  id: string;
  matchId: string;
  match?: MatchDocument;
  duration: number;
  start_time?: number;
  radiant_score?: number;
  dire_score?: number;
  radiant_win?: boolean;
  radiantTeamId?: string;
  direTeamId?: string;
  // Fallback team references (when match is not nested)
  teamA?: MatchTeamRef;
  teamB?: MatchTeamRef;
  picks_bans?: Array<{
    is_pick: boolean;
    hero_id: number;
    team: number; // 0 = radiant, 1 = dire
  }>;
  // Additional OpenDota fields
  first_blood_time?: number;
  barracks_status_radiant?: number;
  barracks_status_dire?: number;
  tower_status_radiant?: number;
  tower_status_dire?: number;
}

/**
 * Represents a player performance in a single game
 */
export interface PerformanceData {
  gameId: string;
  matchId: string;
  playerId: string;
  playerName?: string;
  teamId?: string;
  heroId?: number;
  heroName?: string;
  isRadiant?: boolean;
  win?: boolean;

  // Core stats
  kills: number;
  deaths: number;
  assists: number;
  lastHits?: number;
  denies?: number;
  gpm?: number;
  xpm?: number;

  // Economy
  totalGold?: number;
  netWorth?: number;
  goldSpent?: number;
  goldFromKills?: number;
  goldFromCreeps?: number;

  // Damage & Healing
  heroDamage?: number;
  heroHealing?: number;
  towerDamage?: number;
  damageTaken?: number;
  damagePerDeath?: number;

  // Vision
  obsPlaced?: number;
  senPlaced?: number;
  observerKills?: number;
  sentryKills?: number;
  totalWardKills?: number;
  wardEfficiency?: number;

  // Farming
  neutralKills?: number;
  ancientKills?: number;
  campsStacked?: number;
  jungleFarmPerMin?: number;
  lastHitEfficiency?: number;

  // Multi-kills
  doubleKills?: number;
  tripleKills?: number;
  ultraKills?: number;
  rampages?: number;
  highestKillStreak?: number;

  // Advanced
  actionsPerMin?: number;
  abilityUses?: number;
  itemUses?: number;
  stuns?: number;
  runes?: number;
  runesPickedUp?: number;
  tpScrollUses?: number;
  buybackCount?: number;
  courierKills?: number;
  roshanKills?: number;
  towerKills?: number;
  survivalTime?: number;
  timeDead?: number;
  firstBloodClaimed?: boolean;
  fantasyPoints?: number;
  duration?: number; // denormalized game duration for performance context

  // Timing milestones
  level6Time?: number;
  level18Time?: number;
  midasTime?: number;
}

/**
 * Simplified team data for stats calculation
 */
export interface TeamData {
  id: string;
  name: string;
  tag?: string;
  logoUrl?: string;
  captainId?: string;
  status?: string;
}

/**
 * Simplified player data for stats calculation
 */
export interface PlayerData {
  id: string;
  nickname: string;
  steamId?: string;
  steamId32?: string;
  role?: string;
  mmr?: number;
  teamId: string;
  teamName?: string;
}
