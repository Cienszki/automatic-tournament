// scripts/getStratzLeagueMatchIds.ts
// Node.js script to get all match IDs from stratz_league_matches.json
import path from 'path';
import fs from 'fs/promises';

export async function getStratzLeagueMatchIds(): Promise<number[]> {
  const filePath = path.resolve(process.cwd(), 'stratz_league_matches.json');
  const data = await fs.readFile(filePath, 'utf-8');
  const matches = JSON.parse(data);
  return matches.map((m: any) => Number(m.id));
}

// If run directly, print the IDs
if (require.main === module) {
  getStratzLeagueMatchIds().then(ids => {
    console.log(ids);
  });
}
