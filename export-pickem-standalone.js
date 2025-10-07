const admin = require('firebase-admin');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

// Initialize Firebase Admin SDK
function initializeAdmin() {
  if (admin.apps.length > 0) {
    return admin.apps[0];
  }

  const base64EncodedServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (!base64EncodedServiceAccount) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_BASE64 not found in environment variables");
  }

  const serviceAccount = JSON.parse(Buffer.from(base64EncodedServiceAccount, 'base64').toString('utf-8'));
  
  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
}

// CSV escape function
function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  const needsQuoting = s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r');
  const escaped = s.replace(/"/g, '""');
  return needsQuoting ? `"${escaped}"` : escaped;
}

function toCsv(rows) {
  return rows.map(row => row.map(csvEscape).join(',')).join('\n');
}

async function exportPickemData() {
  try {
    console.log('🔧 Initializing Firebase Admin SDK...');
    const app = initializeAdmin();
    const db = admin.firestore();

    console.log('📊 Fetching data from Firestore...');
    
    // Fetch all collections in parallel
    const [pickemsSnap, teamsSnap, usersSnap] = await Promise.all([
      db.collection('pickems').get(),
      db.collection('teams').get(),
      db.collection('userProfiles').get().catch(() => ({ docs: [] }))
    ]);

    console.log(`Found ${pickemsSnap.docs.length} pickems, ${teamsSnap.docs.length} teams, ${usersSnap.docs.length} user profiles`);

    // Build lookup maps
    const teams = new Map();
    teamsSnap.docs.forEach(doc => teams.set(doc.id, { id: doc.id, ...doc.data() }));

    const users = new Map();
    usersSnap.docs.forEach(doc => users.set(doc.id, { id: doc.id, ...doc.data() }));

    // Helper to get team name
    const teamName = (id) => {
      if (!id) return '';
      const t = teams.get(id);
      return t?.name || t?.teamName || t?.tag || id || '';
    };

    // Column layout for Google Sheets
    const headers = [
      'userId',
      'displayName', 
      'discordUsername',
      'submittedAt',
      'champion',
      'runnerUp',
      'thirdPlace',
      'fourthPlace',
      'fifthToSixth_1', 'fifthToSixth_2',
      'seventhToEighth_1', 'seventhToEighth_2',
      'ninthToTwelfth_1', 'ninthToTwelfth_2', 'ninthToTwelfth_3', 'ninthToTwelfth_4',
      'thirteenthToSixteenth_1', 'thirteenthToSixteenth_2', 'thirteenthToSixteenth_3', 'thirteenthToSixteenth_4',
      'pool_count',
      'pool_list'
    ];

    const rows = [headers];

    console.log('🔄 Processing pickem documents...');

    pickemsSnap.docs.forEach((doc, index) => {
      const data = { userId: doc.id, ...doc.data() };
      const preds = data.predictions || {};
      const profile = users.get(data.userId) || users.get(doc.id) || {};

      console.log(`Processing ${index + 1}/${pickemsSnap.docs.length}: ${data.userId}`);
      console.log('  Predictions keys:', Object.keys(preds));
      if (Object.keys(preds).length > 0) {
        console.log('  Sample prediction data:', {
          champion: preds.champion,
          runnerUp: preds.runnerUp,
          pool: preds.pool
        });
      }

      // Helper functions to safely extract team names
      const one = (arr) => (Array.isArray(arr) && arr.length > 0 ? teamName(arr[0]) : '');
      const two = (arr) => [0,1].map(i => (Array.isArray(arr) && arr[i] ? teamName(arr[i]) : ''));
      const four = (arr) => [0,1,2,3].map(i => (Array.isArray(arr) && arr[i] ? teamName(arr[i]) : ''));

      const champion = one(preds.champion);
      const runnerUp = one(preds.runnerUp);
      const thirdPlace = one(preds.thirdPlace);
      const fourthPlace = one(preds.fourthPlace);
      const [f56_1, f56_2] = two(preds.fifthToSixth);
      const [s78_1, s78_2] = two(preds.seventhToEighth);
      const [n12_1, n12_2, n12_3, n12_4] = four(preds.ninthToTwelfth);
      const [t16_1, t16_2, t16_3, t16_4] = four(preds.thirteenthToSixteenth);
      
      const poolArr = Array.isArray(preds.pool) ? preds.pool : [];
      const poolNames = poolArr.map(teamName);

      let submittedAt = '';
      if (data.lastUpdated) {
        if (data.lastUpdated.toDate) {
          submittedAt = data.lastUpdated.toDate().toISOString();
        } else if (data.lastUpdated._seconds) {
          submittedAt = new Date(data.lastUpdated._seconds * 1000).toISOString();
        } else {
          submittedAt = new Date(data.lastUpdated).toISOString();
        }
      }

      rows.push([
        data.userId || doc.id,
        profile.displayName || profile.name || '',
        profile.discordUsername || '',
        submittedAt,
        champion,
        runnerUp,
        thirdPlace,
        fourthPlace,
        f56_1, f56_2,
        s78_1, s78_2,
        n12_1, n12_2, n12_3, n12_4,
        t16_1, t16_2, t16_3, t16_4,
        poolNames.length,
        poolNames.join(' | ')
      ]);
    });

    // Generate CSV
    const csv = toCsv(rows);
    const filename = `pickem_export_${new Date().toISOString().slice(0,10)}.csv`;
    
    // Write to file
    fs.writeFileSync(filename, csv, 'utf-8');
    
    console.log(`✅ Successfully exported ${rows.length - 1} pickem entries to ${filename}`);
    console.log(`📁 File size: ${fs.statSync(filename).size} bytes`);
    console.log(`📊 CSV Preview (first 3 rows):`);
    
    const previewRows = csv.split('\n').slice(0, 3);
    previewRows.forEach((row, i) => {
      console.log(`   Row ${i}: ${row.slice(0, 100)}${row.length > 100 ? '...' : ''}`);
    });

  } catch (error) {
    console.error('❌ Export failed:', error);
    process.exit(1);
  }
}

// Run the export
exportPickemData()
  .then(() => {
    console.log('🎉 Export completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });