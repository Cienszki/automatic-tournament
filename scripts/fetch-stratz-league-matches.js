// scripts/fetch-stratz-league-matches.js
// Fetches all matches in a league from STRATZ API and saves to stratz_league_matches.json
// Usage: node scripts/fetch-stratz-league-matches.js <LEAGUE_ID>

require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const API_KEY = process.env.STRATZ_API_KEY;
const USER_AGENT = 'STRATZ_API';
const OUTPUT_FILE = 'stratz_league_matches.json';

if (!API_KEY) {
  console.error('No STRATZ_API_KEY found in .env.local');
  process.exit(1);
}

const LEAGUE_ID = process.argv[2];
if (!LEAGUE_ID) {
  console.error('Usage: node scripts/fetch-stratz-league-matches.js <LEAGUE_ID>');
  process.exit(1);
}

const PAGE_SIZE = 100;
const RATE_LIMIT_DELAY_MS = 3100; // 20 calls per minute = 1 call every 3 seconds

async function fetchLeagueMatches(leagueId) {
  // Clear the output file before fetching
  fs.writeFileSync(OUTPUT_FILE, '[]');

  let allMatches = [];
  let skip = 0;
  let hasMore = true;

  while (hasMore) {
    const query = `query($leagueId: Int!, $request: LeagueMatchesRequestType!) {
      league(id: $leagueId) {
        matches(request: $request) {
          id
          startDateTime
          durationSeconds
          radiantTeam { id name }
          direTeam { id name }
          players { steamAccountId heroId }
        }
      }
    }`;

    const variables = {
      leagueId: Number(leagueId),
      request: {
        take: PAGE_SIZE,
        skip: skip
      }
    };

    const res = await fetch('https://api.stratz.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'User-Agent': USER_AGENT
      },
      body: JSON.stringify({ query, variables })
    });

    if (!res.ok) {
      console.error('Failed to fetch from STRATZ:', await res.text());
      process.exit(1);
    }
    const data = await res.json();
    const matches = data.data?.league?.matches || [];
    allMatches = allMatches.concat(matches);
    console.log(`Fetched ${matches.length} matches (skip: ${skip})`);
    hasMore = matches.length === PAGE_SIZE;
    skip += PAGE_SIZE;
    if (hasMore) {
      await new Promise(res => setTimeout(res, RATE_LIMIT_DELAY_MS));
    }
  }
  return allMatches;
}

(async () => {
  const matches = await fetchLeagueMatches(LEAGUE_ID);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(matches, null, 2));
  console.log(`Saved ${matches.length} matches to ${OUTPUT_FILE}`);
})();
