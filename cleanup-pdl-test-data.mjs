// Script to clean up PDL test data while preserving legacy Letnia data
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin using environment variable
const base64EncodedServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;

if (!base64EncodedServiceAccount) {
  console.error('❌ FIREBASE_SERVICE_ACCOUNT_BASE64 environment variable is not set');
  process.exit(1);
}

const serviceAccount = JSON.parse(
  Buffer.from(base64EncodedServiceAccount, 'base64').toString('utf-8')
);

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function listTournaments() {
  console.log('\n=== LISTING TOURNAMENTS ===\n');
  const tournamentsSnapshot = await db.collection('tournaments').get();
  
  const tournaments = [];
  tournamentsSnapshot.forEach(doc => {
    const data = doc.data();
    tournaments.push({
      id: doc.id,
      slug: data.slug,
      name: data.name,
      type: data.type,
    });
    console.log(`[${doc.id}]`);
    console.log(`  Name: ${data.name}`);
    console.log(`  Slug: ${data.slug}`);
    console.log(`  Type: ${data.type}`);
    console.log('');
  });
  
  return tournaments;
}

async function countCollectionData(tournamentId, collectionName) {
  const snapshot = await db.collection('tournaments').doc(tournamentId).collection(collectionName).get();
  return snapshot.size;
}

async function deletePDLTestData(tournamentId) {
  console.log(`\n=== DELETING TEST DATA FROM TOURNAMENT: ${tournamentId} ===\n`);
  
  // Count before deletion
  const teamsCount = await countCollectionData(tournamentId, 'teams');
  const matchesCount = await countCollectionData(tournamentId, 'matches');
  const divisionsCount = await countCollectionData(tournamentId, 'divisions');
  
  console.log(`Found:`);
  console.log(`  - ${teamsCount} teams`);
  console.log(`  - ${matchesCount} matches`);
  console.log(`  - ${divisionsCount} divisions`);
  console.log('');
  
  if (teamsCount === 0 && matchesCount === 0 && divisionsCount === 0) {
    console.log('No test data to delete.');
    return;
  }
  
  // Delete teams (including players subcollection)
  if (teamsCount > 0) {
    console.log('Deleting teams...');
    const teamsSnapshot = await db.collection('tournaments').doc(tournamentId).collection('teams').get();
    
    for (const teamDoc of teamsSnapshot.docs) {
      // Delete players subcollection first
      const playersSnapshot = await teamDoc.ref.collection('players').get();
      for (const playerDoc of playersSnapshot.docs) {
        await playerDoc.ref.delete();
      }
      
      // Delete team document
      await teamDoc.ref.delete();
      console.log(`  Deleted team: ${teamDoc.data().name}`);
    }
  }
  
  // Delete matches (including games subcollection)
  if (matchesCount > 0) {
    console.log('\nDeleting matches...');
    const matchesSnapshot = await db.collection('tournaments').doc(tournamentId).collection('matches').get();
    
    for (const matchDoc of matchesSnapshot.docs) {
      // Delete games subcollection first
      const gamesSnapshot = await matchDoc.ref.collection('games').get();
      for (const gameDoc of gamesSnapshot.docs) {
        // Delete performances subcollection
        const perfSnapshot = await gameDoc.ref.collection('performances').get();
        for (const perfDoc of perfSnapshot.docs) {
          await perfDoc.ref.delete();
        }
        await gameDoc.ref.delete();
      }
      
      // Delete match document
      await matchDoc.ref.delete();
      console.log(`  Deleted match: ${matchDoc.id}`);
    }
  }
  
  // Delete divisions
  if (divisionsCount > 0) {
    console.log('\nDeleting divisions...');
    const divisionsSnapshot = await db.collection('tournaments').doc(tournamentId).collection('divisions').get();
    
    for (const divDoc of divisionsSnapshot.docs) {
      await divDoc.ref.delete();
      console.log(`  Deleted division: ${divDoc.data().name}`);
    }
  }
  
  console.log('\n✅ PDL test data cleaned up successfully!');
  console.log('Legacy Letnia data remains untouched.');
}

async function main() {
  try {
    // List tournaments
    const tournaments = await listTournaments();
    
    if (tournaments.length === 0) {
      console.log('No tournaments found.');
      return;
    }
    
    // Find PDL tournament (you can adjust the filter if needed)
    const pdlTournament = tournaments.find(t => 
      t.slug === 'pdl' || 
      t.name?.toLowerCase().includes('pdl') ||
      t.name?.toLowerCase().includes('polish dota league')
    );
    
    if (!pdlTournament) {
      console.log('❌ PDL tournament not found. Please specify tournament ID manually.');
      console.log('\nAvailable tournaments:');
      tournaments.forEach(t => console.log(`  - ${t.id}: ${t.name}`));
      return;
    }
    
    console.log(`\n🎯 Found PDL tournament: ${pdlTournament.name} (${pdlTournament.id})`);
    console.log('\nThis will DELETE all teams, matches, and divisions from this tournament.');
    console.log('Legacy data in root collections (teams, matches, etc.) will NOT be touched.\n');
    
    // Delete the test data
    await deletePDLTestData(pdlTournament.id);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

main();
