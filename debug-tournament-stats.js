require('dotenv').config({ path: '.env.local' });
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { credential } = require('firebase-admin');

const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
const serviceAccount = JSON.parse(Buffer.from(serviceAccountBase64, 'base64').toString('utf-8'));
initializeApp({ credential: credential.cert(serviceAccount) });

const db = getFirestore();

async function debugTournamentStats() {
  try {
    console.log('=== TournamentStats Collection Analysis ===');
    
    const snapshot = await db.collection('tournamentStats').get();
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      console.log(`\nDocument ID: ${doc.id}`);
      console.log(`- Total Games: ${data.totalGames}`);
      console.log(`- Total Kills: ${data.totalKills}`);
      console.log(`- Total Deaths: ${data.totalDeaths}`);
      console.log(`- Total Assists: ${data.totalAssists}`);
      console.log(`- Total Rampages: ${data.totalRampages}`);
      console.log(`- Most Picked Hero:`, data.mostPickedHero);
      console.log(`- Total Hours Played: ${data.totalHoursPlayed}`);
      console.log(`- Average Match Duration: ${data.averageMatchDuration}`);
      console.log(`- Total Rapiers: ${data.totalRapiers}`);
      console.log(`- Total Observer Wards: ${data.totalObserverWardsPlaced}`);
      console.log(`- Total Sentry Wards: ${data.totalSentryWardsPlaced}`);
      console.log(`- Total Gold Generated: ${data.totalGoldGenerated}`);
      console.log(`- Last Updated: ${data.lastUpdated}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

debugTournamentStats();
