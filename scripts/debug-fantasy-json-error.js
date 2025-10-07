// Debug Fantasy JSON Error Script
// Tests the fantasy recalculation to identify JSON parsing issues
require('dotenv').config({ path: '.env.local' });
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { credential } = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
if (!serviceAccountBase64) {
  console.error('FIREBASE_SERVICE_ACCOUNT_BASE64 environment variable is not set');
  process.exit(1);
}

const serviceAccount = JSON.parse(Buffer.from(serviceAccountBase64, 'base64').toString('utf-8'));
initializeApp({ credential: credential.cert(serviceAccount) });

const db = getFirestore();

async function debugFantasyJSONError() {
  try {
    console.log('🔍 Debugging Fantasy JSON parsing error...\n');

    // Step 1: Check fantasy lineups for potential JSON issues
    console.log('📊 Checking fantasy lineups collection...');
    const fantasyLineupsRef = db.collection('fantasyLineups');
    const lineupsSnap = await fantasyLineupsRef.limit(5).get();

    console.log(`Found ${lineupsSnap.size} fantasy lineup documents`);

    if (!lineupsSnap.empty) {
      for (const userDoc of lineupsSnap.docs) {
        const userId = userDoc.id;
        const userData = userDoc.data();

        console.log(`\n--- User: ${userId} ---`);
        console.log('User data keys:', Object.keys(userData));
        console.log('Display name:', userData.displayName);
        console.log('Total score:', userData.totalFantasyScore);

        // Check rounds subcollection
        try {
          const userRoundsRef = userDoc.ref.collection('rounds');
          const userRoundsSnap = await userRoundsRef.limit(3).get();

          console.log(`Rounds found: ${userRoundsSnap.size}`);

          for (const roundDoc of userRoundsSnap.docs) {
            const roundId = roundDoc.id;
            const roundData = roundDoc.data();

            console.log(`  Round ${roundId}:`);
            console.log(`    Keys: ${Object.keys(roundData).join(', ')}`);

            // Check lineup structure
            if (roundData.lineup) {
              console.log(`    Lineup type: ${typeof roundData.lineup}`);

              if (typeof roundData.lineup === 'string') {
                console.log('    ⚠️  LINEUP IS STRING - might need JSON parsing');
                console.log(`    Lineup content: ${roundData.lineup.substring(0, 100)}...`);

                try {
                  const parsedLineup = JSON.parse(roundData.lineup);
                  console.log('    ✅ JSON parse successful');
                  console.log(`    Parsed lineup keys: ${Object.keys(parsedLineup).join(', ')}`);
                } catch (parseError) {
                  console.log('    ❌ JSON parse failed:', parseError.message);
                  console.log(`    Raw lineup: ${roundData.lineup}`);
                }
              } else if (typeof roundData.lineup === 'object') {
                console.log('    ✅ Lineup is already an object');
                console.log(`    Lineup keys: ${Object.keys(roundData.lineup).join(', ')}`);
              } else {
                console.log(`    ⚠️  Unexpected lineup type: ${typeof roundData.lineup}`);
              }
            } else {
              console.log('    ⚠️  No lineup field found');
            }
          }
        } catch (roundError) {
          console.log(`    ❌ Error accessing rounds: ${roundError.message}`);
        }
      }
    }

    // Step 2: Check for any corrupted documents
    console.log('\n🔍 Checking for documents with potential JSON issues...');

    try {
      const testRef = db.collection('fantasyLineups');
      const testSnap = await testRef.get();

      let corruptedDocs = 0;

      for (const doc of testSnap.docs) {
        try {
          const data = doc.data();
          // Try to stringify and parse to detect issues
          const jsonString = JSON.stringify(data);
          JSON.parse(jsonString);
        } catch (error) {
          console.log(`❌ Document ${doc.id} has JSON serialization issues:`, error.message);
          corruptedDocs++;
        }
      }

      console.log(`Checked ${testSnap.size} documents, found ${corruptedDocs} with potential issues`);

    } catch (error) {
      console.log('❌ Error during document check:', error.message);
    }

    // Step 3: Check users collection for potential issues
    console.log('\n👥 Checking users collection...');
    const usersRef = db.collection('users');
    const usersSnap = await usersRef.limit(3).get();

    for (const userDoc of usersSnap.docs) {
      const userData = userDoc.data();
      console.log(`User ${userDoc.id}:`);
      console.log(`  Discord username: ${userData.discordUsername}`);
      console.log(`  Display name: ${userData.displayName}`);

      // Check for any string fields that might contain JSON
      Object.entries(userData).forEach(([key, value]) => {
        if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
          console.log(`  ⚠️  ${key} might be JSON string: ${value.substring(0, 50)}...`);
        }
      });
    }

    console.log('\n✅ Debug analysis complete!');
    console.log('\nPossible causes of JSON parsing error:');
    console.log('1. Lineup data stored as JSON strings instead of objects');
    console.log('2. Corrupted documents with malformed JSON');
    console.log('3. Invalid character encoding in document fields');
    console.log('4. Network/connection issues during data retrieval');

  } catch (error) {
    console.error('❌ Error during debug analysis:', error);

    if (error.message.includes('JSON.parse')) {
      console.log('\n🚨 JSON Parse Error Details:');
      console.log('This error likely occurs when trying to parse malformed JSON data');
      console.log('Check for documents with string fields that should be objects');
    }
  } finally {
    process.exit();
  }
}

debugFantasyJSONError();