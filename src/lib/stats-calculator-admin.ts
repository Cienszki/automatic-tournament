// src/lib/stats-calculator-admin.ts
// Admin version of stats calculator using Firebase Admin SDK

import { getAdminDb, ensureAdminInitialized } from '../../server/lib/admin';

/**
 * Recalculate comprehensive tournament statistics (admin version)
 */
export async function recalculateBasicTournamentStatsAdmin(): Promise<void> {
  console.log('Using comprehensive stats calculator...');
  const { calculateAllComprehensiveStats } = await import('./comprehensive-stats-calculator');
  await calculateAllComprehensiveStats();
}

/**
 * Recalculate basic tournament statistics (admin version) - legacy
 */
export async function recalculateBasicTournamentStatsAdminLegacy(): Promise<void> {
  ensureAdminInitialized();
  const db = getAdminDb();

  console.log('Starting basic tournament stats recalculation (admin)...');

  try {
    // Get all matches and their games
    const matchesSnapshot = await db.collection('matches').get();
    
    const statsData = {
      totalMatches: 0,
      totalGames: 0,
      totalKills: 0,
      totalDeaths: 0,
      totalAssists: 0,
      totalGPM: 0,
      totalXPM: 0,
      totalLastHits: 0,
      totalDenies: 0,
      averageGameDuration: 0,
      longestGame: 0,
      shortestGame: Number.MAX_SAFE_INTEGER,
      mostKillsInGame: 0,
      mostAssistsInGame: 0,
      highestGPM: 0,
      highestXPM: 0,
      playerCount: 0,
      gameCount: 0,
      lastUpdated: new Date().toISOString()
    };

    let totalDuration = 0;
    let gameCount = 0;

    for (const matchDoc of matchesSnapshot.docs) {
      const matchData = matchDoc.data();
      
      if (matchData.status === 'completed' && matchData.game_ids && matchData.game_ids.length > 0) {
        statsData.totalMatches++;
        
        // Get all games for this match
        const gamesSnapshot = await matchDoc.ref.collection('games').get();
        
        for (const gameDoc of gamesSnapshot.docs) {
          const gameData = gameDoc.data();
          gameCount++;
          statsData.totalGames++;
          
          // Game duration stats
          if (gameData.duration) {
            totalDuration += gameData.duration;
            statsData.longestGame = Math.max(statsData.longestGame, gameData.duration);
            statsData.shortestGame = Math.min(statsData.shortestGame, gameData.duration);
          }

          // Get player performances for this game
          const performancesSnapshot = await gameDoc.ref.collection('performances').get();
          
          for (const perfDoc of performancesSnapshot.docs) {
            const perf = perfDoc.data();
            
            statsData.totalKills += perf.kills || 0;
            statsData.totalDeaths += perf.deaths || 0;
            statsData.totalAssists += perf.assists || 0;
            statsData.totalGPM += perf.gold_per_min || 0;
            statsData.totalXPM += perf.xp_per_min || 0;
            statsData.totalLastHits += perf.last_hits || 0;
            statsData.totalDenies += perf.denies || 0;
            
            // Track maximums
            statsData.mostKillsInGame = Math.max(statsData.mostKillsInGame, perf.kills || 0);
            statsData.mostAssistsInGame = Math.max(statsData.mostAssistsInGame, perf.assists || 0);
            statsData.highestGPM = Math.max(statsData.highestGPM, perf.gold_per_min || 0);
            statsData.highestXPM = Math.max(statsData.highestXPM, perf.xp_per_min || 0);
            
            statsData.playerCount++;
          }
        }
      }
    }

    // Calculate averages
    if (gameCount > 0) {
      statsData.averageGameDuration = totalDuration / gameCount;
    }

    if (statsData.shortestGame === Number.MAX_SAFE_INTEGER) {
      statsData.shortestGame = 0;
    }

    statsData.gameCount = gameCount;

    // Save to tournament stats collection
    await db.collection('tournamentStats').doc('basic').set(statsData);
    
    console.log(`✅ Basic tournament stats recalculated: ${statsData.totalMatches} matches, ${statsData.totalGames} games, ${statsData.playerCount} player performances`);
    
  } catch (error) {
    console.error('Error recalculating basic tournament stats:', error);
    throw error;
  }
}