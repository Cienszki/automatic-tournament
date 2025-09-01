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

async function verifyJoxxiGamesAfterRecalc() {
  console.log('🔍 Verifying .joxxi games after fantasy recalculation...\n');
  
  try {
    // Check .joxxi's lineup first
    console.log('📋 Checking .joxxi lineup...');
    const lineupsSnapshot = await db.collection('fantasyLineups').get();
    let joxxiLineup = null;
    
    for (const doc of lineupsSnapshot.docs) {
      const lineup = doc.data();
      if (lineup.username === '.joxxi' || lineup.displayName === '.joxxi') {
        joxxiLineup = lineup;
        console.log(`   Found .joxxi lineup: ${doc.id}`);
        console.log(`   Players: ${Object.values(lineup.lineup || {}).length}`);
        console.log(`   Player IDs: ${JSON.stringify(Object.values(lineup.lineup || {}))}`);
        break;
      }
    }
    
    if (!joxxiLineup) {
      console.log('❌ Could not find .joxxi lineup');
      return;
    }
    
    // Now count actual performance documents for each player
    console.log('\n📊 Counting performance documents for each player...');
    const playerIds = Object.values(joxxiLineup.lineup || {});
    let totalGames = 0;
    
    for (const playerId of playerIds) {
      console.log(`\n   🔍 Checking player ${playerId.substring(0, 8)}...`);
      
      // Search through all matches and games for this player's performances
      const matchesSnapshot = await db.collection('matches').get();
      let playerGames = 0;
      const gameDetails = [];
      
      for (const matchDoc of matchesSnapshot.docs) {
        const gamesSnapshot = await matchDoc.ref.collection('games').get();
        
        for (const gameDoc of gamesSnapshot.docs) {
          const performanceDoc = await gameDoc.ref.collection('performances').doc(playerId).get();
          
          if (performanceDoc.exists) {
            playerGames++;
            const performance = performanceDoc.data();
            gameDetails.push({
              matchId: matchDoc.id,
              gameId: gameDoc.id,
              fantasyPoints: performance.fantasyPoints || 0
            });
          }
        }
      }
      
      console.log(`      Performance documents found: ${playerGames}`);
      console.log(`      Games: ${gameDetails.map(g => g.gameId).join(', ')}`);
      totalGames += playerGames;
    }
    
    console.log(`\n📈 TOTAL GAMES FOR .JOXXI:`);
    console.log(`   Players in lineup: ${playerIds.length}`);
    console.log(`   Total performance documents: ${totalGames}`);
    console.log(`   Expected: ${playerIds.length} players × 6 games = ${playerIds.length * 6}`);
    
    // Check fantasy leaderboard data
    console.log(`\n🏆 Checking fantasy leaderboard data...`);
    
    // Call the leaderboard API endpoint to see current data
    console.log('   Simulating API call to get leaderboard data...');
    
    // Check if there are any fantasy lineup scores documents
    const fantasyScoresSnapshot = await db.collection('fantasyScores').get();
    console.log(`   Fantasy scores documents: ${fantasyScoresSnapshot.docs.length}`);
    
    for (const scoreDoc of fantasyScoresSnapshot.docs) {
      const scoreData = scoreDoc.data();
      if (scoreData.username === '.joxxi' || scoreData.displayName === '.joxxi') {
        console.log(`   Found .joxxi fantasy score: ${scoreDoc.id}`);
        console.log(`   Total points: ${scoreData.totalPoints || 0}`);
        console.log(`   Games played: ${scoreData.gamesPlayed || 0}`);
        console.log(`   Last updated: ${scoreData.lastUpdated ? scoreData.lastUpdated.toDate() : 'unknown'}`);
      }
    }
    
    // Check CINCO PERROS matches specifically
    console.log(`\n🔍 Verifying CINCO PERROS matches have all games...`);
    
    const cincoMatches = [
      { id: "o2H30RJvnYByDcM2dINB", name: "CINCO PERROS vs gwiazda" },
      { id: "KWrwrjEWK7yL7r6GOipp", name: "CINCO PERROS vs Pora na Przygode" }
    ];
    
    for (const match of cincoMatches) {
      console.log(`\n   📋 ${match.name}:`);
      const matchDoc = await db.collection('matches').doc(match.id).get();
      const matchData = matchDoc.data();
      
      console.log(`      Game IDs: ${JSON.stringify(matchData.game_ids || [])}`);
      
      const gamesSnapshot = await matchDoc.ref.collection('games').get();
      console.log(`      Actual games: ${gamesSnapshot.docs.length}`);
      
      for (const gameDoc of gamesSnapshot.docs) {
        const performancesSnapshot = await gameDoc.ref.collection('performances').get();
        console.log(`         Game ${gameDoc.id}: ${performancesSnapshot.docs.length} performances`);
      }
    }
    
    console.log(`\n🤔 ANALYSIS:`);
    if (totalGames === playerIds.length * 6) {
      console.log(`   ✅ Performance documents are correct: ${totalGames} total`);
      console.log(`   🔍 Issue might be with fantasy scoring calculation or API response`);
    } else {
      console.log(`   ❌ Performance documents mismatch:`);
      console.log(`      Expected: ${playerIds.length * 6}`);
      console.log(`      Found: ${totalGames}`);
      console.log(`   🔍 Some games/performances are still missing`);
    }
    
  } catch (error) {
    console.error('❌ Error verifying games:', error);
  }
}

// Run the script
if (require.main === module) {
  verifyJoxxiGamesAfterRecalc().then(() => {
    process.exit(0);
  }).catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
}

module.exports = { verifyJoxxiGamesAfterRecalc };