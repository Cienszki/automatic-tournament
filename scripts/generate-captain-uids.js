// This script creates Firebase Auth users for all captains in registration_payloads.json (if not already present),
// then updates the payloads to use their Firebase UIDs as captainId.
// Usage: node scripts/generate-captain-uids.js

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const PAYLOADS_PATH = path.join(__dirname, '../registration_payloads.json');
const OUTPUT_PATH = PAYLOADS_PATH; // Overwrite in place
const DEFAULT_PASSWORD = 'Letnia2024!'; // Change if you want

// Load service account from base64 env var
const base64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
if (!base64) {
  throw new Error('FIREBASE_SERVICE_ACCOUNT_BASE64 not found in .env.local');
}
const serviceAccount = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

async function main() {
  const payloads = JSON.parse(fs.readFileSync(PAYLOADS_PATH, 'utf8'));
  // Map: nickname -> UID
  const captainNickToUid = {};

  // Find all unique captain nicknames
  const captains = Array.from(new Set(payloads.map(t => t.captainId)));

  for (const nickname of captains) {
    // Use nickname as email prefix, add dummy domain
    const email = `${nickname.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}@letnia-tournament.com`;
    let user;
    try {
      user = await admin.auth().getUserByEmail(email);
      console.log(`User for ${nickname} exists: ${user.uid}`);
    } catch (e) {
      if (e.code === 'auth/user-not-found') {
        user = await admin.auth().createUser({
          email,
          password: DEFAULT_PASSWORD,
          displayName: nickname,
        });
        console.log(`Created user for ${nickname}: ${user.uid}`);
      } else {
        throw e;
      }
    }
    captainNickToUid[nickname] = user.uid;
  }

  // Update payloads
  for (const team of payloads) {
    if (captainNickToUid[team.captainId]) {
      team.captainId = captainNickToUid[team.captainId];
    }
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(payloads, null, 2));
  console.log('registration_payloads.json updated with Firebase UIDs.');
  console.log('Default password for all captains:', DEFAULT_PASSWORD);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
