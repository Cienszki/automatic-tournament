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

async function main() {
  const usersSnap = await db.collection('fantasyLineups').get();
  let found = 0;
  for (const userDoc of usersSnap.docs) {
    const userId = userDoc.id;
    const data = userDoc.data();
    const displayName = data.displayName || data.discordUsername || '';
    if (displayName === 'Anonymous') {
      try {
        // Try to get user from Firebase Auth
        const userRecord = await admin.auth().getUser(userId);
        console.log(`UserId: ${userId} | displayName: Anonymous | email: ${userRecord.email || 'NOT FOUND'}`);
        found++;
      } catch (e) {
        console.log(`UserId: ${userId} | displayName: Anonymous | email: NOT FOUND (not in Firebase Auth)`);
      }
    }
  }
  console.log(`Done. Found ${found} anonymous fantasy users with email in Firebase Auth.`);
}

main().then(() => process.exit(0));
