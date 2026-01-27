// Delete all mockup data from the database
require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');
const readline = require('readline');

// Initialize Firebase Admin using environment variable
if (!admin.apps.length) {
  const base64EncodedServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  
  if (!base64EncodedServiceAccount) {
    console.error('❌ FIREBASE_SERVICE_ACCOUNT_BASE64 environment variable is not set');
    process.exit(1);
  }

  const serviceAccount = JSON.parse(
    Buffer.from(base64EncodedServiceAccount, 'base64').toString('utf-8')
  );

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// Helper to delete a collection
async function deleteCollection(collectionRef, batchSize = 100) {
  const query = collectionRef.limit(batchSize);
  return new Promise((resolve, reject) => {
    deleteQueryBatch(query, resolve, reject);
  });
}

async function deleteQueryBatch(query, resolve, reject) {
  try {
    const snapshot = await query.get();

    if (snapshot.size === 0) {
      resolve();
      return;
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    
    // Recurse on the next batch
    process.nextTick(() => {
      deleteQueryBatch(query, resolve, reject);
    });
  } catch (error) {
    reject(error);
  }
}

async function deleteMockupData(tournamentId, deleteOptions) {
  console.log(`\n🗑️  Deleting mockup data for tournament: ${tournamentId}\n`);
  let deletedCount = 0;

  try {
    const tournamentRef = db.collection('tournaments').doc(tournamentId);

    // Delete teams and their subcollections
    if (deleteOptions.teams) {
      console.log('📦 Deleting teams...');
      const teamsSnapshot = await tournamentRef.collection('teams').get();
      
      for (const teamDoc of teamsSnapshot.docs) {
        const teamData = teamDoc.data();
        
        // Check if it's mockup data (you can add more conditions)
        const isMockup = 
          teamDoc.id.includes('elite-team') ||
          teamDoc.id.includes('challenger-team') ||
          teamDoc.id.includes('adept-team') ||
          (deleteOptions.includeTest && teamData.name?.includes('Test'));

        if (isMockup) {
          // Delete players subcollection
          const playersSnapshot = await teamDoc.ref.collection('players').get();
          for (const playerDoc of playersSnapshot.docs) {
            await playerDoc.ref.delete();
          }

          // Delete team
          await teamDoc.ref.delete();
          console.log(`   ✓ Deleted: ${teamData.name} (${teamDoc.id})`);
          deletedCount++;
        }
      }
    }

    // Delete matches
    if (deleteOptions.matches) {
      console.log('\n🎮 Deleting matches...');
      const matchesSnapshot = await tournamentRef.collection('matches').get();
      
      for (const matchDoc of matchesSnapshot.docs) {
        // Delete games subcollection
        const gamesSnapshot = await matchDoc.ref.collection('games').get();
        for (const gameDoc of gamesSnapshot.docs) {
          // Delete performances subcollection
          const perfsSnapshot = await gameDoc.ref.collection('performances').get();
          for (const perfDoc of perfsSnapshot.docs) {
            await perfDoc.ref.delete();
          }
          await gameDoc.ref.delete();
        }

        await matchDoc.ref.delete();
        console.log(`   ✓ Deleted match: ${matchDoc.id}`);
        deletedCount++;
      }
    }

    // Delete divisions if requested
    if (deleteOptions.divisions) {
      console.log('\n📊 Deleting divisions...');
      await deleteCollection(tournamentRef.collection('divisions'));
      console.log('   ✓ Divisions deleted');
    }

    // Delete standings if requested
    if (deleteOptions.standings) {
      console.log('\n📈 Deleting standings...');
      await deleteCollection(tournamentRef.collection('standings'));
      console.log('   ✓ Standings deleted');
    }

    // Delete fantasy lineups if requested
    if (deleteOptions.fantasy) {
      console.log('\n⭐ Deleting fantasy lineups...');
      const fantasySnapshot = await tournamentRef.collection('fantasyLineups').get();
      for (const fantasyDoc of fantasySnapshot.docs) {
        // Delete rounds subcollection
        const roundsSnapshot = await fantasyDoc.ref.collection('rounds').get();
        for (const roundDoc of roundsSnapshot.docs) {
          await roundDoc.ref.delete();
        }
        await fantasyDoc.ref.delete();
      }
      console.log('   ✓ Fantasy lineups deleted');
    }

    console.log(`\n✅ Deleted ${deletedCount} items from tournament: ${tournamentId}\n`);

  } catch (error) {
    console.error('❌ Error deleting mockup data:', error);
  }
}

// Interactive prompt
async function promptUser() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (query) => new Promise((resolve) => rl.question(query, resolve));

  console.log('\n=== DELETE MOCKUP DATA ===\n');
  console.log('This will delete mockup/test data from the database.');
  console.log('Tournament: pdl-s1 (Polish Dota League - Season 1)\n');
  
  console.log('What would you like to delete?\n');
  const deleteTeams = await question('Delete mockup teams (elite-team-*, challenger-team-*, adept-team-*)? (y/n): ');
  const includeTest = deleteTeams.toLowerCase() === 'y' ? await question('Also delete Test teams (Test1, etc.)? (y/n): ') : 'n';
  const deleteMatches = await question('Delete all matches? (y/n): ');
  const deleteDivisions = await question('Delete divisions? (y/n): ');
  const deleteStandings = await question('Delete standings? (y/n): ');
  const deleteFantasy = await question('Delete fantasy lineups? (y/n): ');
  
  console.log('\n');
  const confirm = await question('Are you sure you want to proceed? This cannot be undone! (yes/no): ');

  rl.close();

  if (confirm.toLowerCase() === 'yes') {
    const options = {
      teams: deleteTeams.toLowerCase() === 'y',
      includeTest: includeTest.toLowerCase() === 'y',
      matches: deleteMatches.toLowerCase() === 'y',
      divisions: deleteDivisions.toLowerCase() === 'y',
      standings: deleteStandings.toLowerCase() === 'y',
      fantasy: deleteFantasy.toLowerCase() === 'y',
    };

    await deleteMockupData('pdl-s1', options);
    console.log('✅ Done!\n');
  } else {
    console.log('❌ Cancelled. No data was deleted.\n');
  }

  process.exit(0);
}

promptUser();
