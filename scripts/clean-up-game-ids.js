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

async function cleanUpGameIds() {
  console.log('🧹 Cleaning up match game_ids array...\n');
  
  try {
    const targetMatchId = "KWrwrjEWK7yL7r6GOipp";
    const matchDoc = await db.collection('matches').doc(targetMatchId).get();
    
    if (!matchDoc.exists) {
      throw new Error(`Match ${targetMatchId} not found`);
    }
    
    const matchData = matchDoc.data();
    console.log(`📋 Current game_ids: ${JSON.stringify(matchData.game_ids || [])}`);
    
    // Remove "2" and ensure we have the correct game IDs
    const cleanGameIds = (matchData.game_ids || [])
      .filter(id => id !== '2' && id !== 2) // Remove both string and number versions
      .filter(id => id !== '8427125277') // Remove duplicates
      .concat(['8427125277']); // Add the correct game ID
    
    console.log(`🧹 Cleaned game_ids: ${JSON.stringify(cleanGameIds)}`);
    
    await matchDoc.ref.update({
      game_ids: cleanGameIds
    });
    
    console.log('✅ Match game_ids cleaned up successfully!');
    
  } catch (error) {
    console.error('❌ Error cleaning up game_ids:', error);
  }
}

// Run the script
if (require.main === module) {
  cleanUpGameIds().then(() => {
    process.exit(0);
  }).catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
}

module.exports = { cleanUpGameIds };