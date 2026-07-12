#!/usr/bin/env node
/**
 * backfill-playoff-mirrors.js
 *
 * One-time script: for every tournament, create a "mirror" document in
 * tournaments/{id}/matches for each playable playoff bracket match
 * (tournaments/{id}/playoff_matches), using the SAME doc id. This makes existing
 * playoff brackets playable via the normal match lifecycle (lobby bot, result sync,
 * stats, rankings, schedule) and keeps already-submitted standin requests (whose
 * matchId is the playoff id) resolving against a real match doc.
 *
 * Mirror rules mirror src/lib/playoff-mirror.ts:
 *   - only non-bye matches with BOTH teams assigned are mirrored
 *   - a NEW mirror is created fully; an EXISTING mirror gets only a teams/format patch
 *     (score / status / scheduling are never reset)
 *   - no group_id and no divisionId:'elite' (keeps playoffs out of group standings and
 *     the elite season-points table)
 *
 * Usage:
 *   node scripts/backfill-playoff-mirrors.js                  ← dry-run (safe, no writes)
 *   node scripts/backfill-playoff-mirrors.js --apply          ← actually write to Firestore
 *   node scripts/backfill-playoff-mirrors.js --tournament <id>← limit to one tournament id
 */

require('dotenv').config({ path: __dirname + '/../.env.local' });
const admin = require('firebase-admin');

// ─── Firebase init ────────────────────────────────────────────────────────────
const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
if (serviceAccountBase64) {
  const serviceAccount = JSON.parse(Buffer.from(serviceAccountBase64, 'base64').toString('utf-8'));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  console.log('✓ Firebase: service account from env');
} else {
  try {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: 'tournament-tracker-f35tb',
    });
    console.log('✓ Firebase: application default credentials');
  } catch (e) {
    console.error('✗ Firebase init failed:', e.message);
    process.exit(1);
  }
}
const db = admin.firestore();

// ─── Args ───────────────────────────────────────────────────────────────────
const DRY_RUN = !process.argv.includes('--apply');
const LIMIT_IDX = process.argv.indexOf('--tournament');
const LIMIT_ID = LIMIT_IDX !== -1 ? process.argv[LIMIT_IDX + 1] : null;

// ─── Mirror helpers (kept in sync with src/lib/playoff-mirror.ts) ─────────────
const BYE_TEAM_SENTINEL = '__PLAYOFF_BYE__';
const FORMAT_TO_BEST_OF = { bo1: 1, bo3: 3, bo5: 5 };

const isByeTeam = (t) => !!(t && typeof t.id === 'string' && t.id.startsWith(BYE_TEAM_SENTINEL));
const isByeMatch = (m) => m.status === 'bye' || isByeTeam(m.teamA) || isByeTeam(m.teamB);
const shouldMirror = (pm) => !isByeMatch(pm) && !!(pm.teamA && pm.teamA.id) && !!(pm.teamB && pm.teamB.id);

function buildMirrorCreateData(pm) {
  const status =
    pm.status === 'completed' || pm.status === 'bye' ? 'completed' : pm.status === 'live' ? 'live' : 'scheduled';
  const now = new Date().toISOString();
  const data = {
    teamA: { id: pm.teamA.id, name: pm.teamA.name || 'TBA', score: (pm.result && pm.result.teamAScore) || 0, logoUrl: pm.teamA.logoUrl || '' },
    teamB: { id: pm.teamB.id, name: pm.teamB.name || 'TBA', score: (pm.result && pm.result.teamBScore) || 0, logoUrl: pm.teamB.logoUrl || '' },
    teams: [pm.teamA.id, pm.teamB.id],
    status,
    scheduledFor: pm.scheduledFor || '',
    schedulingStatus: pm.scheduledFor ? 'confirmed' : 'unscheduled',
    series_format: pm.format,
    bestOf: FORMAT_TO_BEST_OF[pm.format] || 3,
    isPlayoff: true,
    playoff_match_id: pm.id,
    roundId: 'playoffs',
    playoff_round: pm.round,
    createdAt: now,
    updatedAt: now,
  };
  if (pm.result && pm.result.winnerId) data.winnerId = pm.result.winnerId;
  if (pm.deadline) data.deadline = pm.deadline;
  if (pm.code) data.playoffCode = pm.code;
  return data;
}

function buildMirrorTeamsPatch(pm) {
  const data = {
    teamA: { id: pm.teamA.id, name: pm.teamA.name || 'TBA', logoUrl: pm.teamA.logoUrl || '' },
    teamB: { id: pm.teamB.id, name: pm.teamB.name || 'TBA', logoUrl: pm.teamB.logoUrl || '' },
    teams: [pm.teamA.id, pm.teamB.id],
    series_format: pm.format,
    bestOf: FORMAT_TO_BEST_OF[pm.format] || 3,
    isPlayoff: true,
    playoff_match_id: pm.id,
    roundId: 'playoffs',
    playoff_round: pm.round,
    updatedAt: new Date().toISOString(),
  };
  if (pm.deadline) data.deadline = pm.deadline;
  if (pm.code) data.playoffCode = pm.code;
  return data;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  console.log(DRY_RUN ? '\n🔍 DRY RUN (no writes). Pass --apply to write.\n' : '\n✍️  APPLY mode — writing mirrors.\n');

  const tournamentsSnap = LIMIT_ID
    ? [await db.collection('tournaments').doc(LIMIT_ID).get()].filter((d) => d.exists)
    : (await db.collection('tournaments').get()).docs;

  let created = 0;
  let patched = 0;
  let skipped = 0;

  for (const tDoc of tournamentsSnap) {
    const tid = tDoc.id;
    const pmSnap = await db.collection('tournaments').doc(tid).collection('playoff_matches').get();
    if (pmSnap.empty) continue;

    console.log(`\n📁 Tournament ${tid}: ${pmSnap.size} playoff match(es)`);

    for (const d of pmSnap.docs) {
      const pm = { id: d.id, ...d.data() };
      if (!shouldMirror(pm)) {
        skipped++;
        continue;
      }
      const mirrorRef = db.collection('tournaments').doc(tid).collection('matches').doc(pm.id);
      const mirrorSnap = await mirrorRef.get();

      if (mirrorSnap.exists) {
        console.log(`   ~ patch  ${pm.id}  (${pm.teamA.name} vs ${pm.teamB.name})`);
        patched++;
        if (!DRY_RUN) await mirrorRef.set(buildMirrorTeamsPatch(pm), { merge: true });
      } else {
        console.log(`   + create ${pm.id}  (${pm.teamA.name} vs ${pm.teamB.name})`);
        created++;
        if (!DRY_RUN) await mirrorRef.set(buildMirrorCreateData(pm));
      }
    }
  }

  console.log(`\n─────────────────────────────────────`);
  console.log(`created: ${created}  patched: ${patched}  skipped(bye/TBA): ${skipped}`);
  console.log(DRY_RUN ? 'DRY RUN — nothing written. Re-run with --apply.\n' : 'Done.\n');
  process.exit(0);
})().catch((e) => {
  console.error('✗ Backfill failed:', e);
  process.exit(1);
});
