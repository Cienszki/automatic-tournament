// scripts/register-all-teams-http.js
// Registers all teams from registration_payloads.json using the /api/register-team endpoint (for Node.js)

const path = require('path');
const fs = require('fs/promises');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const API_URL = 'http://localhost:3000/api/register-team';

async function main() {
  const filePath = path.join(process.cwd(), 'registration_payloads.json');
  const data = await fs.readFile(filePath, 'utf-8');
  const teams = JSON.parse(data);

  let successCount = 0;
  let failCount = 0;

  // Only try the first team for now
  const team = teams[0];
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(team)
    });
    const result = await res.json();
    if (result && result.success) {
      console.log(`✅ Registered: ${team.name}`);
      successCount++;
    } else {
      console.error(`❌ Failed: ${team.name} - ${(result && result.message) || 'Unknown error'}`);
      failCount++;
    }
  } catch (e) {
    console.error(`❌ Exception for ${team.name}:`, e);
    failCount++;
  }

  console.log(`\nDone! Success: ${successCount}, Failed: ${failCount}`);
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
