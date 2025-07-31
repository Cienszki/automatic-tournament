// scripts/generate-registration-payloads.js
// Generates registration payloads for all teams in a STRATZ league using STRATZ and OpenDota APIs

require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// Allow LEAGUE_ID to be set via env or CLI
const LEAGUE_ID = process.env.LEAGUE_ID ? Number(process.env.LEAGUE_ID) : (process.argv[2] ? Number(process.argv[2]) : 17296);
const OUTPUT_FILE = 'registration_payloads.json';
const STRATZ_API_KEY = process.env.STRATZ_API_KEY;
const OPENDOTA_API_KEY = process.env.OPENDOTA_API_KEY;

if (!STRATZ_API_KEY) throw new Error('Missing STRATZ_API_KEY in .env.local');

async function fetchAllLeagueMatchesStratz(leagueId) {
  const url = 'https://api.stratz.com/graphql';
  const query = `query ($leagueId: Int!, $take: Int!, $skip: Int!) {
    league(id: $leagueId) {
      matches(request: { take: $take, skip: $skip }) {
        id
        radiantTeamId
        direTeamId
        radiantTeam { id name tag }
        direTeam { id name tag }
        players { steamAccountId }
      }
    }
  }`;
  const take = 100;
  let skip = 0;
  let allMatches = [];
  while (true) {
    const body = JSON.stringify({ query, variables: { leagueId, take, skip } });
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${STRATZ_API_KEY}`,
        'User-Agent': 'STRATZ_API'
      },
      body
    });
    let data;
    try {
      data = await res.json();
    } catch (e) {
      throw new Error(`STRATZ fetch error: ${res.status} (invalid JSON)`);
    }
    if (!res.ok || data.errors) {
      console.error('STRATZ API error response:', JSON.stringify(data, null, 2));
      throw new Error(`STRATZ fetch error: ${res.status} - ${data.errors ? data.errors.map(e => e.message).join('; ') : 'Unknown error'}`);
    }
    const matches = data.data?.league?.matches || [];
    allMatches = allMatches.concat(matches);
    if (matches.length < take) break;
    skip += take;
  }
  return allMatches;
}

async function fetchOpenDotaPlayerInfo(accountId) {
  if (!accountId || isNaN(accountId)) {
    return {
      nickname: `player_${accountId}`,
      mmr: 4000,
      steamProfileUrl: 'unknown',
      profileScreenshotUrl: 'https://placehold.co/200x200?text=unknown'
    };
  }
  const url = `https://api.opendota.com/api/players/${accountId}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('OpenDota fetch error');
    const data = await res.json();
    const steam64 = Number(accountId) + 76561197960265728;
    return {
      nickname: data.profile?.personaname || `player_${accountId}`,
      mmr: data.mmr_estimate?.estimate || 4000,
      steamProfileUrl: data.profile?.profileurl || `https://steamcommunity.com/profiles/${steam64}`,
      profileScreenshotUrl: data.profile?.avatarfull || `https://placehold.co/200x200?text=${data.profile?.personaname || accountId}`
    };
  } catch (e) {
    const steam64 = Number(accountId) + 76561197960265728;
    return {
      nickname: `player_${accountId}`,
      mmr: 4000,
      steamProfileUrl: `https://steamcommunity.com/profiles/${steam64}`,
      profileScreenshotUrl: `https://placehold.co/200x200?text=${accountId}`
    };
  }
}

function getTeamPlayersFromMatches(teamId, matches) {
  // Find all players for this team from matches
  // Map: accountId -> { count, nickname }
  const playerStats = {};
  for (const match of matches) {
    let side = null;
    if (match.radiantTeamId === teamId) side = 'radiant';
    if (match.direTeamId === teamId) side = 'dire';
    if (!side) continue;
    for (const p of match.players || []) {
      if (!p.steamAccountId) continue;
      if (!playerStats[p.steamAccountId]) playerStats[p.steamAccountId] = { count: 0 };
      playerStats[p.steamAccountId].count++;
    }
  }
  // Get top 5 most frequent players, preserving nickname
  return Object.entries(playerStats)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([steamAccountId, info]) => ({ accountId: Number(steamAccountId), nickname: info.nickname }));
}

async function main() {
  console.log(`Fetching all matches from STRATZ for league ID: ${LEAGUE_ID}...`);
  const matches = await fetchAllLeagueMatchesStratz(LEAGUE_ID);
  // Get all unique teams
  const teams = {};
  for (const match of matches) {
    if (match.radiantTeamId) teams[match.radiantTeamId] = true;
    if (match.direTeamId) teams[match.direTeamId] = true;
  }
  // Build a map: teamId -> { name, tag }
  const teamMeta = {};
  for (const match of matches) {
    if (match.radiantTeam && match.radiantTeam.id) {
      teamMeta[match.radiantTeam.id] = {
        name: match.radiantTeam.name || `Team${match.radiantTeam.id}`,
        tag: match.radiantTeam.tag || `T${String(match.radiantTeam.id).slice(-3)}`
      };
    }
    if (match.direTeam && match.direTeam.id) {
      teamMeta[match.direTeam.id] = {
        name: match.direTeam.name || `Team${match.direTeam.id}`,
        tag: match.direTeam.tag || `T${String(match.direTeam.id).slice(-3)}`
      };
    }
  }
  const teamIds = Object.keys(teams).map(Number);
  const payloads = [];
  const roleOrder = ['Carry', 'Mid', 'Offlane', 'Soft Support', 'Hard Support'];
  for (const teamId of teamIds) {
    const playerInfos = getTeamPlayersFromMatches(teamId, matches);
    const players = [];
    for (let i = 0; i < 5; i++) {
      const info = playerInfos[i] || { accountId: 100000 + i + teamId };
      const playerData = await fetchOpenDotaPlayerInfo(info.accountId);
      players.push({
        nickname: playerData.nickname,
        role: roleOrder[i],
        mmr: playerData.mmr,
        steamProfileUrl: playerData.steamProfileUrl,
        profileScreenshotUrl: playerData.profileScreenshotUrl
      });
    }
    const meta = teamMeta[teamId] || { name: `Team${teamId}`, tag: `T${String(teamId).slice(-3)}` };
    const captain = players[0];
    payloads.push({
      name: meta.name,
      tag: meta.tag,
      discordUsername: `captain${teamId}#1234`,
      motto: `Motto for team ${teamId}`,
      logoUrl: `https://placehold.co/200x200?text=${encodeURIComponent(meta.name)}`,
      captainId: captain.nickname,
      players
    });
  }
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(payloads, null, 2));
  console.log(`Saved registration payloads to ${OUTPUT_FILE}`);
}

main();
