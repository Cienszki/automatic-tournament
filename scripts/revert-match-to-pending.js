// One-off script: revert a specific match back to pending status
// Usage: node scripts/revert-match-to-pending.js

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
require('dotenv').config({ path: '.env.local' });

const saBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
if (!saBase64) {
  console.error('Missing FIREBASE_SERVICE_ACCOUNT_BASE64');
  process.exit(1);
}

const serviceAccount = JSON.parse(Buffer.from(saBase64, 'base64').toString('utf8'));

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function findAndRevertMatch() {
  // Search across all tournaments
  const tournamentsSnap = await db.collection('tournaments').get();
  let found = false;

  for (const tournamentDoc of tournamentsSnap.docs) {
    const tournamentId = tournamentDoc.id;
    const matchesRef = db.collection('tournaments').doc(tournamentId).collection('matches');
    const matchesSnap = await matchesRef.get();

    for (const matchDoc of matchesSnap.docs) {
      const data = matchDoc.data();
      const teamAName = data.teamA?.name || '';
      const teamBName = data.teamB?.name || '';

      const isTarget =
        (teamAName.includes('Chrupek') && teamBName.includes('Bubliny')) ||
        (teamBName.includes('Chrupek') && teamAName.includes('Bubliny'));

      if (isTarget) {
        console.log(`Found match in tournament "${tournamentId}" (doc: ${matchDoc.id})`);
        console.log(`  ${teamAName} vs ${teamBName}`);
        console.log(`  Current status: ${data.status}, schedulingStatus: ${data.schedulingStatus}`);

        await matchDoc.ref.update({
          status: 'pending',
          schedulingStatus: 'unscheduled',
          dateTime: null,
          proposedTime: null,
          proposingCaptainId: null,
          proposedById: null,
          rescheduleRequest: null,
        });

        console.log('  ✓ Reverted to pending (status=pending, schedulingStatus=unscheduled)');
        found = true;
      }
    }
  }

  if (!found) {
    console.log('No match found containing "Chrupek" and "Bubliny" in team names.');
    console.log('Also checking legacy "matches" root collection...');

    const rootMatchesSnap = await db.collection('matches').get();
    for (const matchDoc of rootMatchesSnap.docs) {
      const data = matchDoc.data();
      const teamAName = data.teamA?.name || '';
      const teamBName = data.teamB?.name || '';

      const isTarget =
        (teamAName.includes('Chrupek') && teamBName.includes('Bubliny')) ||
        (teamBName.includes('Chrupek') && teamAName.includes('Bubliny'));

      if (isTarget) {
        console.log(`Found match in root matches collection (doc: ${matchDoc.id})`);
        console.log(`  ${teamAName} vs ${teamBName}`);
        console.log(`  Current status: ${data.status}, schedulingStatus: ${data.schedulingStatus}`);

        await matchDoc.ref.update({
          status: 'pending',
          schedulingStatus: 'unscheduled',
          dateTime: null,
          proposedTime: null,
          proposingCaptainId: null,
          proposedById: null,
          rescheduleRequest: null,
        });

        console.log('  ✓ Reverted to pending (status=pending, schedulingStatus=unscheduled)');
        found = true;
      }
    }
  }

  if (!found) {
    console.log('Match not found in any collection.');
  }
}

findAndRevertMatch().catch(console.error);
