const admin = require('firebase-admin');
const fs = require('fs');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  // Try to load service account from environment or file
  let serviceAccount;
  
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    serviceAccount = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf-8'));
  } else {
    // Try common service account file names
    const possibleFiles = [
      './automatic-tournament-firebase-adminsdk-4tki1-5c7cbc3b4e.json',
      './firebase-adminsdk.json',
      './serviceAccountKey.json'
    ];
    
    for (const file of possibleFiles) {
      if (fs.existsSync(file)) {
        serviceAccount = require(file);
        console.log(`Using service account from: ${file}`);
        break;
      }
    }
  }
  
  if (!serviceAccount) {
    console.error('No Firebase service account found. Please set FIREBASE_SERVICE_ACCOUNT_BASE64 or place service account JSON in project root.');
    process.exit(1);
  }
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

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
  console.log('🔍 Starting Pick\'em data export...');
  
  try {
    // Fetch all collections
    console.log('📊 Fetching data from Firestore...');
    const [pickemsSnap, teamsSnap, usersSnap] = await Promise.all([
      db.collection('pickems').get(),
      db.collection('teams').get(),
      db.collection('userProfiles').get().catch(() => ({ docs: [] }))
    ]);

    console.log(`Found ${pickemsSnap.size} pickems, ${teamsSnap.size} teams, ${usersSnap.size} user profiles`);

    // Build lookup maps
    const teams = new Map();
    teamsSnap.docs.forEach(doc => teams.set(doc.id, { id: doc.id, ...doc.data() }));

    const users = new Map();
    usersSnap.docs.forEach(doc => users.set(doc.id, { id: doc.id, ...doc.data() }));

    // Helper to map teamId -> display name
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

    console.log('📝 Processing Pick\'em documents...');

    // Sample first document to debug structure
    if (pickemsSnap.size > 0) {
      const sampleDoc = pickemsSnap.docs[0];
      const sampleData = sampleDoc.data();
      console.log(`\n🔍 Sample document structure (${sampleDoc.id}):`);
      console.log('Keys:', Object.keys(sampleData));
      console.log('Predictions:', sampleData.predictions ? Object.keys(sampleData.predictions) : 'none');
      console.log('Sample data:', JSON.stringify(sampleData, null, 2));
    }

    pickemsSnap.docs.forEach(doc => {
      const data = { userId: doc.id, ...doc.data() };
      const preds = data.predictions || {};
      const profile = users.get(data.userId) || users.get(doc.id) || {};

      console.log(`Processing user ${doc.id}:`, {
        hasProfile: !!profile.displayName,
        predictionKeys: Object.keys(preds),
        champion: preds.champion,
        pool: preds.pool
      });

      // Normalize arrays per category
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

      const submittedAt = (data.lastUpdated && (data.lastUpdated.toDate ? data.lastUpdated.toDate() : new Date(data.lastUpdated))) || '';

      rows.push([
        data.userId || doc.id,
        profile.displayName || profile.name || '',
        profile.discordUsername || '',
        submittedAt ? new Date(submittedAt).toISOString() : '',
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

    console.log(`📊 Generated ${rows.length - 1} data rows`);

    const csv = toCsv(rows);
    const filename = `pickem_export_${new Date().toISOString().slice(0,10)}.csv`;

    fs.writeFileSync(filename, csv, 'utf8');
    console.log(`✅ Export completed: ${filename}`);
    console.log(`📄 File size: ${fs.statSync(filename).size} bytes`);
    
    // Show first few lines
    console.log('\n📋 First few lines of CSV:');
    const lines = csv.split('\n');
    lines.slice(0, 5).forEach((line, i) => {
      console.log(`${i + 1}: ${line}`);
    });

  } catch (error) {
    console.error('❌ Export failed:', error);
  }
}

exportPickemData();