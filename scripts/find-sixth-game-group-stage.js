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

async function findSixthGameGroupStage() {
  console.log('🔍 Searching for the 6th CINCO PERROS game that group stage counts but fantasy doesn\'t...\n');
  
  try {
    // CINCO PERROS team ID from the leaderboard data
    const cincoPerrosTeamId = "ASkLQqoDGCOPsextQFsl";
    
    console.log('📊 Step 1: Find all matches involving CINCO PERROS team...\n');
    
    // Search for matches where CINCO PERROS is teamA or teamB
    const matchesSnapshot = await db.collection('matches').get();
    const cincoPerrosMatches = [];
    
    for (const matchDoc of matchesSnapshot.docs) {
      const matchData = matchDoc.data();
      
      const isCincoPerrosMatch = (
        matchData.teamA === cincoPerrosTeamId ||
        matchData.teamB === cincoPerrosTeamId
      );
      
      if (isCincoPerrosMatch) {
        const gamesSnapshot = await matchDoc.ref.collection('games').get();
        
        cincoPerrosMatches.push({
          matchId: matchDoc.id,
          matchData,
          gameCount: gamesSnapshot.docs.length,
          gameIds: gamesSnapshot.docs.map(doc => doc.id),
          round: matchData.group_id || matchData.roundId || matchData.round || 'unknown',
          status: matchData.status,
          completed: matchData.completed_at
        });
      }
    }
    
    console.log(`🎯 Found ${cincoPerrosMatches.length} matches involving CINCO PERROS:\n`);
    
    cincoPerrosMatches.forEach((match, index) => {
      console.log(`${index + 1}. Match: ${match.matchId.substring(0, 8)}...`);
      console.log(`   Round: ${match.round}`);
      console.log(`   Status: ${match.status || 'unknown'}`);
      console.log(`   Games: ${match.gameCount} (${match.gameIds.join(', ')})`);
      console.log(`   Team A: ${match.matchData.teamA === cincoPerrosTeamId ? 'CINCO PERROS' : 'Other'}`);
      console.log(`   Team B: ${match.matchData.teamB === cincoPerrosTeamId ? 'CINCO PERROS' : 'Other'}`);
      console.log();
    });
    
    console.log('📊 Step 2: Check each game for CINCO PERROS player performances...\n');
    
    const cincoPerrosPlayerIds = [
      "HsMv06e5VSBpzpkBsNQd", // Juxi1337
      "7sXBiIbXSl5ijRV0weub", // Joxxi  
      "GJUf61LWQo85fHSf9Jr8", // SZYMI
      "UVkSkax9ePXxQWIniYIV", // kero
      "zuPIOY1NbX6zpHdaiwA8"  // Abedzik
    ];
    
    const allGamesAnalysis = [];
    
    for (const match of cincoPerrosMatches) {
      for (const gameId of match.gameIds) {
        const matchDoc = await db.collection('matches').doc(match.matchId).get();
        const gameDoc = await matchDoc.ref.collection('games').doc(gameId).get();
        const gameData = gameDoc.data();
        
        const performancesSnapshot = await gameDoc.ref.collection('performances').get();
        
        let cincoPerrosPlayerCount = 0;
        const foundPlayers = [];
        const allPlayerIds = [];
        
        performancesSnapshot.docs.forEach(perfDoc => {
          allPlayerIds.push(perfDoc.id);
          
          if (cincoPerrosPlayerIds.includes(perfDoc.id)) {
            cincoPerrosPlayerCount++;
            foundPlayers.push({
              playerId: perfDoc.id,
              fantasyPoints: perfDoc.data().fantasyPoints || 0
            });
          }
        });
        
        allGamesAnalysis.push({
          matchId: match.matchId,
          gameId,
          round: match.round,
          gameDate: gameData?.start_time ? new Date(gameData.start_time * 1000).toISOString() : 'unknown',
          cincoPerrosPlayerCount,
          totalPerformances: performancesSnapshot.docs.length,
          foundPlayers,
          allPlayerIds,
          gameDataExists: !!gameData,
          gameDataKeys: gameData ? Object.keys(gameData).sort() : [],
          hasGameData: !!gameData,
          isParsed: gameData?.isParsed,
          isManualImport: gameData?.isManualImport
        });
      }
    }
    
    console.log('📋 COMPLETE GAME ANALYSIS:\n');
    
    allGamesAnalysis
      .sort((a, b) => new Date(a.gameDate).getTime() - new Date(b.gameDate).getTime())
      .forEach((game, index) => {
        console.log(`${index + 1}. Game: ${game.gameId}`);
        console.log(`   Match: ${game.matchId.substring(0, 8)}...`);
        console.log(`   Date: ${game.gameDate.substring(0, 16).replace('T', ' ')}`);
        console.log(`   Round: ${game.round}`);
        console.log(`   CINCO PERROS Players: ${game.cincoPerrosPlayerCount}/5`);
        console.log(`   Total Performances: ${game.totalPerformances}`);
        console.log(`   Has Game Data: ${game.hasGameData ? '✅' : '❌'}`);
        console.log(`   Is Parsed: ${game.isParsed}`);
        console.log(`   Manual Import: ${game.isManualImport}`);
        
        if (game.foundPlayers.length > 0) {
          console.log(`   Found Players: ${game.foundPlayers.map(p => `${p.playerId.substring(0, 8)} (${p.fantasyPoints.toFixed(1)}pts)`).join(', ')}`);
        }
        
        if (game.cincoPerrosPlayerCount === 0 && game.totalPerformances > 0) {
          console.log(`   ⚠️  This game has performances but NO CINCO PERROS players!`);
          console.log(`   All Players: ${game.allPlayerIds.slice(0, 3).join(', ')}${game.allPlayerIds.length > 3 ? '...' : ''}`);
        }
        
        if (game.cincoPerrosPlayerCount > 0 && game.cincoPerrosPlayerCount < 5) {
          console.log(`   🚨 PARTIAL CINCO PERROS GAME - Missing ${5 - game.cincoPerrosPlayerCount} players!`);
        }
        
        console.log();
      });
    
    // Summary analysis
    const gamesWithCincoPerros = allGamesAnalysis.filter(g => g.cincoPerrosPlayerCount > 0);
    const completeGames = allGamesAnalysis.filter(g => g.cincoPerrosPlayerCount === 5);
    const partialGames = allGamesAnalysis.filter(g => g.cincoPerrosPlayerCount > 0 && g.cincoPerrosPlayerCount < 5);
    const gamesWithoutData = allGamesAnalysis.filter(g => !g.hasGameData);
    const gamesWithoutPerformances = allGamesAnalysis.filter(g => g.totalPerformances === 0);
    
    console.log('🎯 SUMMARY ANALYSIS:');
    console.log(`   Total games in CINCO PERROS matches: ${allGamesAnalysis.length}`);
    console.log(`   Games with any CINCO PERROS players: ${gamesWithCincoPerros.length}`);
    console.log(`   Complete games (5/5 CINCO PERROS): ${completeGames.length}`);
    console.log(`   Partial games (<5 CINCO PERROS): ${partialGames.length}`);
    console.log(`   Games without game data: ${gamesWithoutData.length}`);
    console.log(`   Games without any performances: ${gamesWithoutPerformances.length}`);
    
    if (completeGames.length !== 6) {
      console.log(`\n🚨 DISCREPANCY FOUND:`);
      console.log(`   Expected: 6 complete CINCO PERROS games`);
      console.log(`   Found: ${completeGames.length} complete CINCO PERROS games`);
      console.log(`   Missing: ${6 - completeGames.length} games`);
      
      if (partialGames.length > 0) {
        console.log(`\n🔍 POTENTIAL ISSUES IN PARTIAL GAMES:`);
        partialGames.forEach(game => {
          console.log(`   - Game ${game.gameId}: ${game.cincoPerrosPlayerCount}/5 players`);
        });
      }
      
      if (gamesWithoutPerformances.length > 0) {
        console.log(`\n🔍 GAMES WITHOUT PERFORMANCES (possible missing data):`);
        gamesWithoutPerformances.forEach(game => {
          console.log(`   - Game ${game.gameId} in match ${game.matchId.substring(0, 8)}`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Error searching for sixth game:', error);
  }
}

// Run the script
if (require.main === module) {
  findSixthGameGroupStage().then(() => {
    process.exit(0);
  }).catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
}

module.exports = { findSixthGameGroupStage };