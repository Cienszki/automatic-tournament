// Node.js script to inspect Firestore database structure
const admin = require('firebase-admin');
const dotenv = require('dotenv');

// Load .env.local file specifically
dotenv.config({ path: '.env.local' });

// Initialize Firebase Admin SDK
const base64EncodedServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
if (!base64EncodedServiceAccount) {
  console.error('FIREBASE_SERVICE_ACCOUNT_BASE64 not set');
  process.exit(1);
}

const serviceAccount = JSON.parse(Buffer.from(base64EncodedServiceAccount, 'base64').toString('utf-8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function inspectDatabase() {
  try {
    console.log('=== INSPECTING DATABASE STRUCTURE ===\n');

    // 1. Get the specific match mentioned
    const matchId = 'KWrwrjEWK7yL7r6GOipp';
    console.log(`1. Getting match document: ${matchId}`);
    const matchDoc = await db.collection('matches').doc(matchId).get();
    
    if (!matchDoc.exists) {
      console.log('Match document not found');
    } else {
      console.log('Match document data:');
      console.log(JSON.stringify(matchDoc.data(), null, 2));
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // 2. Get games subcollection for this match
    console.log(`2. Getting games subcollection for match: ${matchId}`);
    const gamesSnapshot = await db.collection('matches').doc(matchId).collection('games').get();
    
    if (gamesSnapshot.empty) {
      console.log('No games found for this match');
    } else {
      console.log(`Found ${gamesSnapshot.docs.length} games:`);
      gamesSnapshot.docs.forEach((doc, index) => {
        console.log(`\nGame ${index + 1} (ID: ${doc.id}):`);
        console.log(JSON.stringify(doc.data(), null, 2));
      });
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // 3. Get performances for all games
    for (const gameDoc of gamesSnapshot.docs) {
      const gameId = gameDoc.id;
      console.log(`3. Getting performances for game: ${gameId}`);
      
      const performancesSnapshot = await db.collection('matches').doc(matchId)
        .collection('games').doc(gameId)
        .collection('performances').get();
      
      if (performancesSnapshot.empty) {
        console.log(`No performances found for game ${gameId}`);
      } else {
        console.log(`Found ${performancesSnapshot.docs.length} performances for game ${gameId}:`);
        performancesSnapshot.docs.forEach((doc, index) => {
          console.log(`\nPerformance ${index + 1} (ID: ${doc.id}):`);
          console.log(JSON.stringify(doc.data(), null, 2));
        });
      }
      console.log('\n' + '-'.repeat(40));
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // 4. Get a few other matches to compare structure
    console.log('4. Getting other matches for comparison:');
    const matchesSnapshot = await db.collection('matches').limit(3).get();
    
    for (const matchDoc of matchesSnapshot.docs) {
      if (matchDoc.id === matchId) continue; // Skip the one we already processed
      
      console.log(`\nMatch ID: ${matchDoc.id}`);
      console.log('Match data:');
      console.log(JSON.stringify(matchDoc.data(), null, 2));
      
      // Get one game from this match
      const gamesSnapshot = await db.collection('matches').doc(matchDoc.id).collection('games').limit(1).get();
      if (!gamesSnapshot.empty) {
        const gameDoc = gamesSnapshot.docs[0];
        console.log(`\nFirst game (ID: ${gameDoc.id}):`);
        console.log(JSON.stringify(gameDoc.data(), null, 2));
      }
      
      console.log('\n' + '-'.repeat(40));
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // 5. Get teams collection to see team structure
    console.log('5. Getting teams collection:');
    const teamsSnapshot = await db.collection('teams').get();
    
    console.log(`Found ${teamsSnapshot.docs.length} teams:`);
    teamsSnapshot.docs.forEach((doc) => {
      console.log(`\nTeam ID: ${doc.id}`);
      console.log(JSON.stringify(doc.data(), null, 2));
    });

  } catch (error) {
    console.error('Error inspecting database:', error);
  }
}

inspectDatabase().then(() => {
  console.log('\n=== INSPECTION COMPLETE ===');
  process.exit(0);
}).catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});