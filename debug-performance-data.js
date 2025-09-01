require('dotenv').config({ path: '.env.local' });
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { credential } = require('firebase-admin');

const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
const serviceAccount = JSON.parse(Buffer.from(serviceAccountBase64, 'base64').toString('utf-8'));
initializeApp({ credential: credential.cert(serviceAccount) });

const db = getFirestore();

async function debugPerformanceData() {
  try {
    console.log('=== Sample Performance Data Analysis ===');
    
    // Get first match
    const matchesSnapshot = await db.collection('matches').limit(1).get();
    
    if (matchesSnapshot.empty) {
      console.log('No matches found');
      return;
    }
    
    const match = matchesSnapshot.docs[0];
    console.log(`\nChecking match: ${match.id}`);
    
    // Get first game from this match
    const gamesSnapshot = await db.collection('matches').doc(match.id).collection('games').limit(1).get();
    
    if (gamesSnapshot.empty) {
      console.log('No games found');
      return;
    }
    
    const game = gamesSnapshot.docs[0];
    console.log(`\nChecking game: ${game.id}`);
    console.log('Game data keys:', Object.keys(game.data()));
    
    const gameData = game.data();
    console.log('Game picks_bans:', gameData.picks_bans ? 'EXISTS' : 'MISSING');
    
    // Get performances from this game
    const performancesSnapshot = await db.collection('matches')
      .doc(match.id)
      .collection('games')
      .doc(game.id)
      .collection('performances')
      .limit(1)
      .get();
    
    if (performancesSnapshot.empty) {
      console.log('No performances found');
      return;
    }
    
    const performance = performancesSnapshot.docs[0];
    const perfData = performance.data();
    
    console.log(`\nSample performance document:`);
    console.log('Available fields:', Object.keys(perfData));
    console.log('- kills:', perfData.kills);
    console.log('- deaths:', perfData.deaths);
    console.log('- assists:', perfData.assists);
    console.log('- gold_earned:', perfData.gold_earned);
    console.log('- obs_placed:', perfData.obs_placed);
    console.log('- sen_placed:', perfData.sen_placed);
    console.log('- observer_kills:', perfData.observer_kills);
    console.log('- sentry_kills:', perfData.sentry_kills);
    
    // Check what other gold fields exist
    const goldFields = Object.keys(perfData).filter(key => key.includes('gold'));
    console.log('Gold-related fields:', goldFields);
    
    // Check what other ward fields exist
    const wardFields = Object.keys(perfData).filter(key => key.includes('ward') || key.includes('obs') || key.includes('sen'));
    console.log('Ward-related fields:', wardFields);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

debugPerformanceData();
