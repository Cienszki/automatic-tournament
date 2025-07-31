// scripts/fetch-stratz-league-teams.js
// Fetches all matches for a STRATZ league and creates registration payloads for each team

require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const LEAGUE_ID = 17296;
const OUTPUT_FILE = 'registration_payloads.json';
const API_KEY = process.env.STRATZ_API_KEY;

if (!API_KEY) {
  console.error('Missing STRATZ_API_KEY in .env.local');
  process.exit(1);
}



async function fetchAllLeagueMatchesGraphQL(leagueId) {
  const url = 'https://api.stratz.com/graphql';
  const query = `query ($leagueId: Int!, $take: Int!, $skip: Int!) {
    league(id: $leagueId) {
      id
      name
      matches(request: { take: $take, skip: $skip }) {
        id
        radiantTeamId
        direTeamId
        radiantTeam { id name tag }
        direTeam { id name tag }
      }
    }
  }`;
  const take = 100;
  let skip = 0;
  let allMatches = [];
  while (true) {
    const body = JSON.stringify({
      query,
      variables: { leagueId, take, skip }
    });
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'User-Agent': 'STRATZ_API'
      },
      body
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to fetch matches: ${res.status} ${res.statusText}\n${text}`);
    }
    const data = await res.json();
    if (!data.data || !data.data.league) {
      console.error('Full API response:', JSON.stringify(data, null, 2));
      throw new Error('No league data returned');
    }
    if (!data.data.league.matches) {
      console.error('Full API response:', JSON.stringify(data, null, 2));
      throw new Error('No matches data returned');
    }
    const matches = data.data.league.matches;
    allMatches = allMatches.concat(matches);
    if (matches.length < take) break;
    skip += take;
  }
  return allMatches;
}

function extractTeamsFromMatches(matches) {
  const teams = {};
  for (const match of matches) {
    if (match.radiantTeam) {
      teams[match.radiantTeam.id] = match.radiantTeam;
    }
    if (match.direTeam) {
      teams[match.direTeam.id] = match.direTeam;
    }
  }
  return Object.values(teams);
}

function buildRegistrationPayloads(teams) {
  return teams.map(team => ({
    team_id: team.id,
    name: team.name,
    tag: team.tag || '',
    // Add more fields as needed
  }));
}

async function main() {
  try {
    console.log('Fetching matches for league', LEAGUE_ID);
    const matches = await fetchAllLeagueMatchesGraphQL(LEAGUE_ID);
    if (!matches || !Array.isArray(matches)) {
      console.error('No matches returned or matches is not an array.');
      return;
    }
    console.log(`Fetched ${matches.length} matches.`);
    const teams = extractTeamsFromMatches(matches);
    console.log(`Extracted ${teams.length} unique teams.`);
    const payloads = buildRegistrationPayloads(teams);
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(payloads, null, 2));
    console.log(`Saved registration payloads to ${OUTPUT_FILE}`);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

main();
