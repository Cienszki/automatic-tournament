// Script to delete matches that don't have a tournamentId field
// These are orphaned matches created by the faulty generator

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

const admin = require('firebase-admin');

// Try to load service account from env variable or file
let serviceAccount;

const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
if (serviceAccountBase64) {
  serviceAccount = JSON.parse(Buffer.from(serviceAccountBase64, 'base64').toString('utf8'));
} else {
  try {
    serviceAccount = require('../serviceAccountKey.json');
  } catch (error) {
    console.error('❌ Could not load service account credentials');
    console.error('Either set FIREBASE_SERVICE_ACCOUNT_BASE64 env variable or place serviceAccountKey.json in project root');
    process.exit(1);
  }
}

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function deleteOrphanedMatches() {
  console.log('🔍 Searching for orphaned matches...\n');

  try {
    // Get the tournament ID (adjust this to your tournament)
    const tournamentId = 'pdl-s1'; // Change this if needed
    
    console.log(`Checking tournament: ${tournamentId}\n`);

    // Get all matches in the tournament
    const matchesRef = db.collection('tournaments').doc(tournamentId).collection('matches');
    const snapshot = await matchesRef.get();

    console.log(`📊 Found ${snapshot.docs.length} total matches in collection\n`);

    // Find matches without tournamentId
    const orphanedMatches = [];
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (!data.tournamentId) {
        orphanedMatches.push({
          id: doc.id,
          ...data
        });
      }
    });

    console.log(`❌ Found ${orphanedMatches.length} orphaned matches (without tournamentId)\n`);

    if (orphanedMatches.length === 0) {
      console.log('✅ No orphaned matches found. Database is clean!');
      return;
    }

    // Show sample of what will be deleted
    console.log('Sample of orphaned matches:');
    orphanedMatches.slice(0, 5).forEach((match, index) => {
      console.log(`  ${index + 1}. Match ID: ${match.id}`);
      console.log(`     - ${match.teamA?.name || 'Unknown'} vs ${match.teamB?.name || 'Unknown'}`);
      console.log(`     - Division: ${match.divisionId || 'N/A'}, Round: ${match.round || 'N/A'}`);
      console.log(`     - Has tournamentId: ${!!match.tournamentId}\n`);
    });

    console.log(`\n⚠️  WARNING: About to delete ${orphanedMatches.length} matches!`);
    console.log('Press Ctrl+C within 5 seconds to cancel...\n');

    // Wait 5 seconds
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('🗑️  Starting deletion...\n');

    // Delete in batches of 500
    const batchSize = 500;
    let deletedCount = 0;

    for (let i = 0; i < orphanedMatches.length; i += batchSize) {
      const batch = db.batch();
      const batchMatches = orphanedMatches.slice(i, i + batchSize);

      batchMatches.forEach(match => {
        const matchRef = db.collection('tournaments').doc(tournamentId).collection('matches').doc(match.id);
        batch.delete(matchRef);
      });

      await batch.commit();
      deletedCount += batchMatches.length;

      console.log(`   Deleted ${deletedCount}/${orphanedMatches.length} matches...`);
    }

    console.log(`\n✅ Successfully deleted ${deletedCount} orphaned matches!`);
    console.log('Database cleanup complete.\n');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the script
deleteOrphanedMatches()
  .then(() => {
    console.log('Script finished successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
