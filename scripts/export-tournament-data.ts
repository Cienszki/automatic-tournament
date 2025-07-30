// scripts/export-tournament-data.ts
// Node.js script to export all teams and players as JSON for easy copy-paste into registration form

import { getAllTeams } from '../src/lib/firestore';
import fs from 'fs';

async function main() {
  const teams = await getAllTeams();
  // Remove Firestore-specific fields and keep only registration-relevant data
  const exportTeams = teams.map(team => ({
    name: team.name,
    tag: team.tag,
    discordUsername: team.discordUsername,
    motto: team.motto,
    logoUrl: team.logoUrl,
    players: team.players.map(p => ({
      nickname: p.nickname,
      mmr: p.mmr,
      role: p.role,
      // No steamProfileUrl on Player, so just output steamId/steamId32 for reference
      steamId: p.steamId,
      steamId32: p.steamId32,
      // If you want to reconstruct the profile URL: `https://steamcommunity.com/profiles/${p.steamId}`
    }))
  }));
  fs.writeFileSync('tournament_teams_export.json', JSON.stringify(exportTeams, null, 2));
  console.log('Exported teams to tournament_teams_export.json');
}

main().catch(e => { console.error(e); process.exit(1); });
