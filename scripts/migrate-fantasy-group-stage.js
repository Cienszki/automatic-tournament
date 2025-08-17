
require('dotenv').config({ path: __dirname + '/../.env.local' });
const admin = require('firebase-admin');

if (!process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
  throw new Error('FIREBASE_SERVICE_ACCOUNT_BASE64 is not set in .env.local');
}
const serviceAccount = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf-8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function migrateFantasyLineups() {
  const usersSnap = await db.collection('fantasyLineups').get();
  let migrated = 0, skipped = 0, cleaned = 0;

  for (const userDoc of usersSnap.docs) {
    const userId = userDoc.id;
    const roundsCol = db.collection('fantasyLineups').doc(userId).collection('rounds');

    const groupStageDoc = await roundsCol.doc('group_stage').get();
    if (groupStageDoc.exists) {
      // Delete pre_season and initial if they exist
      const preSeasonDoc = await roundsCol.doc('pre_season').get();
      const initialDoc = await roundsCol.doc('initial').get();
      if (preSeasonDoc.exists) {
        await roundsCol.doc('pre_season').delete();
        cleaned++;
        console.log(`Deleted pre_season lineup for user ${userId}`);
      }
      if (initialDoc.exists) {
        await roundsCol.doc('initial').delete();
        cleaned++;
        console.log(`Deleted initial lineup for user ${userId}`);
      }
      skipped++;
      continue;
    }

    let sourceDoc = await roundsCol.doc('pre_season').get();
    if (!sourceDoc.exists) {
      sourceDoc = await roundsCol.doc('initial').get();
    }
    if (!sourceDoc.exists) {
      skipped++;
      continue;
    }

    const data = sourceDoc.data();
    await roundsCol.doc('group_stage').set({
      ...data,
      roundId: 'group_stage'
    }, { merge: true });

    migrated++;
    console.log(`Migrated lineup for user ${userId} to group_stage`);
  }

  console.log(`Done! Migrated: ${migrated}, Skipped: ${skipped}, Cleaned: ${cleaned}`);
}

migrateFantasyLineups().then(() => process.exit(0));
