require('dotenv').config({ path: '.env.local' });
// Script: fetch-league-teams-and-register.js
// Fetches teams and players from STRATZ and OpenDota for a league, deduplicates, and prepares registration payloads.
// Only registers 5 unique players per team (ignores standins).

const fetch = require('node-fetch');
const { registrationSchema } = require('../src/lib/registration-schema');
const { PlayerRoles } = require('../src/lib/definitions');

const LEAGUE_ID = 17296;
const STRATZ_API = `https://api.stratz.com/api/v1/League/${LEAGUE_ID}/matches`;
const OPENDOTA_MATCH_API = 'https://api.opendota.com/api/matches/';

async function fetchStratzMatches() {
  const headers = { 'User-Agent': 'STRATZ_API' };
  const apiKey = process.env.STRATZ_API_KEY;
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }
  const res = await fetch(STRATZ_API, { headers });
  if (!res.ok) throw new Error('Failed to fetch STRATZ matches');
  const matches = await res.json();
  return matches.map(m => m.matchId);
}

async function fetchOpenDotaMatch(matchId) {
  const res = await fetch(`${OPENDOTA_MATCH_API}${matchId}`, {
    headers: { 'User-Agent': 'STRATZ_API' }
  });
  if (!res.ok) throw new Error(`Failed to fetch OpenDota match ${matchId}`);
  return res.json();
}

async function main() {
  const matchIds = await fetchStratzMatches();
  const teamMap = {};

  for (const matchId of matchIds) {
    let match;
    try {
      match = await fetchOpenDotaMatch(matchId);
    } catch (e) {
      console.warn(`Skipping match ${matchId}:`, e);
      continue;
    }
    for (const side of ['radiant', 'dire']) {
      const teamId = match[`${side}_team_id`];
      if (!teamId || teamId === 0) continue;
      if (!teamMap[teamId]) {
        teamMap[teamId] = {
          name: match[`${side}_name`] || `Team ${teamId}`,
          tag: (match[`${side}_name`] || `T${teamId}`).slice(0, 4).toUpperCase(),
          logoUrl: '',
          captainId: '',
          discordUsername: '',
          motto: '',
          players: {},
        };
      }
      for (const p of match.players) {
        if (p.account_id && p.account_id !== 4294967295 && p.team_number === (side === 'radiant' ? 0 : 1)) {
          teamMap[teamId].players[p.account_id] = {
            nickname: p.personaname || `Player${p.account_id}`,
            role: '',
            mmr: p.solo_competitive_rank || 3000,
            steamProfileUrl: `https://steamcommunity.com/profiles/${p.account_id + 76561197960265728}`,
            profileScreenshotUrl: '',
          };
        }
      }
    }
  }

  const registrations = [];
  for (const [teamId, team] of Object.entries(teamMap)) {
    const playerList = Object.values(team.players).slice(0, 5);
    for (let i = 0; i < playerList.length; i++) {
      playerList[i].role = PlayerRoles[i] || 'Carry';
    }
    const payload = {
      name: team.name,
      tag: team.tag,
      discordUsername: team.discordUsername,
      motto: team.motto,
      logoUrl: team.logoUrl,
      captainId: '',
      players: playerList,
    };
    try {
      registrationSchema.parse(payload);
      registrations.push(payload);
    } catch (e) {
      console.warn(`Invalid registration for team ${team.name}:`, e);
    }
  }

  console.log(JSON.stringify(registrations, null, 2));
}

main().catch(console.error);
