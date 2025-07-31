// Script: fetch-stratz-matches.ts
// Fetches matches from STRATZ API and saves the output to a file.
import fetch from 'node-fetch';
import * as fs from 'fs';

const LEAGUE_ID = 17296;
const STRATZ_API = `https://api.stratz.com/api/v1/League/${LEAGUE_ID}/matches`;
const OUTPUT_FILE = 'stratz_league_matches.json';

async function fetchStratzMatches() {
  const headers: Record<string, string> = { 'User-Agent': 'STRATZ_API' };
  const apiKey = process.env.STRATZ_API_KEY;
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }
  const res = await fetch(STRATZ_API, { headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch STRATZ matches: ${res.status} ${res.statusText} - ${text}`);
  }
  return res.json();
}

async function main() {
  try {
    const matches = await fetchStratzMatches();
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(matches, null, 2), 'utf-8');
    console.log(`Saved ${Array.isArray(matches) ? matches.length : 0} matches to ${OUTPUT_FILE}`);
  } catch (e) {
    console.error(e);
  }
}

main();
