// scripts/fetch-player-league-matches.js
// Fetches recent matches for a player and filters by league ID

require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const PLAYER_ID = 35747920; // Steam32/OpenDota account ID

const OUTPUT_FILE = 'player_league_matches.json';
const API_KEY = process.env.OPENDOTA_API_KEY;
console.log('Using OpenDota API key:', API_KEY);

function withApiKey(url) {
  if (!API_KEY) return url;
  return url + (url.includes('?') ? '&' : '?') + 'api_key=' + API_KEY;
}

async function fetchPlayerMatches(playerId, limit = 20) {
  const url = withApiKey(`https://api.opendota.com/api/players/${playerId}/matches?limit=${limit}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch player matches');
  return res.json();
}

async function main() {
  try {
    const matches = await fetchPlayerMatches(PLAYER_ID, 100);
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(matches, null, 2));
    console.log(`Exported ${matches.length} matches for player ${PLAYER_ID} to ${OUTPUT_FILE}`);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

main();
