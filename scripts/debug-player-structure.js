// Diagnostic: check player doc structure for the active tournament
// Usage: node scripts/debug-player-structure.js

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
require('dotenv').config({ path: '.env.local' });

const saBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
if (!saBase64) { console.error('Missing FIREBASE_SERVICE_ACCOUNT_BASE64'); process.exit(1); }

const serviceAccount = JSON.parse(Buffer.from(saBase64, 'base64').toString('utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function run() {
  const tournamentsSnap = await db.collection('tournaments').get();

  for (const tDoc of tournamentsSnap.docs) {
    const teamsSnap = await db.collection('tournaments').doc(tDoc.id).collection('teams').get();
    for (const teamDoc of teamsSnap.docs) {
      const td = teamDoc.data();
      const playersSnap = await db.collection('tournaments').doc(tDoc.id)
        .collection('teams').doc(teamDoc.id).collection('players').get();

      if (!playersSnap.empty) {
        console.log(`\nTournament ${tDoc.id} / Team ${td.name} — players subcollection:`);
        for (const pd of playersSnap.docs) {
          const p = pd.data();
          console.log(`  doc.id=${pd.id}  nickname="${p.nickname}"  steamId="${p.steamId}"  role="${p.role}"`);
        }
      }

      if (td.roster && typeof td.roster === 'object') {
        const rosterKeys = Object.keys(td.roster);
        if (rosterKeys.length > 0) {
          console.log(`\nTournament ${tDoc.id} / Team ${td.name} — roster map (${rosterKeys.length} players):`);
          for (const [key, info] of Object.entries(td.roster)) {
            const i = info;
            console.log(`  key=${key}  nickname="${i.nickname}"  role="${i.role}"`);
          }
        }
      }
    }
  }

  console.log('\nDone.');
}

run().catch(console.error);
