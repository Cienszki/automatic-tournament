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

async function exportPickemScores() {
  try {
    console.log('🔧 Initializing Firebase Admin SDK...');
    const app = initializeAdmin();
    const db = admin.firestore();

    console.log('📊 Fetching data from Firestore...');
    
    // Fetch all collections in parallel
    const [pickemsSnap, teamsSnap, usersSnap] = await Promise.all([
      db.collection('pickems').get(),
      db.collection('teams').get(),
      db.collection('users').get().catch(() => ({ docs: [] }))
    ]);

    console.log(`Found ${pickemsSnap.docs.length} pickems, ${teamsSnap.docs.length} teams, ${usersSnap.docs.length} user profiles`);

    // Build lookup maps
    const teams = new Map();
    teamsSnap.docs.forEach(doc => teams.set(doc.id, { id: doc.id, ...doc.data() }));

    const users = new Map();
    usersSnap.docs.forEach(doc => users.set(doc.id, { id: doc.id, ...doc.data() }));

    // Get all unique team IDs from all pickems to create dynamic columns
    const allTeamIds = new Set();
    pickemsSnap.docs.forEach(doc => {
      const data = doc.data();
      if (data.scores) {
        Object.keys(data.scores).forEach(teamId => allTeamIds.add(teamId));
      }
    });

    // Sort team IDs by team name for consistent column order
    const sortedTeamIds = Array.from(allTeamIds).sort((a, b) => {
      const teamA = teams.get(a)?.name || teams.get(a)?.tag || a;
      const teamB = teams.get(b)?.name || teams.get(b)?.tag || b;
      return teamA.localeCompare(teamB);
    });

    console.log(`Found ${sortedTeamIds.length} unique teams in Pick'em scores`);

    // Build headers
    const headers = [
      'userId',
      'displayName',
      'submittedAt',
      'totalScore',
      ...sortedTeamIds.map(teamId => {
        const team = teams.get(teamId);
        const teamName = team?.name || team?.tag || teamId;
        return `${teamName} (${teamId.slice(0,8)})`;
      })
    ];

    const rows = [headers];

    console.log('🔄 Processing pickem documents...');

    // Sort pickems by total score (descending) for leaderboard effect
    const pickemsWithScores = pickemsSnap.docs.map(doc => {
      const data = { userId: doc.id, ...doc.data() };
      const totalScore = data.scores ? Object.values(data.scores).reduce((sum, score) => sum + (score || 0), 0) : 0;
      return { doc, data, totalScore };
    }).sort((a, b) => b.totalScore - a.totalScore);

    pickemsWithScores.forEach(({ doc, data, totalScore }, index) => {
      const profile = users.get(data.userId) || users.get(doc.id) || {};

      console.log(`Processing ${index + 1}/${pickemsWithScores.length}: ${data.userId} (${totalScore} points)`);

      let submittedAt = '';
      if (data.lastUpdated) {
        try {
          if (data.lastUpdated.toDate) {
            submittedAt = data.lastUpdated.toDate().toISOString();
          } else if (data.lastUpdated._seconds) {
            submittedAt = new Date(data.lastUpdated._seconds * 1000).toISOString();
          } else {
            submittedAt = new Date(data.lastUpdated).toISOString();
          }
        } catch (e) {
          console.log(`  Warning: Could not parse date for ${data.userId}`);
        }
      }

      // Build row with user info and scores for each team
      const row = [
        data.userId || doc.id,
        profile.displayName || profile.name || profile.username || '',
        submittedAt,
        totalScore,
        ...sortedTeamIds.map(teamId => (data.scores && data.scores[teamId]) || 0)
      ];

      rows.push(row);
    });

    // Generate CSV
    const csv = toCsv(rows);
    const filename = `pickem_scores_export_${new Date().toISOString().slice(0,10)}.csv`;
    
    // Write to file
    fs.writeFileSync(filename, csv, 'utf-8');
    
    console.log(`✅ Successfully exported ${rows.length - 1} pickem entries to ${filename}`);
    console.log(`📁 File size: ${fs.statSync(filename).size} bytes`);
    console.log(`📊 Top 5 Pick'em performers:`);
    
    pickemsWithScores.slice(0, 5).forEach((entry, i) => {
      const profile = users.get(entry.data.userId) || {};
      const displayName = profile.displayName || profile.name || entry.data.userId;
      console.log(`   ${i + 1}. ${displayName}: ${entry.totalScore} points`);
    });

    console.log(`\n📈 CSV Structure:`);
    console.log(`   - ${sortedTeamIds.length} team score columns`);
    console.log(`   - Teams included: ${sortedTeamIds.slice(0, 5).map(id => teams.get(id)?.name || id).join(', ')}${sortedTeamIds.length > 5 ? '...' : ''}`);

  } catch (error) {
    console.error('❌ Export failed:', error);
    process.exit(1);
  }
}

// Run the export
exportPickemScores()
  .then(() => {
    console.log('🎉 Export completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });