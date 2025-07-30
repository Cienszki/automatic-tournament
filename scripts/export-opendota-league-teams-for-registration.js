// scripts/export-opendota-league-teams-for-registration.js
// Node.js script to fetch teams and players from an OpenDota league and output as JSON for registration/testing
// Includes: random team motto, random player MMR (<=4000), fake Discord/captain IDs, and full Steam URLs

const fs = require('fs');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const LEAGUE_ID = 17366; // Ultras Dota Pro League 2024-25
const OUTPUT_FILE = 'opendota_league_teams_for_registration.json';

const MOTTO_LIST = [
  'Victory or nothing!',
  'Unstoppable force.',
  'Legends never die.',
  'Born to win.',
  'One team, one dream.',
  'Rise and shine.',
  'No pain, no gain.',
  'Play with honor.',
  'Defy the odds.',
  'Chasing greatness.'
];

function randomMotto() {
  return MOTTO_LIST[Math.floor(Math.random() * MOTTO_LIST.length)];
}

function randomMMR() {
  // 2000-4000 MMR, realistic amateur range
  return Math.floor(Math.random() * 2001) + 2000;
}

function randomDiscord() {
  // Fake Discord: user#1234
  const user = Math.random().toString(36).substring(2, 8);
  const tag = Math.floor(Math.random() * 9000) + 1000;
  return `${user}#${tag}`;
}

function randomCaptainId() {
  // Fake UID: uid_xxxxx
  return 'uid_' + Math.random().toString(36).substring(2, 10);
}

async function fetchTeams(leagueId) {
  const url = `https://api.opendota.com/api/leagues/${leagueId}/teams`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch teams');
  return res.json();
}

async function fetchPlayers(teamId) {
  const url = `https://api.opendota.com/api/teams/${teamId}/players`;
  const res = await fetch(url);
  if (!res.ok) return [];
  return res.json();
}

async function main() {
  const teams = await fetchTeams(LEAGUE_ID);
  const exportTeams = [];
  for (const team of teams) {
    if (!team.team_id || !team.name) continue;
    const players = await fetchPlayers(team.team_id);
    const filteredPlayers = players.filter(p => p.account_id && p.name);
    console.log(`Team: ${team.name} (${team.team_id}) - Players found: ${filteredPlayers.length}`);
    if (filteredPlayers.length === 0) continue; // Only export teams with at least 1 player
    const captainId = randomCaptainId();
    exportTeams.push({
      name: team.name,
      tag: team.tag || '',
      discordUsername: randomDiscord(),
      motto: randomMotto(),
      logoUrl: team.logo_url || '',
      captainId,
      players: filteredPlayers.slice(0, 5).map((p, idx) => {
        const steamId64 = (BigInt(p.account_id) + 76561197960265728n).toString();
        return {
          nickname: p.name,
          mmr: randomMMR(),
          role: ['Carry', 'Mid', 'Offlane', 'Soft Support', 'Hard Support'][idx] || 'Carry',
          steamProfileUrl: `https://steamcommunity.com/profiles/${steamId64}`,
          steamId32: p.account_id.toString(),
          openDotaAccountId: p.account_id,
          profileScreenshot: null
        };
      })
    });
  }
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(exportTeams, null, 2));
  console.log(`Exported ${exportTeams.length} teams to ${OUTPUT_FILE}`);
}

main().catch(e => { console.error(e); process.exit(1); });
