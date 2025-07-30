// scripts/fetch-match-players.js
// Fetches all player IDs and their heroes for a given match and writes to match_players.json

require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const MATCH_ID = 8393517949;
const OUTPUT_FILE = 'match_players.json';
const API_KEY = process.env.OPENDOTA_API_KEY;
console.log('Using OpenDota API key:', API_KEY);

function withApiKey(url) {
  if (!API_KEY) return url;
  return url + (url.includes('?') ? '&' : '?') + 'api_key=' + API_KEY;
}

async function fetchMatchDetails(matchId) {
  const url = withApiKey(`https://api.opendota.com/api/matches/${matchId}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch match details');
  return res.json();
}

async function main() {
  try {
    const match = await fetchMatchDetails(MATCH_ID);
    const players = match.players.map(p => ({
      account_id: p.account_id,
      hero_id: p.hero_id
    }));
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(players, null, 2));
    console.log(`Exported player IDs and heroes for match ${MATCH_ID} to ${OUTPUT_FILE}`);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

main();
