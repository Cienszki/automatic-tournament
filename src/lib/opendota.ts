// import fetch from 'node-fetch'; // Node.js-only: move to scripts/server if needed

/**
 * Fetch a match from the OpenDota API.
 */
export async function fetchOpenDotaMatch(matchId: number, apiKey?: string): Promise<any> {
  let url = `${OPENDOTA_API_BASE_URL}/matches/${matchId}`;
  if (apiKey || process.env.OPENDOTA_API_KEY) {
    const key = apiKey || process.env.OPENDOTA_API_KEY;
    url += (url.includes('?') ? '&' : '?') + 'api_key=' + key;
  }
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'OpenDota_API_Fetch'
    }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch OpenDota match: ${res.status} ${res.statusText}\n${text}`);
  }
  return res.json();
}
// src/lib/opendota.ts

import {
  PlayerPerformanceInGame,
  Game,
  Team,
  Player
} from './definitions';
// import { promises as fs } from 'fs'; // Node.js-only: move to scripts/server if needed
// import path from 'path'; // Node.js-only: move to scripts/server if needed

const OPENDOTA_API_BASE_URL = 'https://api.opendota.com/api';

// ... (API fetching functions remain the same)

/**
 * Transforms raw OpenDota match data into application-specific Game and Performance data.
 *
 * @param openDotaMatch The raw match data from the OpenDota API.
 * @param teams A list of all tournament teams from your database.
 * @param players A list of all tournament players from your database.
 * @returns An object containing the transformed Game and an array of PlayerPerformanceInGame data.
 */
export function transformMatchData(
  openDotaMatch: any,
  teams: Team[],
  players: Player[]
): { game: Game; performances: PlayerPerformanceInGame[] } {
  
  // Match only by name (case-insensitive, trimmed)
  function findTeam(_openDotaTeamId: number | undefined, name: string | undefined) {
    if (!name) return undefined;
    const normName = name.trim().toLowerCase();
    return teams.find(t => t.name.trim().toLowerCase() === normName);
  }

  const radiantTeam = findTeam(openDotaMatch.radiant_team?.team_id, openDotaMatch.radiant_name);
  const direTeam = findTeam(openDotaMatch.dire_team?.team_id, openDotaMatch.dire_name);

  if (!radiantTeam || !direTeam) {
    const missingTeams = [];
    if (!radiantTeam) missingTeams.push(`Radiant: ${openDotaMatch.radiant_name}`);
    if (!direTeam) missingTeams.push(`Dire: ${openDotaMatch.dire_name}`);
    throw new Error(`Tournament teams not found in database: ${missingTeams.join(', ')}. This might be a scrim or practice game.`);
  }

  const game: Game = {
    id: openDotaMatch.match_id.toString(),
    radiant_win: openDotaMatch.radiant_win,
    duration: openDotaMatch.duration,
    start_time: openDotaMatch.start_time,
    firstBloodTime: openDotaMatch.first_blood_time,
    picksBans: openDotaMatch.picks_bans || [],
    radiant_team: { id: radiantTeam.id, name: radiantTeam.name },
    dire_team: { id: direTeam.id, name: direTeam.name },
  };

  // Helper: calculate fantasy points for a player
  function calculateFantasyPoints(p: any, player: Player | undefined, isRadiant: boolean): number {
    // General scoring
    let points = 0;
    // Roshan kills (team stat)
    if (openDotaMatch.roshan_kills) {
      // Distribute Roshan kills to all players on the team
      const teamRoshanKills = isRadiant ? openDotaMatch.radiant_roshan_kills : openDotaMatch.dire_roshan_kills;
      points += (teamRoshanKills || 0) * 20;
    }
    // Team win
    const teamWon = (isRadiant && openDotaMatch.radiant_win) || (!isRadiant && !openDotaMatch.radiant_win);
    if (teamWon) points += 10;
    // Barracks destroyed
    if (p.barracks_killed) {
      // OpenDota does not provide per-player barracks, so skip or use team total if available
    }
    // Use team barracks destroyed if available
    if (isRadiant && openDotaMatch.radiant_barracks_status !== undefined) {
      // Each bit represents a barracks, 6 total (melee/range pairs)
      const barracks = openDotaMatch.radiant_barracks_status;
      const destroyed = 6 - barracks.toString(2).replace(/0/g, '').length;
      points += destroyed * 10;
    }
    if (!isRadiant && openDotaMatch.dire_barracks_status !== undefined) {
      const barracks = openDotaMatch.dire_barracks_status;
      const destroyed = 6 - barracks.toString(2).replace(/0/g, '').length;
      points += destroyed * 10;
    }
    // Towers destroyed (team stat, not per player)
    if (isRadiant && openDotaMatch.radiant_tower_status !== undefined) {
      const towers = openDotaMatch.radiant_tower_status;
      const destroyed = 11 - towers.toString(2).replace(/0/g, '').length;
      points += destroyed * 10;
    }
    if (!isRadiant && openDotaMatch.dire_tower_status !== undefined) {
      const towers = openDotaMatch.dire_tower_status;
      const destroyed = 11 - towers.toString(2).replace(/0/g, '').length;
      points += destroyed * 10;
    }

    // Role-specific scoring
    const role = player?.role;
    if (role === 'Carry') {
      points += (p.kills || 0) * 2.5;
      points += (p.deaths || 0) * -2.5;
      points += (p.gold || 0) / 1000 * 1;
    } else if (role === 'Mid') {
      points += (p.kills || 0) * 2.5;
      points += (p.deaths || 0) * -1.5;
      points += (p.assists || 0) * 1.5;
    } else if (role === 'Offlane') {
      points += (p.kills || 0) * 2.5;
      points += (p.deaths || 0) * -1.5;
      points += (p.assists || 0) * 2.5;
    } else if (role === 'Soft Support') {
      points += (p.kills || 0) * 1;
      points += (p.deaths || 0) * -2.5;
      points += (p.assists || 0) * 3;
    } else if (role === 'Hard Support') {
      points += (p.kills || 0) * 1;
      points += (p.deaths || 0) * -2.5;
      points += (p.assists || 0) * 5;
    }
    return points;
  }

  const performances: PlayerPerformanceInGame[] = openDotaMatch.players.map((p: any) => {
    // Match player by steamId32 (string) to OpenDota account_id (number)
    const player = players.find(pl => pl.steamId32 === String(p.account_id));
    const isRadiant = p.player_slot < 128;

    // Calculate highest kill streak
    let highestKillStreak = 0;
    if (p.kill_streaks) {
        for (const streak in p.kill_streaks) {
            if (parseInt(streak) > highestKillStreak) {
                highestKillStreak = parseInt(streak);
            }
        }
    }
    
    return {
      playerId: player?.id || `unknown_${p.account_id}`,
      teamId: isRadiant ? radiantTeam.id : direTeam.id,
      heroId: p.hero_id,
      kills: p.kills,
      deaths: p.deaths,
      assists: p.assists,
      gpm: p.gold_per_min,
      xpm: p.xp_per_min,
      lastHits: p.last_hits,
      denies: p.denies,
      netWorth: p.net_worth,
      heroDamage: p.hero_damage,
      towerDamage: p.tower_damage,
      obsPlaced: p.obs_placed || 0,
      senPlaced: p.sen_placed || 0,
      courierKills: p.courier_kills || 0,
      firstBloodClaimed: p.firstblood_claimed || false,
      observerKills: p.observer_kills || 0,
      sentryKills: p.sentry_kills || 0,
      highestKillStreak: highestKillStreak,
      buybackCount: p.buyback_count || 0,
      heroHealing: p.hero_healing || 0,
      fantasyPoints: calculateFantasyPoints(p, player, isRadiant),
    };
  });

  return { game, performances };
}
