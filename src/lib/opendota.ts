// import fetch from 'node-fetch'; // Node.js-only: move to scripts/server if needed

/**
 * Request parsing for a match from the OpenDota API.
 * This will queue the match for parsing if the replay is still available.
 */
export async function requestOpenDotaMatchParse(matchId: number, apiKey?: string): Promise<{ success: boolean; jobId?: string; message?: string }> {
  let url = `${OPENDOTA_API_BASE_URL}/request/${matchId}`;
  if (apiKey || process.env.OPENDOTA_API_KEY) {
    const key = apiKey || process.env.OPENDOTA_API_KEY;
    url += (url.includes('?') ? '&' : '?') + 'api_key=' + key;
  }
  
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'User-Agent': 'OpenDota_API_Parse_Request'
      }
    });
    
    if (!res.ok) {
      const text = await res.text();
      return {
        success: false,
        message: `Failed to request parse: ${res.status} ${res.statusText} - ${text}`
      };
    }
    
    const result = await res.json();
    return {
      success: true,
      jobId: result.job?.jobId,
      message: 'Parse request submitted successfully'
    };
  } catch (error) {
    return {
      success: false,
      message: `Error requesting parse: ${(error as Error).message}`
    };
  }
}

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

/**
 * Determines if a match from OpenDota has been fully parsed.
 * Parsed matches contain detailed replay data, while unparsed matches only have basic WebAPI data.
 */
export function isMatchParsed(openDotaMatch: any): boolean {
  // Check version field - parsed matches have version >= 20
  if (openDotaMatch.version && openDotaMatch.version >= 20) {
    return true;
  }
  
  // Check if advanced player data is available (only in parsed matches)
  if (openDotaMatch.players && openDotaMatch.players.length > 0) {
    const firstPlayer = openDotaMatch.players[0];
    // These fields are only available in parsed matches
    const hasAdvancedData = 
      firstPlayer.gold_per_min !== null &&
      firstPlayer.gold_per_min !== undefined &&
      firstPlayer.xp_per_min !== null &&
      firstPlayer.xp_per_min !== undefined &&
      firstPlayer.last_hits !== null &&
      firstPlayer.last_hits !== undefined;
    
    return hasAdvancedData;
  }
  
  return false;
}

// ... (API fetching functions remain the same)

/**
 * Transforms raw OpenDota match data into application-specific Game and Performance data.
 *
 * @param openDotaMatch The raw match data from the OpenDota API.
 * @param teams A list of all tournament teams from your database.
 * @param players A list of all tournament players from your database.
 * @returns An object containing the transformed Game and an array of PlayerPerformanceInGame data.
 */
// Overloaded function signatures for backwards compatibility
export function transformMatchData(
  openDotaMatch: any,
  teams: Team[],
  players: Player[],
  isManualImport: boolean,
  existingTeamAssignments?: { radiant_team?: { id: string; name: string }, dire_team?: { id: string; name: string } }
): { game: Game; performances: PlayerPerformanceInGame[] };

export function transformMatchData(
  openDotaMatch: any,
  teams: Team[],
  players: Player[],
  options: {
    isManualImport?: boolean;
    existingTeamAssignments?: { radiant_team?: { id: string; name: string }, dire_team?: { id: string; name: string } };
    manualTeamMapping?: { radiant: { id: string; name: string }, dire: { id: string; name: string } };
    logPrefix?: string;
  }
): { gameData: Game; performances: PlayerPerformanceInGame[]; playerMappings?: Array<{ steamId32: string; playerName: string; tournamentPlayer: string; team: string }> };

export function transformMatchData(
  openDotaMatch: any,
  teams: Team[],
  players: Player[],
  optionsOrIsManualImport?: boolean | {
    isManualImport?: boolean;
    existingTeamAssignments?: { radiant_team?: { id: string; name: string }, dire_team?: { id: string; name: string } };
    manualTeamMapping?: { radiant: { id: string; name: string }, dire: { id: string; name: string } };
    logPrefix?: string;
  },
  existingTeamAssignments?: { radiant_team?: { id: string; name: string }, dire_team?: { id: string; name: string } }
): any {
  
  // Handle both calling patterns for backwards compatibility
  let options: {
    isManualImport?: boolean;
    existingTeamAssignments?: { radiant_team?: { id: string; name: string }, dire_team?: { id: string; name: string } };
    manualTeamMapping?: { radiant: { id: string; name: string }, dire: { id: string; name: string } };
    logPrefix?: string;
  };
  
  if (typeof optionsOrIsManualImport === 'boolean') {
    // Legacy calling pattern: (openDotaMatch, teams, players, isManualImport, existingTeamAssignments)
    options = {
      isManualImport: optionsOrIsManualImport,
      existingTeamAssignments: existingTeamAssignments,
      logPrefix: '[TransformMatch]'
    };
  } else {
    // New calling pattern: (openDotaMatch, teams, players, options)
    options = optionsOrIsManualImport || {};
  }
  
  const isManualImport = options.isManualImport || false;
  const existingTeamAssignmentsToUse = options.existingTeamAssignments;
  const manualTeamMapping = options.manualTeamMapping;
  const logPrefix = options.logPrefix || '[TransformMatch]';
  
  // Validate that we have essential match data
  if (!openDotaMatch) {
    throw new Error('OpenDota match data is required');
  }
  if (!openDotaMatch.match_id) {
    throw new Error('Match ID is missing from OpenDota data - this might be an invalid or corrupted match');
  }
  if (!openDotaMatch.players || !Array.isArray(openDotaMatch.players)) {
    throw new Error('Player data is missing from OpenDota match - this might be an incomplete or corrupted match');
  }
  if (typeof openDotaMatch.radiant_win !== 'boolean') {
    throw new Error('Match result (radiant_win) is missing from OpenDota data - this might be an incomplete match');
  }
  
  console.log(`${logPrefix} Transforming match ${openDotaMatch.match_id} (manual import: ${isManualImport}, parsed: ${isMatchParsed(openDotaMatch)})`);
  
  let radiantTeam: Team | undefined;
  let direTeam: Team | undefined;
  const playerMappings: Array<{ steamId32: string; playerName: string; tournamentPlayer: string; team: string }> = [];

  // Priority 1: Manual team mapping (for parsed replay uploads)
  if (manualTeamMapping?.radiant && manualTeamMapping?.dire) {
    console.log(`${logPrefix} Using manual team mapping: Radiant="${manualTeamMapping.radiant.name}" (${manualTeamMapping.radiant.id}), Dire="${manualTeamMapping.dire.name}" (${manualTeamMapping.dire.id})`);
    
    radiantTeam = teams.find(t => t.id === manualTeamMapping.radiant.id);
    direTeam = teams.find(t => t.id === manualTeamMapping.dire.id);
    
    if (!radiantTeam || !direTeam) {
      const missingTeams = [];
      if (!radiantTeam) missingTeams.push(`Radiant team ID: ${manualTeamMapping.radiant.id}`);
      if (!direTeam) missingTeams.push(`Dire team ID: ${manualTeamMapping.dire.id}`);
      const errorMsg = `Manual team mapping references non-existent teams: ${missingTeams.join(', ')}`;
      console.error(`${logPrefix} ${errorMsg}`);
      throw new Error(errorMsg);
    }
    
  } else if (existingTeamAssignmentsToUse?.radiant_team && existingTeamAssignmentsToUse?.dire_team) {
    // Priority 2: Existing team assignments (from database)
    console.log(`${logPrefix} Using existing team assignments: Radiant="${existingTeamAssignmentsToUse.radiant_team.name}" (${existingTeamAssignmentsToUse.radiant_team.id}), Dire="${existingTeamAssignmentsToUse.dire_team.name}" (${existingTeamAssignmentsToUse.dire_team.id})`);
    
    radiantTeam = teams.find(t => t.id === existingTeamAssignmentsToUse.radiant_team!.id);
    direTeam = teams.find(t => t.id === existingTeamAssignmentsToUse.dire_team!.id);
    
    if (!radiantTeam || !direTeam) {
      const missingTeams = [];
      if (!radiantTeam) missingTeams.push(`Radiant team ID: ${existingTeamAssignmentsToUse.radiant_team.id}`);
      if (!direTeam) missingTeams.push(`Dire team ID: ${existingTeamAssignmentsToUse.dire_team.id}`);
      const errorMsg = `Existing team assignments reference non-existent teams: ${missingTeams.join(', ')}`;
      console.error(`${logPrefix} ${errorMsg}`);
      throw new Error(errorMsg);
    }
    
  } else {
    // Priority 3: Fallback to original team matching logic
    console.log(`${logPrefix} No team assignments provided, attempting to match from OpenDota data...`);
    
    // Match only by name (case-insensitive, trimmed)
    function findTeam(_openDotaTeamId: number | undefined, name: string | undefined) {
      if (!name) return undefined;
      const normName = name.trim().toLowerCase();
      return teams.find(t => t.name.trim().toLowerCase() === normName);
    }

    if (isManualImport) {
      // For manual imports, teams are specified by ID in the OpenDota data
      console.log(`${logPrefix} Manual import: looking for team IDs radiant=${openDotaMatch.radiant_team?.team_id}, dire=${openDotaMatch.dire_team?.team_id}`);
      radiantTeam = teams.find(t => t.id === openDotaMatch.radiant_team?.team_id);
      direTeam = teams.find(t => t.id === openDotaMatch.dire_team?.team_id);
    } else {
      // For automatic imports, match by name
      console.log(`${logPrefix} Automatic import: looking for team names radiant="${openDotaMatch.radiant_name}", dire="${openDotaMatch.dire_name}"`);
      radiantTeam = findTeam(openDotaMatch.radiant_team?.team_id, openDotaMatch.radiant_name);
      direTeam = findTeam(openDotaMatch.dire_team?.team_id, openDotaMatch.dire_name);
    }

    if (!radiantTeam || !direTeam) {
      const missingTeams = [];
      if (!radiantTeam) {
        if (isManualImport) {
          missingTeams.push(`Radiant team ID: ${openDotaMatch.radiant_team?.team_id}`);
        } else {
          missingTeams.push(`Radiant: ${openDotaMatch.radiant_name}`);
        }
      }
      if (!direTeam) {
        if (isManualImport) {
          missingTeams.push(`Dire team ID: ${openDotaMatch.dire_team?.team_id}`);
        } else {
          missingTeams.push(`Dire: ${openDotaMatch.dire_name}`);
        }
      }
      const errorMsg = `Tournament teams not found in database: ${missingTeams.join(', ')}. This might be a scrim or practice game.`;
      console.error(`${logPrefix} ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }
  
  console.log(`${logPrefix} Final teams: Radiant="${radiantTeam.name}" (${radiantTeam.id}), Dire="${direTeam.name}" (${direTeam.id})`);

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

  // Helper: calculate fantasy points for a player (FINAL OPTIMIZED EQUALIZED SYSTEM)
  function calculateFantasyPoints(p: any, player: Player | undefined, isRadiant: boolean): number {
    let points = 0;
    const gameDurationMinutes = openDotaMatch.duration / 60;
    
    // === EXTRACT GAME DATA ===
    const role = player?.role || 'Unknown';
    const kills = p.kills || 0;
    const deaths = p.deaths || 0;
    const assists = p.assists || 0;
    const lastHits = p.last_hits || 0;
    const denies = p.denies || 0;
    const gpm = p.gold_per_min || 0;
    const xpm = p.xp_per_min || 0;
    const heroDamage = p.hero_damage || 0;
    const heroHealing = p.hero_healing || 0;
    const towerDamage = p.tower_damage || 0;
    const netWorth = p.net_worth || 0;
    const obsPlaced = p.obs_placed || 0;
    const senPlaced = p.sen_placed || 0;
    const playerWon = (isRadiant && openDotaMatch.radiant_win) || (!isRadiant && !openDotaMatch.radiant_win);
    const firstBloodClaimed = p.firstblood_claimed || false;
    const courierKills = p.courier_kills || 0;
    const observerKills = p.observer_kills || 0;
    const sentryKills = p.sentry_kills || 0;
    const highestKillStreak = p.kill_streaks ? Math.max(...Object.keys(p.kill_streaks).map(Number)) : Math.max(1, Math.floor(kills / 2.5));
    const buybackCount = netWorth > 25000 ? 1 : 0;

    // === UNIVERSAL BASE SCORING ===
    if (playerWon) points += 5;
    if (firstBloodClaimed) points += 12; 
    
    points += towerDamage / 1000; 
    points += (observerKills || 0) * 2.5;
    points += (courierKills || 0) * 10;
    points += (sentryKills || 0) * 2;
    
    if (highestKillStreak >= 3) {
        points += Math.pow(highestKillStreak - 2, 1.2) * 2.5;
    }
    
    const deathPenalty = deaths * -0.7; // Updated to match optimized algorithm
    points += deathPenalty;
    
    const netWorthPerMin = netWorth / gameDurationMinutes;
    if (netWorthPerMin > 350) {
        points += Math.sqrt(netWorthPerMin - 350) / 10;
    }
    
    // === OPTIMIZED ROLE-SPECIFIC SCORING ===
    
    if (role === 'Carry') {
        // Current: 94.4, Target: 100 → Need +6% boost
        points += kills * 2.5; // Increased from 2.4
        points += assists * 1.3; // Increased from 1.2
        
        const farmEfficiency = (gpm - 300) / 40; // More generous
        points += Math.max(farmEfficiency, 0);
        
        const lastHitBonus = lastHits / gameDurationMinutes / 5.5; // More generous
        points += lastHitBonus;
        
        points += (denies || 0) / 3.5; // More generous
        
        if (netWorth > 15000) {
            points += Math.sqrt(netWorth - 15000) / 110; // More generous
        }
        
        if (gameDurationMinutes > 38) {
            const lateGameMultiplier = 1 + (gameDurationMinutes - 38) / 140;
            points *= lateGameMultiplier;
        }
        
    } else if (role === 'Mid') {
        // Current: 79.2, Target: 100 → Need +26% boost (MAJOR BUFF)
        points += kills * 3.8; // MAJOR increase from 3.0
        points += assists * 2.0; // Increased from 1.6
        
        // Enhanced XP mastery (Mid's signature)
        const xpmBonus = Math.max(xpm - 400, 0) / 40; // More generous threshold
        points += xpmBonus;
        
        // Hero damage excellence (major buff)
        const heroDamagePerMin = heroDamage / gameDurationMinutes;
        points += heroDamagePerMin / 100; // Much more generous from /140
        
        // GPM efficiency for farming mids
        if (gpm > 480) { // Lower threshold
            points += (gpm - 480) / 50; // More generous
        }
        
        // Solo dominance bonus (enhanced)
        if (kills >= 7 && assists < kills) { // Lower threshold
            points += 12; // Increased from 8
        }
        
        // XP leadership bonus (enhanced)
        if (xpm > 600) {
            points += Math.sqrt(xpm - 600) / 12; // More generous
        }
        
        // NEW: Mid game impact bonus
        if (kills >= 10 || heroDamagePerMin > 600) {
            points += 8; // New bonus for high impact
        }
        
        // NEW: Last hit efficiency for farming mids
        if (lastHits >= gameDurationMinutes * 6) {
            points += (lastHits - gameDurationMinutes * 6) / 15; // Farming mid bonus
        }
        
    } else if (role === 'Offlane') {
        // Current: 84.0, Target: 100 → Need +19% boost (MAJOR BUFF)
        points += kills * 3.0; // MAJOR increase from 2.4
        points += assists * 2.8; // MAJOR increase from 2.2
        
        // Enhanced teamfight participation (signature offlane)
        const participationRate = (kills + assists) / Math.max((kills + assists + deaths), 1);
        points += participationRate * 18; // Increased from 14
        
        // Enhanced space creation
        const spaceCreationScore = (kills + assists) * 2.2 - deaths; // Increased multiplier
        if (spaceCreationScore > 8) { // Lower threshold
            points += Math.sqrt(spaceCreationScore - 8) * 2; // More generous
        }
        
        // Durability bonus (enhanced)
        if (deaths <= 6 && (kills + assists) >= 7) { // More forgiving thresholds
            points += 10; // Increased from 8
        }
        
        // Hero damage for fighting offlaners
        points += heroDamage / gameDurationMinutes / 200;
        
        // Initiation/teamfight bonus (enhanced)
        if (assists > kills && assists >= 10) { // Lower threshold
            points += assists * 0.4; // More generous
        }
        
        // NEW: High-assist performance bonus
        if (assists >= 15) {
            points += (assists - 15) * 0.5; // Additional scaling for exceptional teamfight
        }
        
        // NEW: Offlane survival bonus
        if ((kills + assists) >= 15 && deaths <= 8) {
            points += 8; // Reward surviving big teamfights
        }
        
    } else if (role === 'Soft Support') {
        // Current: 96.5, Target: 100 → Need +4% boost (minor)
        points += kills * 1.9; // Slightly increased from 1.8
        points += assists * 2.1; // Slightly increased from 2.0
        
        points += (obsPlaced || 0) * 2.1; // Slightly increased
        points += (senPlaced || 0) * 1.9; // Slightly increased
        
        const teamfightImpact = kills + assists;
        if (teamfightImpact >= 15) {
            points += Math.sqrt(teamfightImpact - 15) * 2.2; // Slightly increased
        }
        
        const supportEfficiency = (kills + assists) / Math.max(gpm / 100, 1);
        points += Math.min(supportEfficiency * 1.6, 12); // Slightly increased
        
        const wardEfficiency = (obsPlaced + senPlaced) / Math.max(gameDurationMinutes / 10, 1);
        if (wardEfficiency > 2) {
            points += (wardEfficiency - 2) * 5.5; // Slightly increased
        }
        
        if (kills >= 5 && gpm < 350) {
            points += kills * 1.6; // Slightly increased
        }
        
    } else if (role === 'Hard Support') {
        // Combat Contribution (Reduced)
        points += kills * 1.3;
        points += assists * 1.1;
        
        // Vision Control (Slightly Reduced)
        points += (obsPlaced || 0) * 2.0;
        points += (senPlaced || 0) * 1.8;
        
        // Healing Contribution (MAJOR NERF - Was Overpowered)
        points += (heroHealing || 0) / 150;
        
        // Sacrifice Play Recognition
        if (deaths >= 8 && assists >= 20) {
            points += 5;
        }
        
        // Vision Mastery
        if ((obsPlaced + senPlaced) >= 15) {
            points += 8;
        }
        
        // Support Excellence
        const supportExcellence = assists + obsPlaced + senPlaced + (heroHealing / 1500);
        if (supportExcellence > 30) {
            points += Math.sqrt(supportExcellence - 30) * 1.0;
        }
        
        // Buyback Dedication
        if (buybackCount && buybackCount > 0) {
            points += buybackCount * 4;
        }
        
        // Major Healing Bonus (Higher Threshold)
        if (heroHealing > 8000) {
            points += Math.sqrt(heroHealing - 8000) / 100;
        }
        
    } else {
        points += kills * 2.2;
        points += assists * 2.0;
    }
    
    // === DURATION NORMALIZATION ===
    const durationMultiplier = Math.min(gameDurationMinutes / 40, 1.25);
    points = points / durationMultiplier;
    
    // No floor - bad performances should be punished with negative scores 
    
    // === EXCELLENCE BONUSES ===
    const kda = deaths > 0 ? (kills + assists) / deaths : (kills + assists);
    if (kda >= 6) {
        points += Math.pow(kda - 6, 0.7) * 2;
    }
    
    let excellenceCount = 0;
    let excellenceBonus = 0;
    
    if (kills >= 12) { excellenceCount++; excellenceBonus += (kills - 12) * 0.8; }
    if (assists >= 18) { excellenceCount++; excellenceBonus += (assists - 18) * 0.3; }
    if (gpm >= 600) { excellenceCount++; excellenceBonus += (gpm - 600) / 80; }
    if (heroDamage >= gameDurationMinutes * 500) { excellenceCount++; excellenceBonus += 4; }
    if (lastHits >= gameDurationMinutes * 7) { excellenceCount++; excellenceBonus += 2; }
    if ((obsPlaced + senPlaced) >= 15) { excellenceCount++; excellenceBonus += 3; }
    
    if (excellenceCount >= 3) {
        points += excellenceBonus + (excellenceCount * 3);
    }
    
    if (deaths === 0 && kills >= 5 && assists >= 10) {
        points += 15;
    }
    
    return Math.round(points * 100) / 100;
  }
  
  // Helper function to calculate net worth difference
  function calculateNetWorthDifference(match: any, isRadiant: boolean): number {
    const radiantNW = match.players.filter((p: any) => p.player_slot < 128)
      .reduce((sum: number, p: any) => sum + (p.net_worth || 0), 0);
    const direNW = match.players.filter((p: any) => p.player_slot >= 128)
      .reduce((sum: number, p: any) => sum + (p.net_worth || 0), 0);
    return isRadiant ? radiantNW - direNW : direNW - radiantNW;
  }

  const performances: PlayerPerformanceInGame[] = openDotaMatch.players.map((p: any, index: number) => {
    // Match player by steamId32 (string) to OpenDota account_id (number)
    const player = players.find(pl => pl.steamId32 === String(p.account_id));
    const isRadiant = p.player_slot < 128;
    const isParsed = isMatchParsed(openDotaMatch);

    if (!player) {
      console.warn(`${logPrefix} Player with account_id ${p.account_id} not found in tournament players database - creating placeholder entry`);
    } else {
      // Add to player mappings for reference
      playerMappings.push({
        steamId32: String(p.account_id),
        playerName: p.personaname || 'Unknown',
        tournamentPlayer: player.nickname || 'Unknown',
        team: (isRadiant ? radiantTeam?.name : direTeam?.name) || 'Unknown'
      });
    }

    // Calculate highest kill streak
    let highestKillStreak = 0;
    if (p.kill_streaks) {
        for (const streak in p.kill_streaks) {
            if (parseInt(streak) > highestKillStreak) {
                highestKillStreak = parseInt(streak);
            }
        }
    } else {
        // Fallback for unparsed matches - estimate based on kills
        highestKillStreak = Math.max(1, Math.floor((p.kills || 0) / 2.5));
    }
    
    // Log missing fields for unparsed matches
    if (!isParsed) {
      const missingFields = [];
      if (!p.obs_placed && p.obs_placed !== 0) missingFields.push('obs_placed');
      if (!p.sen_placed && p.sen_placed !== 0) missingFields.push('sen_placed');
      if (!p.observer_kills && p.observer_kills !== 0) missingFields.push('observer_kills');
      if (!p.courier_kills && p.courier_kills !== 0) missingFields.push('courier_kills');
      if (!p.buyback_count && p.buyback_count !== 0) missingFields.push('buyback_count');
      if (!p.hero_healing && p.hero_healing !== 0) missingFields.push('hero_healing');
      
      if (missingFields.length > 0) {
        console.warn(`Unparsed match ${openDotaMatch.match_id} player ${p.account_id} missing fields: ${missingFields.join(', ')}`);
      }
    }
    
    const fantasyPoints = calculateFantasyPoints(p, player, isRadiant);
    
    console.log(`Player ${player?.id || p.account_id} (${isRadiant ? 'Radiant' : 'Dire'}): ${fantasyPoints.toFixed(2)} fantasy points`);
    
    return {
      playerId: player?.id || `unknown_${p.account_id}`,
      teamId: isRadiant ? radiantTeam.id : direTeam.id,
      heroId: p.hero_id,
      kills: p.kills || 0,
      deaths: p.deaths || 0,
      assists: p.assists || 0,
      gpm: p.gold_per_min || 0,
      xpm: p.xp_per_min || 0,
      lastHits: p.last_hits || 0,
      denies: p.denies || 0,
      netWorth: p.net_worth || 0,
      heroDamage: p.hero_damage || 0,
      towerDamage: p.tower_damage || 0,
      obsPlaced: p.obs_placed || 0,
      senPlaced: p.sen_placed || 0,
      courierKills: p.courier_kills || 0,
      firstBloodClaimed: p.firstblood_claimed || false,
      observerKills: p.observer_kills || 0,
      sentryKills: p.sentry_kills || 0,
      highestKillStreak: highestKillStreak,
      buybackCount: p.buyback_count || 0,
      heroHealing: p.hero_healing || 0,
      fantasyPoints: fantasyPoints,
      
      // Multikill data
      multiKills: p.multi_kills || {},
      doubleKills: (p.multi_kills && p.multi_kills['2']) || 0,
      tripleKills: (p.multi_kills && p.multi_kills['3']) || 0,
      ultraKills: (p.multi_kills && p.multi_kills['4']) || 0,
      rampages: (p.multi_kills && p.multi_kills['5']) || 0,
      
      // Additional stats
      roshanKills: p.roshans_killed || 0,
      towerKills: p.tower_kills || 0,
      neutralKills: p.neutral_kills || 0,
      laneKills: p.lane_kills || 0,
      heroKills: p.hero_kills || 0,
      totalGold: p.total_gold || 0,
      goldSpent: p.gold_spent || 0,
      runesPickedUp: (p.runes && Object.values(p.runes).reduce((sum: number, count) => sum + (count as number || 0), 0)) || 0,
      campsStacked: p.camps_stacked || 0,
    };
  });

  // Return different formats based on calling pattern for backwards compatibility
  if (typeof optionsOrIsManualImport === 'boolean') {
    // Legacy calling pattern expects { game, performances }
    return { game, performances };
  } else {
    // New calling pattern expects { gameData, performances, playerMappings }
    return { gameData: game, performances, playerMappings };
  }
}
