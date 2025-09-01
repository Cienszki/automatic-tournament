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

async function findPlayerGamesBySteam32() {
  console.log('🔍 Finding player games by matching steam32 ID with game documents...\n');
  
  try {
    // Use known Juxi1337 data from the leaderboard API we saw earlier
    const playerSteam32 = "372574802"; // From the API data
    const playerInfo = {
      playerId: "HsMv06e5VSBpzpkBsNQd", // From the API data
      nickname: "Juxi1337",
      teamName: "CINCO PERROS",
      role: "Carry",
      steamId32: "372574802",
      steamId: "76561198332840530" // From the API data
    };
    
    console.log(`Using known Juxi1337 data:`);
    console.log(`   Player ID: ${playerInfo.playerId}`);
    console.log(`   Steam32 ID: ${playerSteam32}`);
    console.log(`   Steam64 ID: ${playerInfo.steamId}`);
    console.log(`   Team: ${playerInfo.teamName}`);
    console.log(`   Role: ${playerInfo.role}\n`);
    
    // Step 2: Search through all matches and games for this steam32 ID
    console.log('🔍 Searching through all matches and games...\n');
    
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
        
        // Check if player's steam32 ID is in this game's player list
        let foundInGame = false;
        let playerSlot = null;
        let team = null;
        
        // Check radiant team
        if (gameData.radiant_team && gameData.radiant_team.players) {
          const radiantPlayer = gameData.radiant_team.players.find(p => 
            p.account_id && p.account_id.toString() === playerSteam32.toString()
          );
          if (radiantPlayer) {
            foundInGame = true;
            playerSlot = radiantPlayer.player_slot;
            team = 'Radiant';
          }
        }
        
        // Check dire team if not found in radiant
        if (!foundInGame && gameData.dire_team && gameData.dire_team.players) {
          const direPlayer = gameData.dire_team.players.find(p => 
            p.account_id && p.account_id.toString() === playerSteam32.toString()
          );
          if (direPlayer) {
            foundInGame = true;
            playerSlot = direPlayer.player_slot;
            team = 'Dire';
          }
        }
        
        // Also check if there are performances saved for this player
        const performanceDoc = await gameDoc.ref.collection('performances').doc(playerInfo.playerId).get();
        const hasPerformance = performanceDoc.exists;
        
        if (foundInGame) {
          totalGames++;
          
          const performance = hasPerformance ? performanceDoc.data() : null;
          
          gameDetails.push({
            matchId,
            gameId,
            round: matchData.group_id || matchData.roundId || matchData.round || 'unknown',
            team,
            playerSlot,
            hasPerformance,
            fantasyPoints: performance?.fantasyPoints || 0,
            kills: performance?.kills || 0,
            deaths: performance?.deaths || 0,
            assists: performance?.assists || 0,
            gameDate: gameData.start_time ? new Date(gameData.start_time * 1000).toISOString() : 'unknown',
            gameDuration: gameData.duration || 0
          });
        }
      }
    }
    
    console.log(`📊 ${playerInfo.nickname.toUpperCase()} GAME SUMMARY (by Steam32 ID matching):`);
    console.log(`   Steam32 ID: ${playerSteam32}`);
    console.log(`   Total Games Found: ${totalGames}`);
    console.log(`   Games with Performance Data: ${gameDetails.filter(g => g.hasPerformance).length}`);
    console.log(`   Games without Performance Data: ${gameDetails.filter(g => !g.hasPerformance).length}`);
    
    if (gameDetails.length > 0) {
      console.log(`\n📋 Game Details:`);
      gameDetails.forEach((game, index) => {
        console.log(`   ${index + 1}. Match: ${game.matchId.substring(0, 8)}...`);
        console.log(`      Game ID: ${game.gameId}`);
        console.log(`      Round: ${game.round}`);
        console.log(`      Team: ${game.team}, Slot: ${game.playerSlot}`);
        console.log(`      Has Performance: ${game.hasPerformance ? '✅' : '❌'}`);
        if (game.hasPerformance) {
          console.log(`      Fantasy Points: ${game.fantasyPoints.toFixed(1)}`);
          console.log(`      KDA: ${game.kills}/${game.deaths}/${game.assists}`);
        }
        console.log(`      Date: ${game.gameDate.substring(0, 16).replace('T', ' ')}`);
        console.log();
      });
      
      const gamesWithPerformance = gameDetails.filter(g => g.hasPerformance);
      if (gamesWithPerformance.length > 0) {
        const avgPoints = gamesWithPerformance.reduce((sum, g) => sum + g.fantasyPoints, 0) / gamesWithPerformance.length;
        console.log(`   Average Fantasy Points: ${avgPoints.toFixed(1)} (across ${gamesWithPerformance.length} games with data)`);
      }
    }
    
    console.log(`\n🤔 ANALYSIS:`);
    console.log(`   - ${playerInfo.nickname} played ${totalGames} actual Dota games`);
    console.log(`   - Fantasy system has performance data for ${gameDetails.filter(g => g.hasPerformance).length} games`);
    
    if (totalGames > 0 && gameDetails.filter(g => g.hasPerformance).length === 0) {
      console.log(`   - ⚠️  This explains why ${playerInfo.nickname} has issues in fantasy leaderboard!`);
      console.log(`   - ⚠️  Performance records are missing despite playing actual games`);
    } else if (totalGames > 0 && gameDetails.filter(g => g.hasPerformance).length > 0) {
      console.log(`   - ✅ ${playerInfo.nickname} has proper game and performance data`);
    }
    
  } catch (error) {
    console.error('❌ Error searching for player games:', error);
  }
}

// Run the script
if (require.main === module) {
  findPlayerGamesBySteam32().then(() => {
    process.exit(0);
  }).catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
}

module.exports = { findPlayerGamesBySteam32 };