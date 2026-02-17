// Detailed analysis of a single performance document
require('dotenv').config({ path: '.env.local' });
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { credential } = require('firebase-admin');

const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
const serviceAccount = JSON.parse(Buffer.from(serviceAccountBase64, 'base64').toString('utf-8'));
initializeApp({ credential: credential.cert(serviceAccount) });

const db = getFirestore();

async function detailedPerformanceAnalysis() {
  try {
    console.log('=== Detailed Performance Analysis ===');
    
    // Get one specific match
    const matchSnapshot = await db.collection('matches').limit(1).get();
    if (matchSnapshot.empty) {
      console.log('No matches found');
      return;
    }
    
    const matchDoc = matchSnapshot.docs[0];
    console.log('Analyzing match:', matchDoc.id);
    
    // Get one game from this match
    const gamesSnapshot = await matchDoc.ref.collection('games').limit(1).get();
    if (gamesSnapshot.empty) {
      console.log('No games found in match');
      return;
    }
    
    const gameDoc = gamesSnapshot.docs[0];
    console.log('Analyzing game:', gameDoc.id);
    
    // Get all performances from this game
    const performancesSnapshot = await gameDoc.ref.collection('performances').get();
    console.log('Found', performancesSnapshot.size, 'performance documents');
    
    if (performancesSnapshot.size > 0) {
      const perfDoc = performancesSnapshot.docs[0];
      const perfData = perfDoc.data();
      
      console.log('\nDetailed Performance Data:');
      console.log('Document ID:', perfDoc.id);
      console.log('Full document data:', JSON.stringify(perfData, null, 2));
      
      console.log('\nSpecific Field Values:');
      console.log('- netWorth:', perfData.netWorth);
      console.log('- obsPlaced:', perfData.obsPlaced);  
      console.log('- senPlaced:', perfData.senPlaced);
      console.log('- observerKills:', perfData.observerKills);
      console.log('- sentryKills:', perfData.sentryKills);
      console.log('- heroId:', perfData.heroId);
      console.log('- firstBloodClaimed:', perfData.firstBloodClaimed);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit();
  }
}

detailedPerformanceAnalysis();
