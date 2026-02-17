// TypeScript script to delete orphaned matches across all tournaments
// These are matches without a tournamentId field

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// Initialize Firebase Admin
const initializeAdmin = () => {
  if (admin.apps.length > 0) {
    return;
  }

  const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json');
  
  if (!fs.existsSync(serviceAccountPath)) {
    console.error('❌ serviceAccountKey.json not found!');
    console.error('Please place your Firebase service account key in the project root.');
    process.exit(1);
  }

  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
};

async function deleteOrphanedMatchesAllTournaments() {
  initializeAdmin();
  const db = admin.firestore();

  console.log('🔍 Searching for orphaned matches across all tournaments...\n');

  try {
    // Get all tournaments
    const tournamentsRef = db.collection('tournaments');
    const tournamentsSnapshot = await tournamentsRef.get();

    console.log(`📋 Found ${tournamentsSnapshot.docs.length} tournaments\n`);

    let totalOrphaned = 0;
    let totalDeleted = 0;

    for (const tournamentDoc of tournamentsSnapshot.docs) {
      const tournamentId = tournamentDoc.id;
      const tournamentData = tournamentDoc.data();
      
      console.log(`\n📍 Checking tournament: ${tournamentData.name || tournamentId} (${tournamentId})`);

      // Get all matches in this tournament
      const matchesRef = db.collection('tournaments').doc(tournamentId).collection('matches');
      const matchesSnapshot = await matchesRef.get();

      console.log(`   Total matches: ${matchesSnapshot.docs.length}`);

      // Find orphaned matches (no tournamentId)
      const orphanedMatches: any[] = [];
      
      matchesSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (!data.tournamentId) {
          orphanedMatches.push({
            id: doc.id,
            ref: doc.ref,
            ...data
          });
        }
      });

      if (orphanedMatches.length === 0) {
        console.log(`   ✅ No orphaned matches`);
        continue;
      }

      console.log(`   ❌ Found ${orphanedMatches.length} orphaned matches`);
      totalOrphaned += orphanedMatches.length;

      // Show sample
      if (orphanedMatches.length > 0) {
        console.log(`   Sample:`);
        orphanedMatches.slice(0, 3).forEach((match, index) => {
          console.log(`     ${index + 1}. ${match.teamA?.name || 'Unknown'} vs ${match.teamB?.name || 'Unknown'} (Round ${match.round || '?'})`);
        });
      }

      // Delete them
      console.log(`   🗑️  Deleting ${orphanedMatches.length} matches...`);

      const batchSize = 500;
      for (let i = 0; i < orphanedMatches.length; i += batchSize) {
        const batch = db.batch();
        const batchMatches = orphanedMatches.slice(i, i + batchSize);

        batchMatches.forEach(match => {
          batch.delete(match.ref);
        });

        await batch.commit();
        totalDeleted += batchMatches.length;
      }

      console.log(`   ✅ Deleted ${orphanedMatches.length} matches from ${tournamentId}`);
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`\n📊 SUMMARY:`);
    console.log(`   Total orphaned matches found: ${totalOrphaned}`);
    console.log(`   Total matches deleted: ${totalDeleted}`);
    console.log(`\n✅ Cleanup complete!\n`);

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

// Run the script
deleteOrphanedMatchesAllTournaments()
  .then(() => {
    console.log('Script finished successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
