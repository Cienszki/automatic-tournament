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

async function removeDuplicateGame() {
  console.log('🗑️  Removing duplicate Game 8427125277 from incorrect match...\n');
  
  try {
    // The INCORRECT match (CINCO PERROS vs Pora na Przygode) - this is where we remove the duplicate
    const incorrectMatchId = "KWrwrjEWK7yL7r6GOipp";
    const correctMatchId = "o2H30RJvnYByDcM2dINB"; // CINCO PERROS vs gwiazda
    const gameId = "8427125277";
    
    console.log('📋 MATCH ANALYSIS:');
    console.log(`   ✅ CORRECT match: ${correctMatchId} (CINCO PERROS vs gwiazda)`);
    console.log(`   ❌ INCORRECT match: ${incorrectMatchId} (CINCO PERROS vs Pora na Przygode)`);
    console.log(`   🎯 Removing Game ${gameId} from the INCORRECT match\n`);
    
    const incorrectMatchDoc = await db.collection('matches').doc(incorrectMatchId).get();
    
    if (!incorrectMatchDoc.exists) {
      throw new Error(`Match ${incorrectMatchId} not found`);
    }
    
    const matchData = incorrectMatchDoc.data();
    console.log(`📍 Current game_ids in incorrect match: ${JSON.stringify(matchData.game_ids || [])}`);
    
    // Check if the game document exists in this match
    const gameDoc = await incorrectMatchDoc.ref.collection('games').doc(gameId).get();
    if (!gameDoc.exists) {
      console.log(`⚠️  Game ${gameId} document doesn't exist in this match, only removing from game_ids array`);
    } else {
      // Delete all performance documents first
      console.log('\n🗑️  Deleting performance documents from incorrect match...');
      const performancesSnapshot = await gameDoc.ref.collection('performances').get();
      
      if (performancesSnapshot.docs.length > 0) {
        const batch = db.batch();
        performancesSnapshot.docs.forEach(perfDoc => {
          batch.delete(perfDoc.ref);
        });
        
        await batch.commit();
        console.log(`   ✅ Deleted ${performancesSnapshot.docs.length} performance documents`);
      }
      
      // Delete the game document
      console.log('\n🗑️  Deleting game document from incorrect match...');
      await gameDoc.ref.delete();
      console.log('   ✅ Game document deleted');
    }
    
    // Update match game_ids array to remove the duplicate
    if (matchData.game_ids && Array.isArray(matchData.game_ids)) {
      const updatedGameIds = matchData.game_ids.filter(id => id != gameId && id !== gameId);
      
      console.log('\n📝 Updating match game_ids array...');
      console.log(`   Old game_ids: ${JSON.stringify(matchData.game_ids)}`);
      console.log(`   New game_ids: ${JSON.stringify(updatedGameIds)}`);
      
      await incorrectMatchDoc.ref.update({
        game_ids: updatedGameIds
      });
      
      console.log('   ✅ Match game_ids updated');
    }
    
    // Verify the correct match still has the game
    console.log('\n🔍 Verifying correct match still has the game...');
    const correctMatchDoc = await db.collection('matches').doc(correctMatchId).get();
    const correctMatchData = correctMatchDoc.data();
    const correctGameDoc = await correctMatchDoc.ref.collection('games').doc(gameId).get();
    
    console.log(`   Correct match game_ids: ${JSON.stringify(correctMatchData.game_ids || [])}`);
    console.log(`   Game document exists: ${correctGameDoc.exists ? '✅' : '❌'}`);
    
    if (correctGameDoc.exists) {
      const performancesSnapshot = await correctGameDoc.ref.collection('performances').get();
      console.log(`   Performance documents: ${performancesSnapshot.docs.length}`);
    }
    
    console.log('\n🎉 SUCCESS! Duplicate removal completed!')
    console.log('\n📋 SUMMARY:');
    console.log(`   ✅ Removed Game ${gameId} from CINCO PERROS vs Pora na Przygode match`);
    console.log(`   ✅ Game ${gameId} remains in CINCO PERROS vs gwiazda match (correct)`);
    console.log(`   ✅ CINCO PERROS now has proper game distribution across matches`);
    
    console.log('\n📋 NEXT STEPS:');
    console.log('   1. Run fantasy recalculation to update all scores');
    console.log('   2. Verify that .joxxi now has 30 fantasy games (6 games × 5 players)');
    console.log('   3. Check that CINCO PERROS players show correct game counts');
    
  } catch (error) {
    console.error('❌ Error removing duplicate game:', error);
  }
}

// Run the script
if (require.main === module) {
  removeDuplicateGame().then(() => {
    process.exit(0);
  }).catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
}

module.exports = { removeDuplicateGame };