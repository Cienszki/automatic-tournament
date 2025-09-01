#!/usr/bin/env node

// Script to show the complete fantasy leaderboard with new balanced scoring
const admin = require('firebase-admin');

// Initialize Firebase Admin if not already done
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
      databaseURL: process.env.FIREBASE_DATABASE_URL
    });
    console.log('Firebase Admin SDK initialized successfully.');
  } catch (error) {
    console.error('Failed to initialize Firebase:', error.message);
    process.exit(1);
  }
}

const db = admin.firestore();

async function getCompleteFantasyLeaderboard() {
  console.log('🏆 COMPLETE FANTASY LEADERBOARD (New Balanced Scoring System)\n');
  console.log('=' .repeat(100));
  
  try {
    // Get all fantasy users
    const fantasySnapshot = await db.collection('fantasyLineups').get();
    const leaderboard = [];
    
    for (const userDoc of fantasySnapshot.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();
      
      // Get user's display name from auth or use email/ID
      let displayName = userId; // Default to user ID
      try {
        const userRecord = await admin.auth().getUser(userId);
        displayName = userRecord.displayName || userRecord.email || userId;
      } catch (error) {
        // Ignore auth errors, use userId as fallback
      }
      
      let totalPoints = 0;
      let totalGames = 0;
      const roundBreakdown = [];
      
      // Check for rounds subcollection
      const roundsSnapshot = await userDoc.ref.collection('rounds').get();
      
      if (!roundsSnapshot.empty) {
        for (const roundDoc of roundsSnapshot.docs) {
          const roundId = roundDoc.id;
          const roundData = roundDoc.data();
          
          const roundPoints = roundData.totalScore || 0;
          const roundGames = roundData.gamesPlayed || 0;
          
          totalPoints += roundPoints;
          totalGames += roundGames;
          
          roundBreakdown.push({
            round: roundId,
            points: roundPoints,
            games: roundGames,
            average: roundGames > 0 ? (roundPoints / roundGames) : 0
          });
        }
      }
      
      const averageScore = totalGames > 0 ? totalPoints / totalGames : 0;
      
      leaderboard.push({
        userId,
        displayName,
        totalPoints,
        totalGames,
        averageScore,
        roundBreakdown
      });
    }
    
    // Sort by total points (descending)
    leaderboard.sort((a, b) => b.totalPoints - a.totalPoints);
    
    // Display the leaderboard
    console.log(`Rank | User Name${' '.repeat(35)} | Total Pts | Games | Avg PPG | Round Breakdown`);
    console.log('-'.repeat(100));
    
    leaderboard.forEach((user, index) => {
      const rank = `${index + 1}.`.padEnd(4);
      const name = user.displayName.substring(0, 40).padEnd(42);
      const total = user.totalPoints.toFixed(1).padStart(9);
      const games = user.totalGames.toString().padStart(5);
      const avg = user.averageScore.toFixed(1).padStart(7);
      
      // Round breakdown string
      const breakdown = user.roundBreakdown
        .map(r => `${r.round}: ${r.points.toFixed(0)}pts/${r.games}g (${r.average.toFixed(1)}avg)`)
        .join(', ');
      
      console.log(`${rank} | ${name} | ${total} | ${games} | ${avg} | ${breakdown}`);
    });
    
    console.log('\n' + '=' .repeat(100));
    console.log(`📊 SUMMARY:`);
    console.log(`   Total Fantasy Users: ${leaderboard.length}`);
    console.log(`   Active Users (played games): ${leaderboard.filter(u => u.totalGames > 0).length}`);
    console.log(`   Total Points Distributed: ${leaderboard.reduce((sum, u) => sum + u.totalPoints, 0).toFixed(1)}`);
    console.log(`   Total Games Played: ${leaderboard.reduce((sum, u) => sum + u.totalGames, 0)}`);
    
    const activeUsers = leaderboard.filter(u => u.totalGames > 0);
    if (activeUsers.length > 0) {
      const avgScore = activeUsers.reduce((sum, u) => sum + u.averageScore, 0) / activeUsers.length;
      const topScore = activeUsers[0].averageScore;
      const medianScore = activeUsers[Math.floor(activeUsers.length / 2)].averageScore;
      
      console.log(`   Average Score: ${avgScore.toFixed(1)} PPG`);
      console.log(`   Highest Average: ${topScore.toFixed(1)} PPG`);
      console.log(`   Median Average: ${medianScore.toFixed(1)} PPG`);
    }
    
    console.log('\n🎯 NEW BALANCED SCORING FEATURES:');
    console.log('   ✅ Role-balanced multipliers (Mid 3.8x kills, Offlane 3.0x kills, Hard Support healing nerfed)');
    console.log('   ✅ Individual skill rewarded over team selection');  
    console.log('   ✅ No performance floor - bad play gets punished');
    console.log('   ✅ Uncapped excellence bonuses for elite performances');
    console.log('   ✅ Mixed lineups now competitive vs same-team strategies');
    
  } catch (error) {
    console.error('Error fetching fantasy leaderboard:', error);
  }
}

// Run the script
if (require.main === module) {
  getCompleteFantasyLeaderboard().then(() => {
    process.exit(0);
  }).catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
}

module.exports = { getCompleteFantasyLeaderboard };