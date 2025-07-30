// scripts/export-opendota-league-teams.js
// Node.js script to fetch teams and players from an OpenDota league and output as JSON for registration/testing

const fs = require('fs');
const fetch = require('node-fetch');

const LEAGUE_ID = 17366; // Ultras Dota Pro League 2024-25
const OUTPUT_FILE = 'opendota_league_teams.json';

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
    // Only take active/known players with a Steam ID
    const filteredPlayers = players.filter(p => p.is_current_team_member && p.account_id && p.name);
    exportTeams.push({
      name: team.name,
      tag: team.tag || '',
      logoUrl: team.logo_url || '',
      openDotaTeamId: team.team_id,
      players: filteredPlayers.map(p => ({
        nickname: p.name,
        steamId32: p.account_id.toString(),
        // You can reconstruct the profile URL: https://steamcommunity.com/profiles/ + (account_id + 76561197960265728)
      }))
    });
  }
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(exportTeams, null, 2));
  console.log(`Exported ${exportTeams.length} teams to ${OUTPUT_FILE}`);
}

main().catch(e => { console.error(e); process.exit(1); });
