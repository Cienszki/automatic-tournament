// List all mockup data in the database
require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');

// Initialize Firebase Admin using environment variable
if (!admin.apps.length) {
  const base64EncodedServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  
  if (!base64EncodedServiceAccount) {
    console.error('❌ FIREBASE_SERVICE_ACCOUNT_BASE64 environment variable is not set');
    process.exit(1);
  }

  const serviceAccount = JSON.parse(
    Buffer.from(base64EncodedServiceAccount, 'base64').toString('utf-8')
  );

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function listAllData() {
  console.log('\n=== LISTING ALL TOURNAMENT DATA ===\n');

  try {
    // List tournaments
    const tournamentsSnapshot = await db.collection('tournaments').get();
    console.log(`📊 Found ${tournamentsSnapshot.size} tournament(s):\n`);

    for (const tournamentDoc of tournamentsSnapshot.docs) {
      const tournamentData = tournamentDoc.data();
      console.log(`\n🏆 Tournament: ${tournamentDoc.id}`);
      console.log(`   Name: ${tournamentData.name || 'N/A'}`);
      console.log(`   Type: ${tournamentData.type || 'N/A'}`);
      console.log(`   Status: ${tournamentData.status || 'N/A'}`);

      // List teams in this tournament
      const teamsSnapshot = await db
        .collection('tournaments')
        .doc(tournamentDoc.id)
        .collection('teams')
        .get();

      console.log(`\n   👥 Teams (${teamsSnapshot.size}):`);
      for (const teamDoc of teamsSnapshot.docs) {
        const teamData = teamDoc.data();
        
        // Count players
        const playersSnapshot = await db
          .collection('tournaments')
          .doc(tournamentDoc.id)
          .collection('teams')
          .doc(teamDoc.id)
          .collection('players')
          .get();

        console.log(`      - ${teamDoc.id}`);
        console.log(`        Name: ${teamData.name || 'N/A'}`);
        console.log(`        Tag: ${teamData.tag || 'N/A'}`);
        console.log(`        Division: ${teamData.divisionId || 'None'}`);
        console.log(`        Status: ${teamData.status || 'N/A'}`);
        console.log(`        Players: ${playersSnapshot.size}`);
      }

      // List divisions
      const divisionsSnapshot = await db
        .collection('tournaments')
        .doc(tournamentDoc.id)
        .collection('divisions')
        .get();

      if (divisionsSnapshot.size > 0) {
        console.log(`\n   📊 Divisions (${divisionsSnapshot.size}):`);
        for (const divDoc of divisionsSnapshot.docs) {
          const divData = divDoc.data();
          console.log(`      - ${divDoc.id}: ${divData.name || 'N/A'}`);
        }
      }

      // List matches
      const matchesSnapshot = await db
        .collection('tournaments')
        .doc(tournamentDoc.id)
        .collection('matches')
        .get();

      if (matchesSnapshot.size > 0) {
        console.log(`\n   🎮 Matches: ${matchesSnapshot.size}`);
      }

      // List standings
      const standingsSnapshot = await db
        .collection('tournaments')
        .doc(tournamentDoc.id)
        .collection('standings')
        .get();

      if (standingsSnapshot.size > 0) {
        console.log(`   📈 Standings: ${standingsSnapshot.size}`);
      }

      // List fantasy lineups
      const fantasySnapshot = await db
        .collection('tournaments')
        .doc(tournamentDoc.id)
        .collection('fantasyLineups')
        .get();

      if (fantasySnapshot.size > 0) {
        console.log(`   ⭐ Fantasy Lineups: ${fantasySnapshot.size}`);
      }

      console.log('\n' + '─'.repeat(80));
    }

    // Check legacy collections (not under tournaments)
    console.log('\n\n=== LEGACY COLLECTIONS (NOT TOURNAMENT-SCOPED) ===\n');

    const legacyTeams = await db.collection('teams').get();
    if (legacyTeams.size > 0) {
      console.log(`📦 Legacy teams collection: ${legacyTeams.size} teams`);
      legacyTeams.docs.slice(0, 5).forEach(doc => {
        console.log(`   - ${doc.id}: ${doc.data().name || 'N/A'}`);
      });
      if (legacyTeams.size > 5) {
        console.log(`   ... and ${legacyTeams.size - 5} more`);
      }
    }

    const legacyMatches = await db.collection('matches').get();
    if (legacyMatches.size > 0) {
      console.log(`\n📦 Legacy matches collection: ${legacyMatches.size} matches`);
    }

    const legacyStandings = await db.collection('standings').get();
    if (legacyStandings.size > 0) {
      console.log(`📦 Legacy standings collection: ${legacyStandings.size} standings`);
    }

  } catch (error) {
    console.error('Error listing data:', error);
  }
}

listAllData().then(() => {
  console.log('\n✅ Done listing data\n');
  process.exit(0);
});
