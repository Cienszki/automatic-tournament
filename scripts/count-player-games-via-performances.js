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

async function countPlayerGamesViaPerformances() {
  console.log('🔍 Counting player games via performance documents...\n');
  
  try {
    // Use known SZYMI data from the leaderboard API  
    const playerInfo = {
      playerId: "GJUf61LWQo85fHSf9Jr8", // From the API data
      nickname: "SZYMI",
      teamName: "CINCO PERROS", 
      role: "Offlane",
      steamId32: "68945677",
      steamId: "76561198029211405"
    };
    
    console.log(`Counting games for ${playerInfo.nickname}:`);
    console.log(`   Player ID: ${playerInfo.playerId}`);
    console.log(`   Team: ${playerInfo.teamName}`);
    console.log(`   Role: ${playerInfo.role}\n`);
    
    // Search through all matches and games for performance documents
    console.log('🔍 Searching through all matches and games for performances...\n');
    
    const matchesSnapshot = await db.collection('matches').get();
    let totalGames = 0;
    const gameDetails = [];
    
    for (const matchDoc of matchesSnapshot.docs) {
      const matchId = matchDoc.id;
      const matchData = matchDoc.data();
      
      // Get all games for this match
      const gamesSnapshot = await matchDoc.ref.collection('games').get();
      
      for (const gameDoc of gamesSnapshot.docs) {
        const gameId = gameDoc.id;
        const gameData = gameDoc.data();
        
        // Check if this player has a performance document in this game
        const performanceDoc = await gameDoc.ref.collection('performances').doc(playerInfo.playerId).get();
        
        if (performanceDoc.exists) {
          totalGames++;
          const performance = performanceDoc.data();
          
          gameDetails.push({
            matchId,
            gameId,
            round: matchData.group_id || matchData.roundId || matchData.round || 'unknown',
            fantasyPoints: performance.fantasyPoints || 0,
            kills: performance.kills || 0,
            deaths: performance.deaths || 0,
            assists: performance.assists || 0,
            gpm: performance.gold_per_min || 0,
            xpm: performance.xp_per_min || 0,
            gameDate: gameData.start_time ? new Date(gameData.start_time * 1000).toISOString() : 'unknown',
            gameDuration: gameData.duration || 0,
            heroId: performance.heroId || 0
          });
        }
      }
    }
    
    console.log(`📊 ${playerInfo.nickname.toUpperCase()} GAME SUMMARY (via Performance Documents):`);
    console.log(`   Player ID: ${playerInfo.playerId}`);
    console.log(`   Total Games Found: ${totalGames}`);
    
    if (gameDetails.length > 0) {
      console.log(`\n📋 Game Details:`);
      gameDetails
        .sort((a, b) => new Date(b.gameDate).getTime() - new Date(a.gameDate).getTime())
        .forEach((game, index) => {
          console.log(`   ${index + 1}. Match: ${game.matchId.substring(0, 8)}...`);
          console.log(`      Game ID: ${game.gameId}`);
          console.log(`      Round: ${game.round}`);
          console.log(`      Fantasy Points: ${game.fantasyPoints.toFixed(1)}`);
          console.log(`      KDA: ${game.kills}/${game.deaths}/${game.assists}`);
          console.log(`      GPM/XPM: ${game.gpm}/${game.xpm}`);
          console.log(`      Date: ${game.gameDate.substring(0, 16).replace('T', ' ')}`);
          console.log(`      Duration: ${Math.floor(game.gameDuration / 60)}:${String(game.gameDuration % 60).padStart(2, '0')}`);
          console.log();
        });
      
      const avgPoints = gameDetails.reduce((sum, g) => sum + g.fantasyPoints, 0) / gameDetails.length;
      const totalPoints = gameDetails.reduce((sum, g) => sum + g.fantasyPoints, 0);
      
      console.log(`   📈 Statistics:`);
      console.log(`      Total Fantasy Points: ${totalPoints.toFixed(1)}`);
      console.log(`      Average Fantasy Points: ${avgPoints.toFixed(1)} PPG`);
      
      // Round breakdown
      const roundCounts = {};
      gameDetails.forEach(game => {
        roundCounts[game.round] = (roundCounts[game.round] || 0) + 1;
      });
      
      console.log(`\n   📊 Games by Round:`);
      Object.entries(roundCounts).forEach(([round, count]) => {
        console.log(`      ${round}: ${count} games`);
      });
    }
    
    console.log(`\n🤔 ANALYSIS:`);
    console.log(`   - ${playerInfo.nickname} played ${totalGames} actual Dota games (with performance data)`);
    
    if (totalGames > 0) {
      console.log(`   - ✅ ${playerInfo.nickname} has complete game and performance data`);
      console.log(`   - 🎯 This should match their fantasy leaderboard count`);
    } else {
      console.log(`   - ⚠️  No performance data found for ${playerInfo.nickname}`);
      console.log(`   - ❌ This explains why they might not appear in fantasy leaderboards`);
    }
    
  } catch (error) {
    console.error('❌ Error counting player games:', error);
  }
}

// Run the script
if (require.main === module) {
  countPlayerGamesViaPerformances().then(() => {
    process.exit(0);
  }).catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
}

module.exports = { countPlayerGamesViaPerformances };