// Debug Performance User Mapping Script
// Checks how user IDs are stored in performance documents
require('dotenv').config({ path: '.env.local' });
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { credential } = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
const serviceAccount = JSON.parse(Buffer.from(serviceAccountBase64, 'base64').toString('utf-8'));
initializeApp({ credential: credential.cert(serviceAccount) });

const db = getFirestore();

async function debugPerformanceUserMapping() {
  try {
    console.log('🔍 Debugging Performance-User ID Mapping...\n');

    // Get BeBoy's user info
    const fantasyLineupsRef = db.collection('fantasyLineups');
    const beboyQuery = await fantasyLineupsRef.where('displayName', '==', 'BeBoy').limit(1).get();

    if (beboyQuery.empty) {
      console.log('❌ BeBoy not found');
      return;
    }

    const beboyDoc = beboyQuery.docs[0];
    const beboyUserId = beboyDoc.id;
    const beboyData = beboyDoc.data();

    console.log('👤 BeBoy Info:');
    console.log(`  User ID: ${beboyUserId}`);
    console.log(`  Display Name: ${beboyData.displayName}`);
    console.log(`  Total Games: ${beboyData.gamesPlayed}`);
    console.log(`  User ID from data: ${beboyData.userId}`);

    // Also check in users collection
    const usersRef = db.collection('users');
    const userDoc = await usersRef.doc(beboyUserId).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      console.log(`  Discord username: ${userData.discordUsername}`);
      console.log(`  Steam ID: ${userData.steamId}`);
    }

    // Now check some performances to see what user IDs they have
    console.log('\n📋 Sample Performance Documents:');
    const performancesSnapshot = await db.collectionGroup('performances').limit(10).get();

    performancesSnapshot.forEach((perfDoc, index) => {
      const perfData = perfDoc.data();
      console.log(`\n  Performance ${index + 1}:`);
      console.log(`    Player ID: ${perfData.playerId}`);
      console.log(`    Team ID: ${perfData.teamId}`);
      console.log(`    Hero ID: ${perfData.heroId}`);
      console.log(`    Fantasy Points: ${perfData.fantasyPoints}`);
      console.log(`    Game Path: ${perfDoc.ref.path}`);

      // Check if this could be BeBoy
      if (perfData.playerId === beboyUserId || perfData.playerId === beboyData.userId) {
        console.log(`    🎯 THIS COULD BE BEBOY! (User ID match)`);
      }
    });

    // Let's specifically look for performances that might belong to BeBoy
    console.log('\n🔍 Looking for BeBoy\'s performances...');

    // Try to find by various ID patterns
    const possibleBeboyIds = [
      beboyUserId,
      beboyData.userId,
      '1uTIoCrW2vaa0rMy04MR55Pt3GA2' // From the debug output
    ].filter(id => id);

    console.log(`Searching for these possible BeBoy IDs: ${possibleBeboyIds.join(', ')}`);

    let foundPerformances = 0;
    const allPerformances = await db.collectionGroup('performances').get();

    allPerformances.forEach(perfDoc => {
      const perfData = perfDoc.data();

      if (possibleBeboyIds.includes(perfData.playerId)) {
        foundPerformances++;
        if (foundPerformances <= 5) { // Show first 5
          console.log(`\n  Found BeBoy performance #${foundPerformances}:`);
          console.log(`    Player ID: ${perfData.playerId}`);
          console.log(`    Team ID: ${perfData.teamId}`);
          console.log(`    Hero ID: ${perfData.heroId}`);
          console.log(`    Fantasy Points: ${perfData.fantasyPoints}`);
          console.log(`    K/D/A: ${perfData.kills}/${perfData.deaths}/${perfData.assists}`);
          console.log(`    Game Path: ${perfDoc.ref.path}`);
        }
      }
    });

    console.log(`\n📊 Total BeBoy performances found: ${foundPerformances}`);

    if (foundPerformances === 0) {
      console.log('\n❌ NO PERFORMANCES FOUND FOR BEBOY!');
      console.log('This explains why the game count is wrong.');
      console.log('The user ID mapping in the recalculation is broken.');
    } else if (foundPerformances !== beboyData.gamesPlayed) {
      console.log(`\n⚠️  MISMATCH: Found ${foundPerformances} performances but database shows ${beboyData.gamesPlayed} games`);
    } else {
      console.log('\n✅ Performance count matches database');
    }

    console.log('\n✅ Debug analysis complete!');

  } catch (error) {
    console.error('❌ Error during debug analysis:', error);
  } finally {
    process.exit();
  }
}

debugPerformanceUserMapping();