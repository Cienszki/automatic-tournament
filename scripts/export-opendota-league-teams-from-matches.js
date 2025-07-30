// scripts/export-opendota-league-teams-from-matches.js
// Fetches all matches for a league, aggregates players per team from actual match data, and outputs registration-ready JSON


require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const LEAGUE_ID = 18129; // New league ID
const OUTPUT_FILE = 'opendota_league_teams_from_matches.json';
const API_KEY = process.env.OPENDOTA_API_KEY;
console.log('Using OpenDota API key:', API_KEY);
const MOTTO_LIST = [
  'Victory or nothing!', 'Unstoppable force.', 'Legends never die.', 'Born to win.',
  'One team, one dream.', 'Rise and shine.', 'No pain, no gain.', 'Play with honor.',
  'Defy the odds.', 'Chasing greatness.'
];

function randomMotto() { return MOTTO_LIST[Math.floor(Math.random() * MOTTO_LIST.length)]; }
function randomMMR() { return Math.floor(Math.random() * 2001) + 2000; }
function randomDiscord() { const user = Math.random().toString(36).substring(2, 8); const tag = Math.floor(Math.random() * 9000) + 1000; return `${user}#${tag}`; }
function randomCaptainId() { return 'uid_' + Math.random().toString(36).substring(2, 10); }



let apiCallCount = 0;
function withApiKey(url) {
  if (!API_KEY) return url;
  return url + (url.includes('?') ? '&' : '?') + 'api_key=' + API_KEY;
}

async function fetchAllMatches(leagueId) {
  const url = withApiKey(`https://api.opendota.com/api/leagues/${leagueId}/matches`);
  apiCallCount++;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch matches');
  return res.json();
}

async function fetchMatch(matchId) {
  const url = withApiKey(`https://api.opendota.com/api/matches/${matchId}`);
  apiCallCount++;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch match ' + matchId);
  return res.json();
}

async function main() {
  const matches = await fetchAllMatches(LEAGUE_ID);
  const teamMap = {};
  let processed = 0;
  for (const match of matches) {
    if (processed >= 10) break;
    if (!match.match_id) continue;
    let matchData;
    try {
      matchData = await fetchMatch(match.match_id);
    } catch (e) {
      console.error('Failed to fetch match', match.match_id, e.message);
      continue;
    }
    // Radiant
    if (matchData.radiant_team_id && matchData.radiant_name) {
      if (!teamMap[matchData.radiant_team_id]) {
        teamMap[matchData.radiant_team_id] = {
          name: matchData.radiant_name,
          tag: '',
          discordUsername: randomDiscord(),
          motto: randomMotto(),
          logoUrl: '',
          captainId: randomCaptainId(),
          players: {}
        };
      }
    }
    // Dire
    if (matchData.dire_team_id && matchData.dire_name) {
      if (!teamMap[matchData.dire_team_id]) {
        teamMap[matchData.dire_team_id] = {
          name: matchData.dire_name,
          tag: '',
          discordUsername: randomDiscord(),
          motto: randomMotto(),
          logoUrl: '',
          captainId: randomCaptainId(),
          players: {}
        };
      }
    }
    // Players
    for (const p of matchData.players || []) {
      if (!p.account_id || !p.name) continue;
      const teamId = p.isRadiant ? matchData.radiant_team_id : matchData.dire_team_id;
      if (!teamId || !teamMap[teamId]) continue;
      teamMap[teamId].players[p.account_id] = {
        nickname: p.name,
        mmr: randomMMR(),
        role: 'Carry', // Will assign unique roles below
        steamProfileUrl: `https://steamcommunity.com/profiles/${BigInt(p.account_id) + 76561197960265728n}`,
        steamId32: p.account_id.toString(),
        openDotaAccountId: p.account_id,
        profileScreenshot: null
      };
    }
    processed++;
  }
  console.log(`Total OpenDota API calls made: ${apiCallCount}`);
  // Finalize teams
  const exportTeams = [];
  for (const teamId in teamMap) {
    const team = teamMap[teamId];
    const playerArr = Object.values(team.players);
    // Assign unique roles to up to 5 players
    const ROLES = ['Carry', 'Mid', 'Offlane', 'Soft Support', 'Hard Support'];
    playerArr.slice(0, 5).forEach((p, idx) => p.role = ROLES[idx] || 'Carry');
    exportTeams.push({
      name: team.name,
      tag: team.tag,
      discordUsername: team.discordUsername,
      motto: team.motto,
      logoUrl: team.logoUrl,
      captainId: team.captainId,
      players: playerArr.slice(0, 5)
    });
  }
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(exportTeams, null, 2));
  console.log(`Exported ${exportTeams.length} teams to ${OUTPUT_FILE}`);
}

main().catch(e => { console.error(e); process.exit(1); });
