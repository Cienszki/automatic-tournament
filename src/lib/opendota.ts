// src/lib/opendota.ts

import {
  PlayerPerformanceInMatch,
  Match,
  Team,
  HeroPlayStats,
  Player,
} from './definitions';

const OPENDOTA_API_BASE_URL = 'https://api.opendota.com/api';

// --- Interfaces for OpenDota API responses ---

export interface OpenDotaLeagueMatch {
    match_id: number;
    start_time: number;
    leagueid: number;
    radiant_name: string;
    dire_name: string;
    radiant_win: boolean;
}

export interface OpenDotaMatch {
  match_id: number;
  radiant_win: boolean;
  duration: number;
  start_time: number;
  leagueid: number;
  radiant_team: OpenDotaTeam;
  dire_team: OpenDotaTeam;
  players: OpenDotaPlayer[];
  radiant_score: number;
  dire_score: number;
  patch: number;
  game_mode: number;
}

export interface OpenDotaPlayer {
  match_id: number;
  account_id: number;
  player_slot: number;
  hero_id: number;
  kills: number;
  deaths: number;
  assists: number;
  gold_per_min: number;
  xp_per_min: number;
  last_hits: number;
  denies: number;
  net_worth: number;
  hero_damage: number;
  tower_damage: number;
}

export interface OpenDotaTeam {
  team_id: number;
  name: string;
  tag: string;
  logo_url: string;
}

export interface OpenDotaHero {
    id: number;
    name: string;
    localized_name: string;
    primary_attr: string;
    attack_type: string;
    roles: string[];
}

export interface OpenDotaSearchedPlayer {
    account_id: number;
    personaname: string;
    avatarfull: string;
    similarity: number;
}


// --- API Fetching Functions ---

/**
 * Searches for a player by their name using the OpenDota API.
 * This is useful for resolving custom vanity URLs.
 * @param query The search query (player name).
 * @returns A promise that resolves to an array of matching players.
 */
export async function searchPlayer(query: string): Promise<OpenDotaSearchedPlayer[]> {
    try {
        const response = await fetch(`${OPENDOTA_API_BASE_URL}/search?q=${encodeURIComponent(query)}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Failed to search for player "${query}":`, error);
        throw error;
    }
}

/**
 * Fetches all matches for a specific league from the OpenDota API.
 * @param leagueId The ID of the league.
 * @returns A promise that resolves to an array of league matches.
 */
export async function getLeagueMatches(leagueId: number): Promise<OpenDotaLeagueMatch[]> {
    try {
        const response = await fetch(`${OPENDOTA_API_BASE_URL}/leagues/${leagueId}/matches`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Failed to fetch matches for league ID ${leagueId}:`, error);
        throw error;
    }
}


/**
 * Fetches hero constants from the OpenDota API.
 * @returns A promise that resolves to an array of hero data.
 */
export async function getHeroes(): Promise<OpenDotaHero[]> {
    try {
        const response = await fetch(`${OPENDOTA_API_BASE_URL}/heroes`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Failed to fetch heroes:', error);
        throw error;
    }
}


/**
 * Fetches detailed information for a specific match from the OpenDota API.
 * @param matchId The ID of the match to fetch.
 * @returns A promise that resolves to the raw match data from the API.
 */
export async function getMatchDetails(matchId: number): Promise<OpenDotaMatch> {
  try {
    const response = await fetch(`${OPENDOTA_API_BASE_URL}/matches/${matchId}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Failed to fetch match details for match ID ${matchId}:`, error);
    throw error;
  }
}

/**
 * Transforms raw OpenDota match data into application-specific data structures
 * using official OpenDota IDs for reliable mapping.
 *
 * @param openDotaMatch The raw match data from the OpenDota API.
 * @param teams A list of all tournament teams from your database.
 * @param players A list of all tournament players from your database.
 * @param heroes A list of all heroes from the OpenDota API.
 * @returns An object containing the transformed Match and PlayerPerformanceInMatch data.
 */
export function transformMatchData(
  openDotaMatch: OpenDotaMatch,
  teams: Team[],
  players: Player[],
  heroes: OpenDotaHero[]
): { match: Partial<Match>; performances: PlayerPerformanceInMatch[] } {
  
  // Find our internal teams by matching their openDotaTeamId with the API's team_id
  const teamA = teams.find(t => t.openDotaTeamId === openDotaMatch.radiant_team?.team_id);
  const teamB = teams.find(t => t.openDotaTeamId === openDotaMatch.dire_team?.team_id);

  if (!teamA || !teamB) {
      // If we can't find one of the teams in our database, we can't reliably assign stats.
      // You might want to handle this case differently, e.g., by logging a warning.
      throw new Error(`Could not find one or both teams in the database. Radiant Team ID: ${openDotaMatch.radiant_team?.team_id}, Dire Team ID: ${openDotaMatch.dire_team?.team_id}`);
  }

  const heroMap = new Map(heroes.map(h => [h.id, h.localized_name]));

  const match: Partial<Match> = {
    id: openDotaMatch.match_id.toString(),
    teamA: {
      id: teamA.id,
      name: teamA.name,
      score: openDotaMatch.radiant_score,
      logoUrl: teamA.logoUrl,
    },
    teamB: {
      id: teamB.id,
      name: teamB.name,
      score: openDotaMatch.dire_score,
      logoUrl: teamB.logoUrl,
    },
    teams: [teamA.id, teamB.id],
    dateTime: new Date(openDotaMatch.start_time * 1000).toISOString(),
    status: 'completed',
    openDotaMatchUrl: `https://www.opendota.com/matches/${openDotaMatch.match_id}`,
  };

  const performances: PlayerPerformanceInMatch[] = openDotaMatch.players.map(p => {
    // Find our internal player by matching their openDotaAccountId with the API's account_id
    const player = players.find(pl => pl.openDotaAccountId === p.account_id);

    if (!player) {
      // If a player from the match isn't in our database, we log a warning but continue.
      // The performance record will have a placeholder ID. You might want to handle stand-ins here.
      console.warn(`Player with OpenDota account ID ${p.account_id} not found in the database. They might be a stand-in.`);
    }

    const isRadiant = p.player_slot < 128;

    return {
      playerId: player?.id || `unknown_${p.account_id}`, // Use internal ID or a placeholder
      teamId: isRadiant ? teamA.id : teamB.id,
      hero: heroMap.get(p.hero_id) || 'Unknown Hero',
      kills: p.kills,
      deaths: p.deaths,
      assists: p.assists,
      gpm: p.gold_per_min,
      xpm: p.xp_per_min,
      fantasyPoints: 0, // This can be calculated later
      lastHits: p.last_hits,
      denies: p.denies,
      netWorth: p.net_worth,
      heroDamage: p.hero_damage,
      towerDamage: p.tower_damage,
    };
  });

  return { match, performances };
}
