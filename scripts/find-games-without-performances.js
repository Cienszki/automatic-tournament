#!/usr/bin/env node

const admin = require('firebase-admin');

// Initialize Firebase Admin if not already done
if (!admin.apps.length) {
  try {
    // Load environment variables
    require('dotenv').config({ path: '.env.local' });
    
    // Decode the base64 encoded service account
    const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
    if (!serviceAccountBase64) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_BASE64 environment variable not found');
    }
    
    const serviceAccount = JSON.parse(Buffer.from(serviceAccountBase64, 'base64').toString('utf8'));
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase Admin SDK initialized successfully.');
  } catch (error) {
    console.error('Failed to initialize Firebase:', error.message);
    process.exit(1);
  }
}

const db = admin.firestore();

async function findGamesWithoutPerformances() {
  console.log('🔍 Searching for games without performance data that might be counted in group stage...\n');
  
  try {
    const matchesSnapshot = await db.collection('matches').get();
    const gamesWithoutPerformances = [];
    const gamesInDateRange = [];
    
    console.log(`📊 Analyzing ${matchesSnapshot.docs.length} matches for games without performances...\n`);
    
    for (const matchDoc of matchesSnapshot.docs) {
      const matchData = matchDoc.data();
      const gamesSnapshot = await matchDoc.ref.collection('games').get();
      
      for (const gameDoc of gamesSnapshot.docs) {
        const gameData = gameDoc.data();
        const performancesSnapshot = await gameDoc.ref.collection('performances').get();
        
        const gameAnalysis = {
          matchId: matchDoc.id,
          gameId: gameDoc.id,
          gameDate: gameData?.start_time ? new Date(gameData.start_time * 1000).toISOString() : 'unknown',
          round: matchData.group_id || matchData.roundId || matchData.round || 'unknown',
          performanceCount: performancesSnapshot.docs.length,
          gameDataExists: !!gameData,
          gameDataKeys: gameData ? Object.keys(gameData).sort() : [],
          matchStatus: matchData.status,
          teamA: matchData.teamA,
          teamB: matchData.teamB,
          hasGameIds: !!matchData.game_ids,
          gameIdsArray: matchData.game_ids || []
        };
        
        // Check if it's in our date range (around CINCO PERROS games dates)
        if (gameData?.start_time) {
          const gameDate = new Date(gameData.start_time * 1000);
          const startDate = new Date('2025-08-18');
          const endDate = new Date('2025-08-28');
          
          if (gameDate >= startDate && gameDate <= endDate) {
            gamesInDateRange.push(gameAnalysis);
          }
        }
        
        // Games without performances
        if (gameAnalysis.performanceCount === 0) {
          gamesWithoutPerformances.push(gameAnalysis);
        }
      }
    }
    
    console.log('🎯 GAMES WITHOUT PERFORMANCES:\n');
    
    if (gamesWithoutPerformances.length === 0) {
      console.log('   ✅ All games have performance data\n');
    } else {
      gamesWithoutPerformances.forEach((game, index) => {
        console.log(`${index + 1}. Game: ${game.gameId}`);
        console.log(`   Match: ${game.matchId.substring(0, 8)}...`);
        console.log(`   Date: ${game.gameDate.substring(0, 16).replace('T', ' ')}`);
        console.log(`   Round: ${game.round}`);
        console.log(`   Match Status: ${game.matchStatus}`);
        console.log(`   Has Game Data: ${game.gameDataExists ? '✅' : '❌'}`);
        console.log(`   Team A: ${game.teamA || 'unknown'}`);
        console.log(`   Team B: ${game.teamB || 'unknown'}`);
        console.log();
      });
    }
    
    console.log('📅 GAMES IN DATE RANGE (Aug 18-28, 2025):\n');
    
    gamesInDateRange
      .sort((a, b) => new Date(a.gameDate).getTime() - new Date(b.gameDate).getTime())
      .forEach((game, index) => {
        console.log(`${index + 1}. Game: ${game.gameId}`);
        console.log(`   Match: ${game.matchId.substring(0, 8)}...`);
        console.log(`   Date: ${game.gameDate.substring(0, 16).replace('T', ' ')}`);
        console.log(`   Round: ${game.round}`);
        console.log(`   Performances: ${game.performanceCount}`);
        console.log(`   Match Status: ${game.matchStatus || 'unknown'}`);
        console.log(`   Team A: ${typeof game.teamA === 'string' ? game.teamA.substring(0, 8) + '...' : 'object'}`);
        console.log(`   Team B: ${typeof game.teamB === 'string' ? game.teamB.substring(0, 8) + '...' : 'object'}`);
        
        // Highlight games with no performances
        if (game.performanceCount === 0) {
          console.log(`   🚨 NO PERFORMANCES - This could be the missing 6th game!`);
        }
        
        // Check if match has game_ids reference
        if (game.hasGameIds && game.gameIdsArray.includes(game.gameId)) {
          console.log(`   ✅ Game is referenced in match.game_ids`);
        } else if (game.hasGameIds) {
          console.log(`   ⚠️  Game NOT in match.game_ids: ${JSON.stringify(game.gameIdsArray)}`);
        }
        
        console.log();
      });
    
    // Check for potential group stage counting mechanism
    console.log('🔍 ANALYZING MATCH-LEVEL GAME TRACKING:\n');
    
    const matchesInDateRange = gamesInDateRange.reduce((acc, game) => {
      if (!acc[game.matchId]) {
        acc[game.matchId] = {
          matchId: game.matchId,
          round: game.round,
          gameCount: 0,
          gamesWithPerformances: 0,
          gamesWithoutPerformances: 0,
          teamA: game.teamA,
          teamB: game.teamB,
          status: game.matchStatus,
          gameIds: []
        };
      }
      acc[game.matchId].gameCount++;
      acc[game.matchId].gameIds.push(game.gameId);
      
      if (game.performanceCount > 0) {
        acc[game.matchId].gamesWithPerformances++;
      } else {
        acc[game.matchId].gamesWithoutPerformances++;
      }
      
      return acc;
    }, {});
    
    Object.values(matchesInDateRange).forEach(match => {
      console.log(`📋 Match: ${match.matchId.substring(0, 8)}...`);
      console.log(`   Round: ${match.round}`);
      console.log(`   Status: ${match.status || 'unknown'}`);
      console.log(`   Total Games: ${match.gameCount}`);
      console.log(`   Games with Performances: ${match.gamesWithPerformances}`);
      console.log(`   Games without Performances: ${match.gamesWithoutPerformances}`);
      console.log(`   Game IDs: ${match.gameIds.join(', ')}`);
      
      if (match.gamesWithoutPerformances > 0) {
        console.log(`   🎯 This match has ${match.gamesWithoutPerformances} game(s) without performances!`);
      }
      console.log();
    });
    
    console.log('🎯 SUMMARY:');
    console.log(`   Total games without performances: ${gamesWithoutPerformances.length}`);
    console.log(`   Games in date range: ${gamesInDateRange.length}`);
    console.log(`   Games in date range with performances: ${gamesInDateRange.filter(g => g.performanceCount > 0).length}`);
    console.log(`   Games in date range WITHOUT performances: ${gamesInDateRange.filter(g => g.performanceCount === 0).length}`);
    
  } catch (error) {
    console.error('❌ Error searching for games without performances:', error);
  }
}

// Run the script
if (require.main === module) {
  findGamesWithoutPerformances().then(() => {
    process.exit(0);
  }).catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
}

module.exports = { findGamesWithoutPerformances };