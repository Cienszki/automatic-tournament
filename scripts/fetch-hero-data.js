// This script fetches hero data from OpenDota and writes a mapping of hero_id to hero name to hero_data.json
// Usage: node scripts/fetch-hero-data.js

const fs = require('fs');
const https = require('https');

const HERO_STATS_URL = 'https://api.opendota.com/api/heroStats';
const OUTPUT_PATH = 'hero_data.json';

// Load API key from environment variable or .env.local
const API_KEY = process.env.OPENDOTA_API_KEY || require('dotenv').config({ path: '.env.local' }).parsed?.OPENDOTA_API_KEY;
if (!API_KEY) {
  console.error('No OpenDota API key found. Set OPENDOTA_API_KEY in your environment or .env.local');
  process.exit(1);
}

const options = {
  headers: {
    'Authorization': `Bearer ${API_KEY}`
  }
};

https.get(HERO_STATS_URL, options, (res) => {
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => {
    try {
      const heroes = JSON.parse(data);
      // Create a mapping: hero_id -> localized_name
      const heroMap = {};
      if (Array.isArray(heroes)) {
        heroes.forEach(hero => {
          heroMap[hero.id] = hero.localized_name;
        });
        fs.writeFileSync(OUTPUT_PATH, JSON.stringify(heroMap, null, 2));
        console.log(`Hero data written to ${OUTPUT_PATH}`);
      } else {
        console.error('Unexpected response:', heroes);
      }
    } catch (e) {
      console.error('Failed to parse hero data:', e);
    }
  });
}).on('error', (err) => {
  console.error('Error fetching hero data:', err);
});
