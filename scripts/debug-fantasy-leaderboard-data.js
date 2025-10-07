// Debug Fantasy Leaderboard Data Script
// Investigates why leaderboards show 0 games despite successful recalculation
require('dotenv').config({ path: '.env.local' });
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { credential } = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
if (!serviceAccountBase64) {
  console.error('FIREBASE_SERVICE_ACCOUNT_BASE64 environment variable is not set');
  process.exit(1);
}

const serviceAccount = JSON.parse(Buffer.from(serviceAccountBase64, 'base64').toString('utf-8'));
initializeApp({ credential: credential.cert(serviceAccount) });

const db = getFirestore();

async function debugFantasyLeaderboardData() {
  try {
    console.log('🔍 Debugging Fantasy Leaderboard Data...\n');

    // Step 1: Check what's in the fantasyLeaderboards collection
    console.log('📊 Checking fantasyLeaderboards collection...');
    const leaderboardsCollectionRef = db.collection('fantasyLeaderboards');
    const leaderboardsSnapshot = await leaderboardsCollectionRef.get();

    console.log(`Found ${leaderboardsSnapshot.size} documents in fantasyLeaderboards collection:`);
    leaderboardsSnapshot.forEach(doc => {
      console.log(`- Document ID: ${doc.id}`);
    });

    // Step 2: Check the 'current' document specifically
    console.log('\n📋 Checking "current" leaderboard document...');
    const currentRef = db.collection('fantasyLeaderboards').doc('current');
    const currentSnap = await currentRef.get();

    if (currentSnap.exists) {
      const currentData = currentSnap.data();
      console.log('✅ Current document exists');
      console.log('Generated at:', currentData.generatedAt);
      console.log('Algorithm:', currentData.algorithm);
      console.log('Overall entries:', currentData.overall?.length || 0);

      // Check specific users that should have game counts
      const testUsers = ['BeBoy', 'ybrish', 'dave', 'SZATOŚI CI PRZYSZTOSI FUJARE'];
      console.log('\n👥 Checking specific users in leaderboard data:');

      testUsers.forEach(userName => {
        const user = currentData.overall?.find(u => u.displayName === userName);
        if (user) {
          console.log(`\n--- ${userName} ---`);
          console.log('User ID:', user.userId);
          console.log('Total Score:', user.totalScore);
          console.log('Games Played:', user.gamesPlayed);
          console.log('Player Games:', user.playerGames);
          console.log('Average Score:', user.averageScore);
          console.log('Rank:', user.rank);
          console.log('All keys:', Object.keys(user));
        } else {
          console.log(`❌ ${userName} not found in leaderboard`);
        }
      });

      // Sample a few users to see the structure
      console.log('\n📋 Sample of first 3 users in leaderboard:');
      (currentData.overall || []).slice(0, 3).forEach((user, index) => {
        console.log(`\n${index + 1}. ${user.displayName}:`);
        console.log('   Total Score:', user.totalScore);
        console.log('   Games Played:', user.gamesPlayed);
        console.log('   Player Games:', user.playerGames);
        console.log('   Average Score:', user.averageScore);
        console.log('   All keys:', Object.keys(user).join(', '));
      });

    } else {
      console.log('❌ Current document does not exist');
    }

    // Step 3: Check individual user fantasyLineups for comparison
    console.log('\n🔍 Checking individual fantasyLineups for comparison...');
    const fantasyLineupsRef = db.collection('fantasyLineups');
    const userDoc = await fantasyLineupsRef.doc('1uTIoCrW2vaa0rMy04MR55Pt3GA2').get(); // BeBoy's ID

    if (userDoc.exists) {
      const userData = userDoc.data();
      console.log('\n👤 BeBoy\'s fantasyLineups document:');
      console.log('Display Name:', userData.displayName);
      console.log('Total Fantasy Score:', userData.totalFantasyScore);
      console.log('Games Played:', userData.gamesPlayed);
      console.log('Average Fantasy Score:', userData.averageFantasyScore);
      console.log('Last Recalculated At:', userData.lastRecalculatedAt);
      console.log('All keys:', Object.keys(userData).join(', '));
    }

    // Step 4: Test the API endpoint directly
    console.log('\n🌐 Testing fantasy leaderboards API response structure...');
    try {
      // Simulate what the API does
      const leaderboardsRef = db.collection('fantasyLeaderboards').doc('current');
      const leaderboardsSnap = await leaderboardsRef.get();

      if (leaderboardsSnap.exists) {
        const leaderboardsData = leaderboardsSnap.data();

        // Transform the data exactly like the API does
        const transformedLeaderboards = {
          overall: (leaderboardsData?.overall || []).map((entry) => {
            const gamesPlayed = entry.gamesPlayed || entry.playerGames || 0;
            return {
              userId: entry.userId,
              displayName: entry.displayName,
              totalScore: entry.totalScore,
              gamesPlayed: gamesPlayed,
              averageScore: entry.averageScore,
              rank: entry.rank,
              currentLineup: entry.currentLineup || {}
            };
          })
        };

        console.log('\n📊 API Transformation Results:');
        console.log('Total users after transformation:', transformedLeaderboards.overall.length);

        // Check the same test users
        testUsers.forEach(userName => {
          const user = transformedLeaderboards.overall.find(u => u.displayName === userName);
          if (user) {
            console.log(`${userName}: ${user.gamesPlayed} games (transformed)`);
          }
        });

        // Check how many users have 0 games
        const usersWithZeroGames = transformedLeaderboards.overall.filter(u => u.gamesPlayed === 0);
        const usersWithGames = transformedLeaderboards.overall.filter(u => u.gamesPlayed > 0);

        console.log(`\n📈 Game Count Summary:`);
        console.log(`Users with 0 games: ${usersWithZeroGames.length}`);
        console.log(`Users with >0 games: ${usersWithGames.length}`);

        if (usersWithGames.length > 0) {
          console.log('\nUsers with games:');
          usersWithGames.slice(0, 5).forEach(u => {
            console.log(`- ${u.displayName}: ${u.gamesPlayed} games`);
          });
        }

      }
    } catch (apiError) {
      console.log('❌ Error testing API transformation:', apiError.message);
    }

    console.log('\n✅ Debug analysis complete!');

  } catch (error) {
    console.error('❌ Error during debug analysis:', error);
  } finally {
    process.exit();
  }
}

debugFantasyLeaderboardData();