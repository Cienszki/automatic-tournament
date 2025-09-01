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

async function findMissingGame() {
  console.log('🔍 Looking for missing 6th game and comparing game structures...\n');
  
  try {
    // CINCO PERROS player IDs from API data
    const cincoPerrosPlayers = [
      { playerId: "HsMv06e5VSBpzpkBsNQd", nickname: "Juxi1337", role: "Carry" },
      { playerId: "7sXBiIbXSl5ijRV0weub", nickname: "Joxxi", role: "Mid" },
      { playerId: "GJUf61LWQo85fHSf9Jr8", nickname: "SZYMI", role: "Offlane" },
      { playerId: "UVkSkax9ePXxQWIniYIV", nickname: "kero", role: "Soft Support" },
      { playerId: "zuPIOY1NbX6zpHdaiwA8", nickname: "Abedzik", role: "Hard Support" }
    ];
    
    console.log('🎯 Searching for all games containing CINCO PERROS players...\n');
    
    // Search through all matches for games with CINCO PERROS players
    const matchesSnapshot = await db.collection('matches').get();
    const allGames = [];
    
    for (const matchDoc of matchesSnapshot.docs) {
      const matchId = matchDoc.id;
      const matchData = matchDoc.data();
      
      const gamesSnapshot = await matchDoc.ref.collection('games').get();
      
      for (const gameDoc of gamesSnapshot.docs) {
        const gameId = gameDoc.id;
        const gameData = gameDoc.data();
        
        // Check if any CINCO PERROS players have performances in this game
        const performancesSnapshot = await gameDoc.ref.collection('performances').get();
        
        let cincoPerrosPlayerCount = 0;
        const foundPlayers = [];
        
        for (const perfDoc of performancesSnapshot.docs) {
          const playerId = perfDoc.id;
          const player = cincoPerrosPlayers.find(p => p.playerId === playerId);
          
          if (player) {
            cincoPerrosPlayerCount++;
            foundPlayers.push({
              ...player,
              fantasyPoints: perfDoc.data().fantasyPoints || 0
            });
          }
        }
        
        // If we found any CINCO PERROS players, this is a relevant game
        if (cincoPerrosPlayerCount > 0) {
          allGames.push({
            matchId,
            gameId,
            round: matchData.group_id || matchData.roundId || matchData.round || 'unknown',
            gameDate: gameData.start_time ? new Date(gameData.start_time * 1000).toISOString() : 'unknown',
            gameDuration: gameData.duration || 0,
            cincoPerrosPlayerCount,
            foundPlayers,
            gameData: {
              hasRadiantTeam: !!gameData.radiant_team,
              hasRadiantPlayers: !!(gameData.radiant_team?.players),
              hasDireTeam: !!gameData.dire_team,
              hasDirePlayers: !!(gameData.dire_team?.players),
              isParsed: gameData.isParsed,
              gameDataKeys: Object.keys(gameData).sort()
            },
            totalPerformances: performancesSnapshot.docs.length
          });
        }
      }
    }
    
    // Sort games by date
    allGames.sort((a, b) => new Date(a.gameDate).getTime() - new Date(b.gameDate).getTime());
    
    console.log(`📊 FOUND ${allGames.length} GAMES WITH CINCO PERROS PLAYERS:\n`);
    
    allGames.forEach((game, index) => {
      console.log(`${index + 1}. Game ID: ${game.gameId}`);
      console.log(`   Match: ${game.matchId.substring(0, 8)}...`);
      console.log(`   Date: ${game.gameDate.substring(0, 16).replace('T', ' ')}`);
      console.log(`   Round: ${game.round}`);
      console.log(`   CINCO PERROS Players: ${game.cincoPerrosPlayerCount}/5`);
      console.log(`   Total Performances: ${game.totalPerformances}`);
      console.log(`   Found Players: ${game.foundPlayers.map(p => `${p.nickname} (${p.fantasyPoints.toFixed(1)}pts)`).join(', ')}`);
      
      // Show game data structure info
      console.log(`   📋 Game Data Structure:`);
      console.log(`      Keys: ${game.gameData.gameDataKeys.join(', ')}`);
      console.log(`      Radiant Team: ${game.gameData.hasRadiantTeam ? '✅' : '❌'}`);
      console.log(`      Radiant Players: ${game.gameData.hasRadiantPlayers ? '✅' : '❌'}`);
      console.log(`      Dire Team: ${game.gameData.hasDireTeam ? '✅' : '❌'}`);
      console.log(`      Dire Players: ${game.gameData.hasDirePlayers ? '✅' : '❌'}`);
      console.log(`      Is Parsed: ${game.gameData.isParsed}`);
      
      console.log();
    });
    
    console.log(`\n🔍 ANALYSIS:`);
    console.log(`   Total games found: ${allGames.length}`);
    
    // Check for games with incomplete player data
    const incompleteGames = allGames.filter(g => g.cincoPerrosPlayerCount < 5);
    const completeGames = allGames.filter(g => g.cincoPerrosPlayerCount === 5);
    
    console.log(`   Complete games (5/5 players): ${completeGames.length}`);
    console.log(`   Incomplete games (<5 players): ${incompleteGames.length}`);
    
    if (incompleteGames.length > 0) {
      console.log(`\n⚠️  INCOMPLETE GAMES FOUND:`);
      incompleteGames.forEach((game, index) => {
        console.log(`   ${index + 1}. Game ${game.gameId}: ${game.cincoPerrosPlayerCount}/5 players`);
        console.log(`      Missing: ${5 - game.cincoPerrosPlayerCount} players`);
        const foundNicknames = game.foundPlayers.map(p => p.nickname);
        const missingPlayers = cincoPerrosPlayers.filter(p => !foundNicknames.includes(p.nickname));
        console.log(`      Missing Players: ${missingPlayers.map(p => p.nickname).join(', ')}`);
      });
    }
    
    // Look for structural differences
    const gameStructures = allGames.map(g => g.gameData.gameDataKeys.join('|'));
    const uniqueStructures = [...new Set(gameStructures)];
    
    if (uniqueStructures.length > 1) {
      console.log(`\n🚨 DIFFERENT GAME DATA STRUCTURES FOUND:`);
      uniqueStructures.forEach((structure, index) => {
        const gamesWithStructure = allGames.filter(g => g.gameData.gameDataKeys.join('|') === structure);
        console.log(`   Structure ${index + 1}: ${gamesWithStructure.length} games`);
        console.log(`      Keys: ${structure.split('|').join(', ')}`);
        console.log(`      Games: ${gamesWithStructure.map(g => g.gameId).join(', ')}`);
        console.log();
      });
    }
    
  } catch (error) {
    console.error('❌ Error searching for missing game:', error);
  }
}

// Run the script
if (require.main === module) {
  findMissingGame().then(() => {
    process.exit(0);
  }).catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
}

module.exports = { findMissingGame };