// Diagnostic script: find all non-completed matches with a scheduledFor date
// Usage: node scripts/debug-scheduled-match.js

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

async function run() {
  const tournamentsSnap = await db.collection('tournaments').get();

  for (const tournamentDoc of tournamentsSnap.docs) {
    const tournamentId = tournamentDoc.id;
    const matchesRef = db.collection('tournaments').doc(tournamentId).collection('matches');
    const matchesSnap = await matchesRef.get();

    let found = false;
    for (const matchDoc of matchesSnap.docs) {
      const d = matchDoc.data();
      // Look for matches that are NOT completed but have some scheduling data
      const isCompleted = d.status === 'completed' || d.status === 'live';
      const hasScheduledFor = d.scheduledFor && d.scheduledFor !== '';
      const hasSchedulingStatus = d.schedulingStatus && d.schedulingStatus !== 'unscheduled';
      const hasPending = d.status === 'pending' || d.status === 'scheduled';

      if (!isCompleted && (hasScheduledFor || hasSchedulingStatus)) {
        if (!found) {
          console.log(`\nTournament: ${tournamentId} (${tournamentDoc.data().name || ''})`);
          found = true;
        }
        console.log(`  Match ${matchDoc.id}: ${d.teamA?.name} vs ${d.teamB?.name}`);
        console.log(`    status: "${d.status}"`);
        console.log(`    schedulingStatus: "${d.schedulingStatus}"`);
        console.log(`    scheduledFor: "${d.scheduledFor}"`);
        console.log(`    scheduled_for: "${d.scheduled_for}"`);
        console.log(`    group_id: "${d.group_id}"`);
        console.log(`    divisionId: "${d.divisionId}"`);
        console.log(`    teamA.id: "${d.teamA?.id}" | teamB.id: "${d.teamB?.id}"`);
        if (d.rescheduleRequest) {
          console.log(`    rescheduleRequest.status: "${d.rescheduleRequest?.status}"`);
          console.log(`    rescheduleRequest.proposedDate: "${d.rescheduleRequest?.proposedDate}"`);
        }
      }
    }
  }

  console.log('\nDone.');
}

run().catch(console.error);
