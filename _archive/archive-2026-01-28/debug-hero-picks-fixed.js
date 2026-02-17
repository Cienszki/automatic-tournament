// Debug hero picks and field names
require('dotenv').config({ path: '.env.local' });
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { credential } = require('firebase-admin');

const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
const serviceAccount = JSON.parse(Buffer.from(serviceAccountBase64, 'base64').toString('utf-8'));
initializeApp({ credential: credential.cert(serviceAccount) });

const db = getFirestore();

async function checkHeroPicksData() {
  try {
    console.log('=== Hero Picks Analysis ===');
    
    // Check if hero data collection exists
    const heroSnapshot = await db.collection('heroes').limit(5).get();
    if (heroSnapshot.empty) {
      console.log('No heroes collection found');
    } else {
      console.log('Sample hero documents:');
      heroSnapshot.forEach(doc => {
        console.log('Hero ID:', doc.id, 'Data:', doc.data());
      });
    }
    
    // Check pick/ban data structure
    console.log('\n=== Pick/Ban Analysis ===');
    const matchSnapshot = await db.collection('matches').limit(1).get();
    if (!matchSnapshot.empty) {
      const matchDoc = matchSnapshot.docs[0];
      console.log('Sample match for picks/bans:', matchDoc.id);
      
      const gamesSnapshot = await matchDoc.ref.collection('games').limit(1).get();
      if (!gamesSnapshot.empty) {
        const gameDoc = gamesSnapshot.docs[0];
        const gameData = gameDoc.data();
        console.log('Game picksBans field exists:', !!gameData.picksBans);
        
        if (gameData.picksBans && gameData.picksBans.length > 0) {
          console.log('Number of pick/ban entries:', gameData.picksBans.length);
          console.log('Sample pick/ban entry:', gameData.picksBans[0]);
          console.log('Pick/ban structure keys:', Object.keys(gameData.picksBans[0] || {}));
        } else {
          console.log('No picksBans data found in game');
          console.log('Available game keys:', Object.keys(gameData));
        }
      }
    }
    
    // Check performance data for hero field
    console.log('\n=== Performance Hero Field Analysis ===');
    const performanceSnapshot = await db.collectionGroup('performances').limit(3).get();
    if (!performanceSnapshot.empty) {
      performanceSnapshot.forEach(doc => {
        const data = doc.data();
        console.log('Performance doc hero data:');
        console.log('- heroId:', data.heroId);
        console.log('- heroName:', data.heroName);
        console.log('- hero:', data.hero);
        console.log('Available keys:', Object.keys(data));
        console.log('---');
      });
    }
    
    console.log('\n=== Field Name Summary ===');
    console.log('Ward fields to use: obsPlaced, senPlaced, observerKills, sentryKills');
    console.log('Gold field to use: netWorth (not gold_earned)');
    console.log('Hero ID field: heroId');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit();
  }
}

checkHeroPicksData();
