require('dotenv').config({ path: __dirname + '/../.env.local' });
const fetch = require('node-fetch');

const STRATZ_API_KEY = process.env.STRATZ_API_KEY;
const LEAGUE_ID = 18559;

async function main() {
  const url = `https://api.stratz.com/api/v1/League/${LEAGUE_ID}/matches`;
  const headers = STRATZ_API_KEY ? { 'Authorization': `Bearer ${STRATZ_API_KEY}` } : {};

  const res = await fetch(url, { headers });
  if (!res.ok) {
    console.error('Failed to fetch from Stratz API:', res.status, await res.text());
    process.exit(1);
  }
  const matches = await res.json();
  if (!Array.isArray(matches)) {
    console.error('Unexpected response:', matches);
    process.exit(1);
  }
  matches.forEach(match => {
    if (match.id) {
      console.log(match.id);
    }
  });
  console.log(`Total matches found: ${matches.length}`);
}

main().then(() => process.exit(0));
