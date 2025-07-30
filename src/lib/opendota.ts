// src/lib/opendota.ts

import {
  PlayerPerformanceInGame,
  Game,
  Team,
  Player,
  OpenDotaMatch,
  OpenDotaHero,
  OpenDotaLeagueMatch,
  OpenDotaSearchedPlayer
} from './definitions';
import { promises as fs } from 'fs';
import path from 'path';

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
  openDotaMatch: OpenDotaMatch,
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
    throw new Error(`Could not find one or both teams in the database. Radiant: ${openDotaMatch.radiant_team?.team_id} / ${openDotaMatch.radiant_name}, Dire: ${openDotaMatch.dire_team?.team_id} / ${openDotaMatch.dire_name}`);
  }

  const game: Game = {
    id: openDotaMatch.match_id.toString(),
    radiant_win: openDotaMatch.radiant_win,
    duration: openDotaMatch.duration,
    start_time: openDotaMatch.start_time,
    firstBloodTime: openDotaMatch.first_blood_time,
    picksBans: openDotaMatch.picks_bans || [],
  };

  const performances: PlayerPerformanceInGame[] = openDotaMatch.players.map(p => {
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
      fantasyPoints: 0, // This will be calculated by a separate function
    };
  });

  return { game, performances };
}
