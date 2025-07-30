// src/lib/cron-sync.js
// Node.js script to run syncLeagueMatches on a schedule
const { syncLeagueMatches } = require('./actions');

async function runSync() {
  try {
    const result = await syncLeagueMatches();
    console.log(`[${new Date().toISOString()}] Sync result:`, result);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Sync failed:`, err);
  }
}

// Run every 15 minutes
setInterval(runSync, 15 * 60 * 1000);

// Run once on start
runSync();
