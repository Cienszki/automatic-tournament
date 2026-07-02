// Audit: find orphaned playerGameHistory entries — denormalized per-player game
// history docs whose underlying game no longer exists in its match (e.g. a game
// that was manually deleted/skipped by an admin but lingered in match history).
//
// Usage:
//   node scripts/audit-orphaned-game-history.js                     # report, all tournaments
//   node scripts/audit-orphaned-game-history.js <tournamentId>      # report, one tournament
//   node scripts/audit-orphaned-game-history.js <tournamentId> --fix  # delete the orphaned entries

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
require('dotenv').config({ path: '.env.local' });

const saBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
if (!saBase64) { console.error('Missing FIREBASE_SERVICE_ACCOUNT_BASE64'); process.exit(1); }
const serviceAccount = JSON.parse(Buffer.from(saBase64, 'base64').toString('utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const args = process.argv.slice(2);
const doFix = args.includes('--fix');
const onlyTournament = args.find(a => !a.startsWith('--'));

async function main() {
  const tournamentDocs = onlyTournament
    ? [await db.collection('tournaments').doc(onlyTournament).get()]
    : (await db.collection('tournaments').get()).docs;

  let grandTotalOrphans = 0;

  for (const tDoc of tournamentDocs) {
    if (!tDoc.exists) continue;
    const tid = tDoc.id;
    const phCol = db.collection('tournaments').doc(tid).collection('playerGameHistory');
    const playerRefs = await phCol.listDocuments();
    if (playerRefs.length === 0) continue;

    // gameId -> { matchId, players:Set }
    const orphans = new Map();
    const existCache = new Map(); // `${matchId}/${gameId}` -> bool
    let scanned = 0;

    for (const pRef of playerRefs) {
      const gamesSnap = await pRef.collection('games').get();
      for (const gDoc of gamesSnap.docs) {
        scanned++;
        const h = gDoc.data() || {};
        const gameId = String(h.gameId || gDoc.id);
        const matchId = h.matchId || null;
        const key = `${matchId}/${gameId}`;
        let exists = existCache.get(key);
        if (exists === undefined) {
          if (!matchId) {
            exists = false; // can't verify -> treat as orphan candidate
          } else {
            const gameDoc = await db.collection('tournaments').doc(tid)
              .collection('matches').doc(matchId).collection('games').doc(gameId).get();
            exists = gameDoc.exists;
          }
          existCache.set(key, exists);
        }
        if (!exists) {
          if (!orphans.has(gameId)) orphans.set(gameId, { matchId, players: new Set() });
          orphans.get(gameId).players.add(pRef.id);
        }
      }
    }

    console.log(`\n=== Tournament ${tid} — scanned ${scanned} history entries · ${orphans.size} orphaned game(s) ===`);
    for (const [gameId, info] of orphans) {
      grandTotalOrphans++;
      console.log(`  • game ${gameId}  (match ${info.matchId || 'UNKNOWN'})  ${info.players.size} player entr${info.players.size === 1 ? 'y' : 'ies'}: ${[...info.players].join(', ')}`);
    }

    if (doFix && orphans.size > 0) {
      let deleted = 0;
      let batch = db.batch();
      let inBatch = 0;
      for (const [gameId, info] of orphans) {
        for (const steamId of info.players) {
          batch.delete(phCol.doc(steamId).collection('games').doc(gameId));
          deleted++;
          if (++inBatch >= 400) { await batch.commit(); batch = db.batch(); inBatch = 0; }
        }
      }
      if (inBatch > 0) await batch.commit();
      console.log(`  ✓ Deleted ${deleted} orphaned history entries for ${tid}`);
    }
  }

  console.log(`\nTotal orphaned games across scanned tournaments: ${grandTotalOrphans}`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
