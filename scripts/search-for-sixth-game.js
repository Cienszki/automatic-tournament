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

async function searchForSixthGame() {
  console.log('🔍 Searching for the missing 6th game...\n');
  
  try {
    console.log('📊 First, let\'s check all games with manually imported data or unusual structures...\n');
    
    const matchesSnapshot = await db.collection('matches').get();
    const suspiciousGames = [];
    const allGamesData = [];
    
    for (const matchDoc of matchesSnapshot.docs) {
      const matchId = matchDoc.id;
      const matchData = matchDoc.data();
      
      const gamesSnapshot = await matchDoc.ref.collection('games').get();
      
      for (const gameDoc of gamesSnapshot.docs) {
        const gameId = gameDoc.id;
        const gameData = gameDoc.data();
        
        allGamesData.push({
          matchId,
          gameId,
          gameData,
          round: matchData.group_id || matchData.roundId || matchData.round || 'unknown'
        });
        
        // Look for games with suspicious characteristics
        const isSuspicious = (
          gameData.isManualImport || 
          !gameData.radiant_team ||
          !gameData.dire_team ||
          Object.keys(gameData).includes('radiant_score') ||
          Object.keys(gameData).includes('dire_score') ||
          Object.keys(gameData).includes('first_blood_time')
        );
        
        if (isSuspicious) {
          const performancesSnapshot = await gameDoc.ref.collection('performances').get();
          
          suspiciousGames.push({
            matchId,
            gameId,
            round: matchData.group_id || matchData.roundId || matchData.round || 'unknown',
            gameDate: gameData.start_time ? new Date(gameData.start_time * 1000).toISOString() : 'unknown',
            performanceCount: performancesSnapshot.docs.length,
            gameDataKeys: Object.keys(gameData).sort(),
            hasRadiantTeam: !!gameData.radiant_team,
            hasDireTeam: !!gameData.dire_team,
            isManualImport: gameData.isManualImport,
            performancePlayerIds: performancesSnapshot.docs.map(doc => doc.id)
          });
        }
      }
    }
    
    console.log(`🚨 FOUND ${suspiciousGames.length} SUSPICIOUS GAMES (manual imports or unusual structure):\n`);
    
    suspiciousGames.forEach((game, index) => {
      console.log(`${index + 1}. Game ID: ${game.gameId}`);
      console.log(`   Match: ${game.matchId.substring(0, 8)}...`);
      console.log(`   Date: ${game.gameDate.substring(0, 16).replace('T', ' ')}`);
      console.log(`   Round: ${game.round}`);
      console.log(`   Performance Count: ${game.performanceCount}`);
      console.log(`   Performance Player IDs: ${game.performancePlayerIds.slice(0, 3).join(', ')}${game.performancePlayerIds.length > 3 ? '...' : ''}`);
      console.log(`   Has Radiant Team: ${game.hasRadiantTeam ? '✅' : '❌'}`);
      console.log(`   Has Dire Team: ${game.hasDireTeam ? '✅' : '❌'}`);
      console.log(`   Manual Import: ${game.isManualImport ? '✅' : '❌'}`);
      console.log(`   Keys: ${game.gameDataKeys.join(', ')}`);
      console.log();
    });
    
    // Now let's check for any games that might have CINCO PERROS players but weren't counted
    console.log('🔍 Checking for games with partial CINCO PERROS player data...\n');
    
    const cincoPerrosPlayerIds = [
      "HsMv06e5VSBpzpkBsNQd", // Juxi1337
      "7sXBiIbXSl5ijRV0weub", // Joxxi  
      "GJUf61LWQo85fHSf9Jr8", // SZYMI
      "UVkSkax9ePXxQWIniYIV", // kero
      "zuPIOY1NbX6zpHdaiwA8"  // Abedzik
    ];
    
    for (const suspiciousGame of suspiciousGames) {
      const matchDoc = await db.collection('matches').doc(suspiciousGame.matchId).get();
      const gameDoc = await matchDoc.ref.collection('games').doc(suspiciousGame.gameId).get();
      const performancesSnapshot = await gameDoc.ref.collection('performances').get();
      
      let cincoPerrosCount = 0;
      const foundCincoPerros = [];
      
      performancesSnapshot.docs.forEach(perfDoc => {
        if (cincoPerrosPlayerIds.includes(perfDoc.id)) {
          cincoPerrosCount++;
          foundCincoPerros.push(perfDoc.id);
        }
      });
      
      if (cincoPerrosCount > 0) {
        console.log(`🎯 Game ${suspiciousGame.gameId} has ${cincoPerrosCount} CINCO PERROS players:`);
        console.log(`   Found Player IDs: ${foundCincoPerros.join(', ')}`);
        console.log();
      }
    }
    
    // Let's also check for any games that might be missing from our main search
    console.log('🔍 Looking for any other games around the same dates...\n');
    
    const knownGameIds = [
      '8422934138', '8425659528', '8425728381', '8427048629', '8427125277'
    ];
    
    const gamesInDateRange = allGamesData.filter(game => {
      if (!game.gameData.start_time) return false;
      const gameDate = new Date(game.gameData.start_time * 1000);
      const startDate = new Date('2025-08-18');
      const endDate = new Date('2025-08-26');
      return gameDate >= startDate && gameDate <= endDate;
    });
    
    console.log(`📅 Found ${gamesInDateRange.length} games in date range (Aug 18-26, 2025):`);
    
    gamesInDateRange
      .sort((a, b) => (a.gameData.start_time || 0) - (b.gameData.start_time || 0))
      .forEach((game, index) => {
        const isKnown = knownGameIds.includes(game.gameId);
        const gameDate = game.gameData.start_time ? new Date(game.gameData.start_time * 1000).toISOString() : 'unknown';
        
        console.log(`   ${index + 1}. ${game.gameId} ${isKnown ? '(KNOWN)' : '(NEW)'} - ${gameDate.substring(0, 16).replace('T', ' ')}`);
      });
    
  } catch (error) {
    console.error('❌ Error searching for sixth game:', error);
  }
}

// Run the script
if (require.main === module) {
  searchForSixthGame().then(() => {
    process.exit(0);
  }).catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
}

module.exports = { searchForSixthGame };