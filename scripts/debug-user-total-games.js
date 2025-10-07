// Debug User Total Games Script
// Checks actual game count across all rounds for specific users
require('dotenv').config({ path: '.env.local' });
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { credential } = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
const serviceAccount = JSON.parse(Buffer.from(serviceAccountBase64, 'base64').toString('utf-8'));
initializeApp({ credential: credential.cert(serviceAccount) });

const db = getFirestore();

async function debugUserTotalGames() {
  try {
    console.log('🔍 Debugging User Total Games Across All Rounds...\n');

    const testUsers = ['BeBoy', 'ybrish', 'dave'];

    for (const userName of testUsers) {
      console.log(`\n=== ${userName.toUpperCase()} ===`);

      // Find user in fantasyLineups
      const fantasyLineupsRef = db.collection('fantasyLineups');
      const userQuery = await fantasyLineupsRef.where('displayName', '==', userName).limit(1).get();

      if (userQuery.empty) {
        console.log(`❌ User ${userName} not found in fantasyLineups`);
        continue;
      }

      const userDoc = userQuery.docs[0];
      const userId = userDoc.id;
      const userData = userDoc.data();

      console.log(`User ID: ${userId}`);
      console.log(`Current total games: ${userData.gamesPlayed || 0}`);
      console.log(`Current total score: ${userData.totalFantasyScore || 0}`);

      // Check all rounds for this user
      const userRoundsRef = userDoc.ref.collection('rounds');
      const userRoundsSnap = await userRoundsRef.get();

      console.log(`Found ${userRoundsSnap.size} rounds:`);

      let totalGamesAcrossAllRounds = 0;
      let totalScoreAcrossAllRounds = 0;

      for (const roundDoc of userRoundsSnap.docs) {
        const roundId = roundDoc.id;
        const roundData = roundDoc.data();

        console.log(`\n  Round: ${roundId}`);
        console.log(`    Round score: ${roundData.roundScore || 0}`);
        console.log(`    Lineup: ${roundData.lineup ? Object.keys(roundData.lineup).join(', ') : 'None'}`);

        // Count actual games in this round by checking performances
        let gamesInThisRound = 0;
        let scoreInThisRound = 0;

        // Get all matches for this round
        const matchesRef = db.collection('matches');
        let matchesQuery;

        if (roundId === 'group_stage') {
          matchesQuery = matchesRef.where('group_id', '!=', null);
        } else if (roundId.startsWith('playoffs_')) {
          const roundNumber = parseInt(roundId.replace('playoffs_round', ''));
          matchesQuery = matchesRef.where('playoff_round', '==', roundNumber);
        } else if (roundId === 'wildcards') {
          matchesQuery = matchesRef.where('round', '==', 'wildcards');
        } else {
          // Try to find by round field
          matchesQuery = matchesRef.where('round', '==', roundId);
        }

        try {
          const matchesSnap = await matchesQuery.get();

          for (const matchDoc of matchesSnap.docs) {
            const gamesRef = matchDoc.ref.collection('games');
            const gamesSnap = await gamesRef.get();

            for (const gameDoc of gamesSnap.docs) {
              const performancesRef = gameDoc.ref.collection('performances');
              const performancesSnap = await performancesRef.get();

              // Check if this user has a performance in this game
              const userPerformance = performancesSnap.docs.find(perfDoc => {
                const perfData = perfDoc.data();
                return perfData.playerId === userId || perfData.teamId === userData.teamId;
              });

              if (userPerformance) {
                gamesInThisRound++;
                const perfData = userPerformance.data();
                scoreInThisRound += perfData.fantasyPoints || 0;
              }
            }
          }
        } catch (queryError) {
          console.log(`    ⚠️  Error querying matches for ${roundId}:`, queryError.message);
        }

        console.log(`    Actual games found: ${gamesInThisRound}`);
        console.log(`    Actual score from games: ${scoreInThisRound.toFixed(2)}`);

        totalGamesAcrossAllRounds += gamesInThisRound;
        totalScoreAcrossAllRounds += scoreInThisRound;
      }

      console.log(`\n📊 SUMMARY for ${userName}:`);
      console.log(`  Database shows: ${userData.gamesPlayed || 0} games`);
      console.log(`  Actual total: ${totalGamesAcrossAllRounds} games`);
      console.log(`  Database shows: ${(userData.totalFantasyScore || 0).toFixed(2)} points`);
      console.log(`  Actual total: ${totalScoreAcrossAllRounds.toFixed(2)} points`);

      if (totalGamesAcrossAllRounds !== userData.gamesPlayed) {
        console.log(`  ❌ MISMATCH: Database should show ${totalGamesAcrossAllRounds} games, not ${userData.gamesPlayed}`);
      } else {
        console.log(`  ✅ Games count is correct`);
      }
    }

    console.log('\n✅ Debug analysis complete!');

  } catch (error) {
    console.error('❌ Error during debug analysis:', error);
  } finally {
    process.exit();
  }
}

debugUserTotalGames();