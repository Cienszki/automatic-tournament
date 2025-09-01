#!/usr/bin/env node

// Load environment variables from .env.local
import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config({ path: join(__dirname, '..', '.env.local') });

import { fetchAllStratzLeagueMatches } from '../src/lib/actions';
import { LEAGUE_ID } from '../src/lib/definitions';

async function testSteamApi() {
  try {
    console.log(`Testing Steam API implementation with league ID ${LEAGUE_ID}...`);
    
    const matches = await fetchAllStratzLeagueMatches(LEAGUE_ID);
    
    console.log(`✅ Successfully fetched ${matches.length} matches`);
    console.log(`First 3 matches:`, matches.slice(0, 3).map(m => ({
      id: m.id,
      radiantTeamId: m.radiantTeamId,
      direTeamId: m.direTeamId,
      startTime: m.start_time
    })));
    
  } catch (error) {
    console.error(`❌ Error testing Steam API:`, error);
    process.exit(1);
  }
}

if (require.main === module) {
  testSteamApi();
}