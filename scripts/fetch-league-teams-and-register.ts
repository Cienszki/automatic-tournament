// Script: fetch-league-teams-and-register.ts
// Fetches teams and players from STRATZ and OpenDota for a league, deduplicates, and prepares registration payloads.
// Only registers 5 unique players per team (ignores standins).

import fetch from 'node-fetch';
import { registrationSchema } from '../src/lib/registration-schema';
import { PlayerRoles } from '../src/lib/definitions';

const LEAGUE_ID = 17296;
const STRATZ_API = `https://api.stratz.com/api/v1/League/${LEAGUE_ID}/matches`;
const OPENDOTA_MATCH_API = 'https://api.opendota.com/api/matches/';

async function fetchStratzMatches() {
  const headers: Record<string, string> = { 'User-Agent': 'STRATZ_API' };
  const apiKey = process.env.STRATZ_API_KEY;
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }
  const res = await fetch(STRATZ_API, { headers });
  if (!res.ok) throw new Error('Failed to fetch STRATZ matches');
  const matches = await res.json() as any[];
  // STRATZ returns an array of match objects with matchId
  return matches.map((m: any) => m.matchId);
}

async function fetchOpenDotaMatch(matchId: number) {
  const res = await fetch(`${OPENDOTA_MATCH_API}${matchId}`, {
    headers: { 'User-Agent': 'STRATZ_API' }
  });
  if (!res.ok) throw new Error(`Failed to fetch OpenDota match ${matchId}`);
  return res.json();
}

async function main() {
  const matchIds = await fetchStratzMatches();
  const teamMap: Record<string, any> = {};

  for (const matchId of matchIds) {
    let match: any;
    try {
      match = await fetchOpenDotaMatch(matchId) as any;
    } catch (e) {
      console.warn(`Skipping match ${matchId}:`, e);
      continue;
    }
    // Each match has radiant and dire teams
    for (const side of ['radiant', 'dire']) {
      const teamId = match[`${side}_team_id`];
      if (!teamId || teamId === 0) continue;
      if (!teamMap[teamId]) {
        teamMap[teamId] = {
          name: match[`${side}_name`] || `Team ${teamId}`,
          tag: (match[`${side}_name`] || `T${teamId}`).slice(0, 4).toUpperCase(),
          logoUrl: '', // OpenDota does not provide logo, can be filled later
          captainId: '', // Not available, can be filled later
          discordUsername: '', // Not available, can be filled later
          motto: '', // Not available, can be filled later
          players: {}, // Map of account_id to player info
        };
      }
      // Add players (deduplicate by account_id)
      for (const p of (match.players as any[])) {
        if (p.account_id && p.account_id !== 4294967295 && p.team_number === (side === 'radiant' ? 0 : 1)) {
          teamMap[teamId].players[p.account_id] = {
            nickname: p.personaname || `Player${p.account_id}`,
            role: '', // Role assignment is not available from OpenDota, can be filled later
            mmr: p.solo_competitive_rank || 3000, // Fallback if not available
            steamProfileUrl: `https://steamcommunity.com/profiles/${p.account_id + 76561197960265728}`,
            profileScreenshotUrl: '', // Not available
          };
        }
      }
    }
  }

  // Prepare registration payloads
  const registrations = [];
  for (const [teamId, team] of Object.entries(teamMap)) {
    // Only take 5 unique players (ignore standins)
    const playerList = Object.values(team.players as Record<string, any>).slice(0, 5) as any[];
    // Assign roles if possible, else fallback
    for (let i = 0; i < playerList.length; i++) {
      (playerList[i] as any).role = PlayerRoles[i] || 'Carry';
    }
    const payload = {
      name: team.name,
      tag: team.tag,
      discordUsername: team.discordUsername,
      motto: team.motto,
      logoUrl: team.logoUrl,
      captainId: '', // Not available
      players: playerList,
    };
    // Validate
    try {
      registrationSchema.parse(payload);
      registrations.push(payload);
    } catch (e) {
      console.warn(`Invalid registration for team ${team.name}:`, e);
    }
  }

  // Output or register
  console.log(JSON.stringify(registrations, null, 2));
  // Optionally, POST to your registerTeam endpoint here
}

main().catch(console.error);
