// scripts/register-all-teams.ts
// Registers all teams from registration_payloads.json using the backend registerTeam function.

import path from 'path';
import fs from 'fs/promises';
import { registerTeam } from '../src/lib/actions';

async function main() {
  const filePath = path.join(process.cwd(), 'registration_payloads.json');
  const data = await fs.readFile(filePath, 'utf-8');
  const teams = JSON.parse(data);

  let successCount = 0;
  let failCount = 0;

  // Only try the first team for now
  const team = teams[0];
  try {
    const result = await registerTeam(team);
    if (result?.success) {
      console.log(`✅ Registered: ${team.name}`);
      successCount++;
    } else {
      console.error(`❌ Failed: ${team.name} - ${result?.message || 'Unknown error'}`);
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
