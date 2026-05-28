/**
 * backfill-total-mmr.js
 *
 * Retroactively computes and writes `totalMMR` for all existing team documents
 * in a tournament. Reads MMR values from the embedded `roster` map.
 *
 * Usage:
 *   node scripts/backfill-total-mmr.js                        # dry-run (no writes)
 *   node scripts/backfill-total-mmr.js --apply                # apply to pdl-s1
 *   node scripts/backfill-total-mmr.js --apply --tournament wiosenna-furia
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

async function main() {
  console.log(`Tournament: ${TOURNAMENT}\n`);

  const teamsSnap = await db
    .collection('tournaments')
    .doc(TOURNAMENT)
    .collection('teams')
    .get();

  if (teamsSnap.empty) {
    console.log('No teams found.');
    return;
  }

  console.log(`Found ${teamsSnap.size} team(s).\n`);

  let updated = 0;
  let skipped = 0;

  for (const teamDoc of teamsSnap.docs) {
    const data = teamDoc.data();
    const roster = data.roster || {};
    let rosterEntries = Object.values(roster);

    // Fall back to players subcollection when roster map is absent (legacy format)
    if (rosterEntries.length === 0) {
      const playersSnap = await teamDoc.ref.collection('players').get();
      rosterEntries = playersSnap.docs.map(d => d.data());
    }

    const totalMMR = rosterEntries.reduce((sum, player) => sum + (player.mmr || 0), 0);

    const existingTotalMMR = data.totalMMR;
    const status = existingTotalMMR === totalMMR ? 'unchanged' : existingTotalMMR == null ? 'missing' : 'stale';

    console.log(
      `  [${status.toUpperCase()}] ${data.name} (${teamDoc.id})` +
      `  roster=${rosterEntries.length} players` +
      `  existing=${existingTotalMMR ?? '—'}  computed=${totalMMR}`
    );

    if (status === 'unchanged') {
      skipped++;
      continue;
    }

    if (!DRY_RUN) {
      await teamDoc.ref.update({ totalMMR });
    }
    updated++;
  }

  console.log(`\n${DRY_RUN ? '[DRY RUN] Would update' : 'Updated'} ${updated} team(s), ${skipped} already correct.`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
