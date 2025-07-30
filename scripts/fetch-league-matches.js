// scripts/fetch-league-matches.js
// Fetches all matches for a given league ID and outputs them to a JSON file

require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const LEAGUE_ID = 17296; // Change this to your desired league ID
const OUTPUT_FILE = 'opendota_league_matches.json';
const API_KEY = process.env.OPENDOTA_API_KEY;
console.log('Using OpenDota API key:', API_KEY);

function withApiKey(url) {
  if (!API_KEY) return url;
  return url + (url.includes('?') ? '&' : '?') + 'api_key=' + API_KEY;
}

async function fetchAllMatches(leagueId) {
  const url = withApiKey(`https://api.opendota.com/api/leagues/${leagueId}/matches`);
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch matches');
  return res.json();
}

async function main() {
  try {
    const matches = await fetchAllMatches(LEAGUE_ID);
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(matches, null, 2));
    console.log(`Exported ${matches.length} matches to ${OUTPUT_FILE}`);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

main();
