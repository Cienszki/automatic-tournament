/**
 * Migration script: consolidate datetime fields → scheduledFor
 *
 * For every match document in tournaments/pdl-s1/matches:
 *   1. Ensure scheduledFor is set (fallback to scheduled_for or dateTime)
 *   2. Delete legacy fields: scheduled_for, dateTime, defaultMatchTime, schedulingMethod
 *
 * Run once after deploying the code refactor.
 * Usage: node scripts/migrate-scheduledFor-field.js
 */

require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');

// ── Firebase init ──────────────────────────────────────────────────────────
const base64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
if (!base64) {
  console.error('Missing FIREBASE_SERVICE_ACCOUNT_BASE64 env var');
  process.exit(1);
}

const serviceAccount = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();

// ── Config ─────────────────────────────────────────────────────────────────
const TOURNAMENT_ID = 'pdl-s1';
const LEGACY_FIELDS_TO_DELETE = ['scheduled_for', 'dateTime', 'defaultMatchTime', 'schedulingMethod'];
const BATCH_SIZE = 400; // Firestore batch limit is 500

// ── Helpers ────────────────────────────────────────────────────────────────
function toISO(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().toISOString(); // Firestore Timestamp
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  return null;
}

// ── Main ───────────────────────────────────────────────────────────────────
async function migrate() {
  const collRef = db.collection(`tournaments/${TOURNAMENT_ID}/matches`);
  const snapshot = await collRef.get();

  console.log(`Found ${snapshot.size} match documents`);

  let updated = 0;
  let skipped = 0;
  let batches = 0;
  let batch = db.batch();
  let ops = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();

    // Resolve the canonical scheduledFor value
    const canonical =
      toISO(data.scheduledFor) ||
      toISO(data.scheduled_for) ||
      toISO(data.dateTime) ||
      null;

    // Determine which legacy fields actually exist on this doc
    const fieldsToRemove = LEGACY_FIELDS_TO_DELETE.filter(f => data[f] !== undefined);

    // Skip docs that are already clean (have scheduledFor, no legacy fields)
    if (data.scheduledFor && fieldsToRemove.length === 0) {
      skipped++;
      continue;
    }

    const update = {};

    if (canonical && !data.scheduledFor) {
      update.scheduledFor = canonical;
    }

    for (const field of fieldsToRemove) {
      update[field] = admin.firestore.FieldValue.delete();
    }

    if (Object.keys(update).length === 0) {
      skipped++;
      continue;
    }

    batch.update(doc.ref, update);
    ops++;
    updated++;

    if (ops >= BATCH_SIZE) {
      await batch.commit();
      batches++;
      console.log(`  Committed batch ${batches} (${updated} docs updated so far)`);
      batch = db.batch();
      ops = 0;
    }
  }

  if (ops > 0) {
    await batch.commit();
    batches++;
  }

  console.log(`\nDone. Updated: ${updated}, Skipped (already clean): ${skipped}, Batches: ${batches}`);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
