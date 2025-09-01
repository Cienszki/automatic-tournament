#!/usr/bin/env node
require('dotenv').config({ path: __dirname + '/../.env.local' });
const admin = require('firebase-admin');

const serviceAccount = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf-8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function inspectLineupStructure() {
  console.log('=== INSPECTING LINEUP STRUCTURE ===');
  
  const fantasySnapshot = await db.collection('fantasyLineups').limit(5).get();
  
  for (const userDoc of fantasySnapshot.docs) {
    const userData = userDoc.data();
    console.log(`\n--- User: ${userData.displayName} ---`);
    
    // Get rounds data
    const roundsSnapshot = await db.collection('fantasyLineups').doc(userDoc.id).collection('rounds').get();
    console.log(`Rounds: ${roundsSnapshot.size}`);
    
    for (const roundDoc of roundsSnapshot.docs) {
      const roundData = roundDoc.data();
      console.log(`\nRound: ${roundDoc.id}`);
      console.log('Keys in round:', Object.keys(roundData));
      
      if (roundData.lineup) {
        console.log('Lineup keys:', Object.keys(roundData.lineup));
        console.log('Lineup structure:', JSON.stringify(roundData.lineup, null, 2));
      } else {
        console.log('No lineup field found');
        console.log('Full round data:', JSON.stringify(roundData, null, 2));
      }
      
      break; // Only show first round for brevity
    }
  }
}

inspectLineupStructure().catch(console.error);