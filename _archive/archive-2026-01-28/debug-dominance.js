const admin = require('firebase-admin');
const fs = require('fs');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  const serviceAccount = require('./automatic-tournament-firebase-adminsdk-4tki1-5c7cbc3b4e.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function debugDominance() {
  console.log('🔍 Debugging Most Dominant Victory calculation...');
  
  try {
    // Get teams
    const teamsSnap = await db.collection('teams').get();
    console.log(`📊 Found ${teamsSnap.size} teams`);
    
    // Get performances 
    const performancesSnap = await db.collection('performances').get();
    console.log(`🎮 Found ${performancesSnap.size} performances`);
    
    // Get games
    const gamesSnap = await db.collection('games').get();
    console.log(`🏆 Found ${gamesSnap.size} games`);
    
    // Check first team's data
    const firstTeam = teamsSnap.docs[0];
    const teamId = firstTeam.id;
    const teamName = firstTeam.data().name;
    
    console.log(`\n🎯 Analyzing team: ${teamName} (ID: ${teamId})`);
    
    // Get team's performances
    const teamPerfs = [];
    performancesSnap.docs.forEach(doc => {
      const perf = doc.data();
      if (perf.teamId === teamId || perf.team_id === teamId) {
        teamPerfs.push({ ...perf, id: doc.id });
      }
    });
    
    console.log(`📈 Team has ${teamPerfs.length} performances`);
    
    // Get team's games
    const teamGames = [];
    gamesSnap.docs.forEach(doc => {
      const game = doc.data();
      if (game.radiant_team?.id === teamId || game.dire_team?.id === teamId) {
        teamGames.push({ ...game, id: doc.id });
      }
    });
    
    console.log(`🎲 Team has ${teamGames.length} games`);
    
    // Show sample performance data
    if (teamPerfs.length > 0) {
      const samplePerf = teamPerfs[0];
      console.log(`\n📋 Sample performance data keys:`, Object.keys(samplePerf));
      console.log(`   Net worth field: net_worth=${samplePerf.net_worth}, netWorth=${samplePerf.netWorth}`);
    }
    
    // Show sample game data 
    if (teamGames.length > 0) {
      const sampleGame = teamGames[0];
      console.log(`\n🎮 Sample game data keys:`, Object.keys(sampleGame));
      console.log(`   Radiant team: ${sampleGame.radiant_team?.id}, Dire team: ${sampleGame.dire_team?.id}`);
      console.log(`   Radiant won: ${sampleGame.radiant_win}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugDominance();
