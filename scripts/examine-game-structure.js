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

async function examineGameStructure() {
  console.log('🔍 Examining game data structure...\n');
  
  try {
    // Get the first few matches
    const matchesSnapshot = await db.collection('matches').limit(3).get();
    
    for (const matchDoc of matchesSnapshot.docs) {
      const matchId = matchDoc.id;
      const matchData = matchDoc.data();
      
      console.log(`📋 Match: ${matchId}`);
      console.log(`   Match data keys: ${Object.keys(matchData).join(', ')}`);
      
      // Get first game from this match
      const gamesSnapshot = await matchDoc.ref.collection('games').limit(1).get();
      
      for (const gameDoc of gamesSnapshot.docs) {
        const gameId = gameDoc.id;
        const gameData = gameDoc.data();
        
        console.log(`\n🎮 Game: ${gameId}`);
        console.log(`   Game data keys: ${Object.keys(gameData).join(', ')}`);
        
        // Examine team structures
        if (gameData.radiant_team) {
          console.log(`\n   📊 Radiant Team Structure:`);
          console.log(`      Team keys: ${Object.keys(gameData.radiant_team).join(', ')}`);
          
          if (gameData.radiant_team.players && Array.isArray(gameData.radiant_team.players)) {
            console.log(`      Players count: ${gameData.radiant_team.players.length}`);
            
            gameData.radiant_team.players.slice(0, 2).forEach((player, index) => {
              console.log(`      Player ${index + 1}:`);
              console.log(`         Keys: ${Object.keys(player).join(', ')}`);
              if (player.account_id) {
                console.log(`         Account ID: ${player.account_id}`);
              }
              if (player.player_slot !== undefined) {
                console.log(`         Player Slot: ${player.player_slot}`);
              }
            });
          }
        }
        
        if (gameData.dire_team) {
          console.log(`\n   📊 Dire Team Structure:`);
          console.log(`      Team keys: ${Object.keys(gameData.dire_team).join(', ')}`);
          
          if (gameData.dire_team.players && Array.isArray(gameData.dire_team.players)) {
            console.log(`      Players count: ${gameData.dire_team.players.length}`);
            
            gameData.dire_team.players.slice(0, 2).forEach((player, index) => {
              console.log(`      Player ${index + 1}:`);
              console.log(`         Keys: ${Object.keys(player).join(', ')}`);
              if (player.account_id) {
                console.log(`         Account ID: ${player.account_id}`);
              }
              if (player.player_slot !== undefined) {
                console.log(`         Player Slot: ${player.player_slot}`);
              }
            });
          }
        }
        
        // Check performances collection
        const performancesSnapshot = await gameDoc.ref.collection('performances').limit(3).get();
        console.log(`\n   🎯 Performances Collection:`);
        console.log(`      Performance docs count: ${performancesSnapshot.docs.length}`);
        
        performancesSnapshot.docs.forEach((perfDoc, index) => {
          const perfData = perfDoc.data();
          console.log(`      Performance ${index + 1} (${perfDoc.id}):`);
          console.log(`         Keys: ${Object.keys(perfData).slice(0, 8).join(', ')}...`);
          if (perfData.fantasyPoints !== undefined) {
            console.log(`         Fantasy Points: ${perfData.fantasyPoints}`);
          }
        });
        
        console.log('\n' + '='.repeat(80));
        return; // Just examine the first game
      }
    }
    
  } catch (error) {
    console.error('❌ Error examining game structure:', error);
  }
}

// Run the script
if (require.main === module) {
  examineGameStructure().then(() => {
    process.exit(0);
  }).catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
}

module.exports = { examineGameStructure };