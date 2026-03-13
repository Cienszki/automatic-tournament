/**
 * backfill-player-doc-ids.js
 *
 * Adds `playerDocId` to existing `approvedStandins` entries on match documents
 * where the field is missing. This is needed after adding cross-team standin
 * doc ID resolution to the approval flow.
 *
 * Usage:
 *   node scripts/backfill-player-doc-ids.js           # dry-run (no writes)
 *   node scripts/backfill-player-doc-ids.js --apply   # apply changes
 *   node scripts/backfill-player-doc-ids.js --apply --tournament pdl-s1
 */

require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');

if (!admin.apps.length) {
  const sa = JSON.parse(
    Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString()
  );
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}

const db = admin.firestore();
const argv = process.argv.slice(2);
const DRY_RUN = !argv.includes('--apply');
const TOURNAMENT = argv.includes('--tournament')
  ? argv[argv.indexOf('--tournament') + 1]
  : 'pdl-s1';

if (DRY_RUN) {
  console.log('=== DRY RUN — pass --apply to write changes ===\n');
}

async function findPlayerDocId(tournamentId, steamId32) {
  if (!steamId32) return null;
  const teamsSnap = await db
    .collection('tournaments')
    .doc(tournamentId)
    .collection('teams')
    .get();
  for (const teamDoc of teamsSnap.docs) {
    const playersSnap = await db
      .collection('tournaments')
      .doc(tournamentId)
      .collection('teams')
      .doc(teamDoc.id)
      .collection('players')
      .where('steamId32', '==', steamId32)
      .limit(1)
      .get();
    if (!playersSnap.empty) {
      return { docId: playersSnap.docs[0].id, teamName: teamDoc.data().name };
    }
  }
  return null;
}

async function main() {
  console.log(`Tournament: ${TOURNAMENT}\n`);

  const matchesSnap = await db
    .collection('tournaments')
    .doc(TOURNAMENT)
    .collection('matches')
    .get();

  let totalEntries = 0;
  let alreadyHaveDocId = 0;
  let resolved = 0;
  let notRegistered = 0;
  let skipped = 0;

  for (const matchDoc of matchesSnap.docs) {
    const data = matchDoc.data();
    if (!data.approvedStandins || typeof data.approvedStandins !== 'object') continue;

    const updates = {};

    for (const [requestId, entry] of Object.entries(data.approvedStandins)) {
      totalEntries++;

      if (entry.playerDocId) {
        alreadyHaveDocId++;
        continue;
      }

      if (!entry.steamId32) {
        console.log(`  [SKIP] Match ${matchDoc.id} / ${requestId} — no steamId32`);
        skipped++;
        continue;
      }

      const found = await findPlayerDocId(TOURNAMENT, String(entry.steamId32));
      if (found) {
        console.log(
          `  [RESOLVE] Match ${matchDoc.id} / ${requestId} — ` +
          `${entry.nickname} (steamId32=${entry.steamId32}) → docId=${found.docId} in team "${found.teamName}"`
        );
        updates[`approvedStandins.${requestId}.playerDocId`] = found.docId;
        resolved++;
      } else {
        console.log(
          `  [NOT REGISTERED] Match ${matchDoc.id} / ${requestId} — ` +
          `${entry.nickname} (steamId32=${entry.steamId32}) not in any team`
        );
        notRegistered++;
      }
    }

    if (Object.keys(updates).length > 0) {
      if (!DRY_RUN) {
        await matchDoc.ref.update(updates);
        console.log(`  → Written ${Object.keys(updates).length} field(s) to match ${matchDoc.id}`);
      } else {
        console.log(`  → Would write ${Object.keys(updates).length} field(s) to match ${matchDoc.id}`);
      }
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Total standin entries: ${totalEntries}`);
  console.log(`Already had playerDocId: ${alreadyHaveDocId}`);
  console.log(`Resolved (${DRY_RUN ? 'would update' : 'updated'}): ${resolved}`);
  console.log(`Not registered (unregistered standins): ${notRegistered}`);
  console.log(`Skipped (no steamId32): ${skipped}`);
}

main().catch(console.error).finally(() => process.exit());
