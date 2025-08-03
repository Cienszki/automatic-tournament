// This script adds a unique 'id' field to each player in every team in registration_payloads.json.
// Usage: node scripts/add-player-ids.js

const fs = require('fs');
const path = require('path');

const PAYLOADS_PATH = path.join(__dirname, '../registration_payloads.json');
const OUTPUT_PATH = PAYLOADS_PATH; // Overwrite in place

function main() {
  const payloads = JSON.parse(fs.readFileSync(PAYLOADS_PATH, 'utf8'));
  for (const team of payloads) {
    if (Array.isArray(team.players)) {
      team.players.forEach((player, idx) => {
        // Use captainId + index for uniqueness
        player.id = `${team.captainId}-${idx}`;
      });
    }
  }
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(payloads, null, 2));
  console.log('Added id field to all players in registration_payloads.json');
}

main();
