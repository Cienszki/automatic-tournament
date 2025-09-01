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

async function deleteCorruptedGame2() {
  console.log('🗑️  Deleting corrupted Game ID: 2 from the database...\n');
  
  try {
    // Find the match containing Game ID: 2
    const matchesSnapshot = await db.collection('matches').get();
    let targetMatch = null;
    let targetGame = null;
    
    for (const matchDoc of matchesSnapshot.docs) {
      const gamesSnapshot = await matchDoc.ref.collection('games').get();
      
      for (const gameDoc of gamesSnapshot.docs) {
        if (gameDoc.id === '2') {
          targetMatch = matchDoc;
          targetGame = gameDoc;
          console.log(`📍 Found Game ID: 2 in match: ${matchDoc.id}`);
          
          // Get game data for confirmation
          const gameData = gameDoc.data();
          console.log(`   Game Date: ${gameData?.start_time ? new Date(gameData.start_time * 1000).toISOString() : 'unknown'}`);
          console.log(`   Game Data Keys: ${Object.keys(gameData || {}).join(', ')}`);
          
          // Check performances
          const performancesSnapshot = await gameDoc.ref.collection('performances').get();
          console.log(`   Performance Count: ${performancesSnapshot.docs.length}`);
          
          break;
        }
      }
      
      if (targetMatch) break;
    }
    
    if (!targetMatch || !targetGame) {
      console.log('❌ Game ID: 2 not found in database');
      return;
    }
    
    console.log('\n🔍 Before deletion - Match game_ids array:');
    const matchData = targetMatch.data();
    console.log(`   Current game_ids: ${JSON.stringify(matchData.game_ids || [])}`);
    
    // Delete all performances first
    const performancesSnapshot = await targetGame.ref.collection('performances').get();
    if (performancesSnapshot.docs.length > 0) {
      console.log(`\n🗑️  Deleting ${performancesSnapshot.docs.length} performance documents...`);
      
      const batch = db.batch();
      performancesSnapshot.docs.forEach(perfDoc => {
        batch.delete(perfDoc.ref);
      });
      
      await batch.commit();
      console.log('   ✅ All performance documents deleted');
    }
    
    // Delete the game document
    console.log('\n🗑️  Deleting game document...');
    await targetGame.ref.delete();
    console.log('   ✅ Game document deleted');
    
    // Update match game_ids array to remove "2"
    if (matchData.game_ids && Array.isArray(matchData.game_ids)) {
      const updatedGameIds = matchData.game_ids.filter(id => id !== '2');
      
      console.log('\n📝 Updating match game_ids array...');
      console.log(`   Old game_ids: ${JSON.stringify(matchData.game_ids)}`);
      console.log(`   New game_ids: ${JSON.stringify(updatedGameIds)}`);
      
      await targetMatch.ref.update({
        game_ids: updatedGameIds
      });
      
      console.log('   ✅ Match game_ids updated');
    }
    
    console.log('\n🎯 DELETION COMPLETE!');
    console.log('   ✅ Game ID: 2 has been completely removed from the database');
    console.log('   ✅ All associated performance documents deleted');
    console.log('   ✅ Match game_ids array updated');
    
    console.log('\n📋 NEXT STEPS:');
    console.log('   1. Re-run the parsed replay import script to properly import 8427125277');
    console.log('   2. Verify that the match now has proper game IDs');
    console.log('   3. Run fantasy recalculation to update all scores');
    
  } catch (error) {
    console.error('❌ Error deleting corrupted game:', error);
  }
}

// Run the script
if (require.main === module) {
  deleteCorruptedGame2().then(() => {
    process.exit(0);
  }).catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
}

module.exports = { deleteCorruptedGame2 };