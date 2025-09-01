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

async function comprehensiveGameSearch() {
  console.log('🔍 Comprehensive search for ALL games with any CINCO PERROS players...\n');
  
  try {
    const cincoPerrosPlayerIds = [
      "HsMv06e5VSBpzpkBsNQd", // Juxi1337
      "7sXBiIbXSl5ijRV0weub", // Joxxi  
      "GJUf61LWQo85fHSf9Jr8", // SZYMI
      "UVkSkax9ePXxQWIniYIV", // kero
      "zuPIOY1NbX6zpHdaiwA8"  // Abedzik
    ];
    
    console.log('📊 Searching ALL matches and games for CINCO PERROS performances...\n');
    
    const matchesSnapshot = await db.collection('matches').get();
    console.log(`Found ${matchesSnapshot.docs.length} total matches in database\n`);
    
    const allGamesWithCincoPerros = [];
    let totalGamesProcessed = 0;
    
    for (const matchDoc of matchesSnapshot.docs) {
      const matchData = matchDoc.data();
      const gamesSnapshot = await matchDoc.ref.collection('games').get();
      
      for (const gameDoc of gamesSnapshot.docs) {
        totalGamesProcessed++;
        const gameData = gameDoc.data();
        const performancesSnapshot = await gameDoc.ref.collection('performances').get();
        
        let cincoPerrosPlayerCount = 0;
        const foundPlayers = [];
        const missingPlayers = [];
        
        // Check which CINCO PERROS players have performances
        cincoPerrosPlayerIds.forEach(playerId => {
          const hasPerformance = performancesSnapshot.docs.some(doc => doc.id === playerId);
          if (hasPerformance) {
            cincoPerrosPlayerCount++;
            const perfData = performancesSnapshot.docs.find(doc => doc.id === playerId)?.data();
            foundPlayers.push({
              playerId,
              fantasyPoints: perfData?.fantasyPoints || 0
            });
          } else {
            missingPlayers.push(playerId);
          }
        });
        
        // If any CINCO PERROS players found, add to analysis
        if (cincoPerrosPlayerCount > 0) {
          allGamesWithCincoPerros.push({
            matchId: matchDoc.id,
            gameId: gameDoc.id,
            round: matchData.group_id || matchData.roundId || matchData.round || 'unknown',
            gameDate: gameData?.start_time ? new Date(gameData.start_time * 1000).toISOString() : 'unknown',
            cincoPerrosPlayerCount,
            totalPerformances: performancesSnapshot.docs.length,
            foundPlayers,
            missingPlayers,
            gameDataKeys: gameData ? Object.keys(gameData).sort() : [],
            isParsed: gameData?.isParsed,
            isManualImport: gameData?.isManualImport,
            matchStatus: matchData.status,
            teamA: matchData.teamA,
            teamB: matchData.teamB
          });
        }
      }
    }
    
    console.log(`📈 Processed ${totalGamesProcessed} total games`);
    console.log(`🎯 Found ${allGamesWithCincoPerros.length} games with CINCO PERROS players:\n`);
    
    // Sort by date
    allGamesWithCincoPerros.sort((a, b) => new Date(a.gameDate).getTime() - new Date(b.gameDate).getTime());
    
    allGamesWithCincoPerros.forEach((game, index) => {
      console.log(`${index + 1}. Game: ${game.gameId}`);
      console.log(`   Match: ${game.matchId.substring(0, 8)}...`);
      console.log(`   Date: ${game.gameDate.substring(0, 16).replace('T', ' ')}`);
      console.log(`   Round: ${game.round}`);
      console.log(`   CINCO PERROS Players: ${game.cincoPerrosPlayerCount}/5`);
      console.log(`   Total Performances: ${game.totalPerformances}`);
      console.log(`   Match Status: ${game.matchStatus || 'unknown'}`);
      console.log(`   Is Parsed: ${game.isParsed}`);
      console.log(`   Manual Import: ${game.isManualImport}`);
      
      if (game.foundPlayers.length > 0) {
        const playerSummary = game.foundPlayers.map(p => `${p.playerId.substring(0, 8)} (${p.fantasyPoints.toFixed(1)}pts)`).join(', ');
        console.log(`   Found Players: ${playerSummary}`);
      }
      
      if (game.missingPlayers.length > 0) {
        console.log(`   ⚠️  Missing Players: ${game.missingPlayers.map(p => p.substring(0, 8)).join(', ')}`);
      }
      
      console.log();
    });
    
    // Detailed analysis
    const completeGames = allGamesWithCincoPerros.filter(g => g.cincoPerrosPlayerCount === 5);
    const partialGames = allGamesWithCincoPerros.filter(g => g.cincoPerrosPlayerCount > 0 && g.cincoPerrosPlayerCount < 5);
    
    console.log('🎯 DETAILED ANALYSIS:');
    console.log(`   Total games with any CINCO PERROS: ${allGamesWithCincoPerros.length}`);
    console.log(`   Complete games (5/5 players): ${completeGames.length}`);
    console.log(`   Partial games (<5 players): ${partialGames.length}`);
    
    if (partialGames.length > 0) {
      console.log('\n🚨 PARTIAL GAMES ANALYSIS:');
      partialGames.forEach((game, index) => {
        console.log(`   ${index + 1}. Game ${game.gameId}: ${game.cincoPerrosPlayerCount}/5 players`);
        console.log(`      Date: ${game.gameDate.substring(0, 16).replace('T', ' ')}`);
        console.log(`      Round: ${game.round}`);
        console.log(`      Found: ${game.foundPlayers.length} players`);
        console.log(`      Missing: ${game.missingPlayers.map(p => p.substring(0, 8)).join(', ')}`);
        
        // This could be our missing 6th game!
        if (game.cincoPerrosPlayerCount >= 3) {
          console.log(`      🎯 POTENTIAL 6TH GAME - has ${game.cincoPerrosPlayerCount} CINCO PERROS players!`);
        }
        console.log();
      });
    }
    
    // Check for any games that might have been missed due to player ID mapping issues
    console.log('\n🔍 POTENTIAL ISSUES:');
    
    if (completeGames.length === 5 && partialGames.length > 0) {
      console.log('   ✅ Found exactly 5 complete games + some partial games');
      console.log('   🎯 The 6th game might be one of the partial games with missing performance data');
      
      // Look for the most likely candidate for the 6th game
      const likelyCandidates = partialGames.filter(g => g.cincoPerrosPlayerCount >= 3);
      if (likelyCandidates.length > 0) {
        console.log(`\n🎯 MOST LIKELY 6TH GAME CANDIDATES:`);
        likelyCandidates.forEach(game => {
          console.log(`   - Game ${game.gameId} (${game.cincoPerrosPlayerCount}/5 players, ${game.gameDate.substring(0, 10)})`);
        });
      }
    }
    
    // Round distribution
    const roundCounts = {};
    allGamesWithCincoPerros.forEach(game => {
      roundCounts[game.round] = (roundCounts[game.round] || 0) + 1;
    });
    
    console.log(`\n📊 GAMES BY ROUND:`);
    Object.entries(roundCounts).forEach(([round, count]) => {
      console.log(`   ${round}: ${count} games`);
    });
    
  } catch (error) {
    console.error('❌ Error in comprehensive search:', error);
  }
}

// Run the script
if (require.main === module) {
  comprehensiveGameSearch().then(() => {
    process.exit(0);
  }).catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
}

module.exports = { comprehensiveGameSearch };