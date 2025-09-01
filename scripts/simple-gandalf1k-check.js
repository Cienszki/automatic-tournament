const admin = require('firebase-admin');

// Try to initialize Firebase Admin using environment approach
if (!admin.apps.length) {
  try {
    // This will use the FIREBASE_SERVICE_ACCOUNT_KEY environment variable
    // or the default service account if running in Firebase environment
    admin.initializeApp({
      // Leave empty to use default credentials
    });
  } catch (error) {
    console.log('❌ Could not initialize Firebase Admin:', error.message);
    console.log('⚠️  Make sure FIREBASE_SERVICE_ACCOUNT_KEY is set or running in Firebase environment');
    process.exit(1);
  }
}

const db = admin.firestore();

async function simpleGandalf1kCheck() {
  console.log('🔍 Simple check for Gandalf1k fantasy scores...\n');

  try {
    // First, find Gandalf1k in tournament players
    console.log('📡 Searching tournament players for Gandalf1k...');
    
    const playersSnap = await db.collection('tournamentPlayers').get();
    let gandalf1kId = null;
    let gandalf1kData = null;
    
    playersSnap.docs.forEach(doc => {
      const player = doc.data();
      if (player.nickname?.toLowerCase().includes('gandalf1k') || 
          player.nickname?.toLowerCase().includes('gandalf')) {
        gandalf1kId = doc.id;
        gandalf1kData = player;
        console.log(`✅ Found: ${player.nickname} (${player.teamName}) - ID: ${gandalf1kId}`);
      }
    });
    
    if (!gandalf1kId) {
      console.log('❌ Gandalf1k not found in tournament players');
      return;
    }
    
    // Now check playerRoundStats for this player
    console.log('\n📊 Checking player round stats...');
    const roundStatsSnap = await db.collection('playerRoundStats')
      .where('playerId', '==', gandalf1kId)
      .get();
    
    if (roundStatsSnap.empty) {
      console.log('❌ No round stats found for Gandalf1k');
      return;
    }
    
    console.log(`✅ Found ${roundStatsSnap.size} round stats entries\n`);
    
    let totalPoints = 0;
    let totalGames = 0;
    
    roundStatsSnap.docs.forEach(doc => {
      const roundData = doc.data();
      console.log(`📋 Round: ${roundData.roundId}`);
      console.log(`   Points: ${roundData.totalFantasyPoints?.toFixed(2) || 0}`);
      console.log(`   Games: ${roundData.gamesPlayed || 0}`);
      console.log(`   Average: ${roundData.averageFantasyScore?.toFixed(2) || 0}`);
      
      if (roundData.gameBreakdown && roundData.gameBreakdown.length > 0) {
        console.log(`   🎮 Individual games:`);
        roundData.gameBreakdown
          .sort((a, b) => (b.fantasyPoints || 0) - (a.fantasyPoints || 0))
          .forEach((game, index) => {
            console.log(`      ${index + 1}. ${(game.fantasyPoints || 0).toFixed(2)} pts - Game ${game.gameId}`);
          });
      }
      
      totalPoints += roundData.totalFantasyPoints || 0;
      totalGames += roundData.gamesPlayed || 0;
      console.log('');
    });
    
    const overallAverage = totalGames > 0 ? totalPoints / totalGames : 0;
    
    console.log('🏆 Overall Summary:');
    console.log('─'.repeat(40));
    console.log(`Player: ${gandalf1kData.nickname} (${gandalf1kData.role})`);
    console.log(`Team: ${gandalf1kData.teamName}`);
    console.log(`Total Fantasy Points: ${totalPoints.toFixed(2)}`);
    console.log(`Total Games: ${totalGames}`);
    console.log(`Overall Average: ${overallAverage.toFixed(2)}`);
    
    // Now let's also manually verify by checking actual performance data
    console.log('\n🔍 Cross-checking with actual performance data...');
    
    const matchesSnap = await db.collection('matches').limit(20).get();
    const actualPerformances = [];
    
    for (const matchDoc of matchesSnap.docs) {
      const matchId = matchDoc.id;
      
      try {
        const gamesSnap = await db.collection('matches').doc(matchId).collection('games').get();
        
        for (const gameDoc of gamesSnap.docs) {
          const gameId = gameDoc.id;
          
          try {
            const perfSnap = await db.collection('matches').doc(matchId)
              .collection('games').doc(gameId)
              .collection('performances').doc(gandalf1kId).get();
            
            if (perfSnap.exists) {
              const perf = perfSnap.data();
              actualPerformances.push({
                matchId,
                gameId,
                fantasyPoints: perf.fantasyPoints || 0,
                kills: perf.kills || 0,
                deaths: perf.deaths || 0,
                assists: perf.assists || 0,
                gpm: perf.gpm || 0,
                xpm: perf.xpm || 0,
                heroDamage: perf.heroDamage || 0
              });
            }
          } catch (e) {
            // Skip if no performance found
          }
        }
      } catch (e) {
        // Skip if no games found
      }
    }
    
    if (actualPerformances.length > 0) {
      console.log(`✅ Found ${actualPerformances.length} actual performances:\n`);
      
      actualPerformances
        .sort((a, b) => b.fantasyPoints - a.fantasyPoints)
        .forEach((perf, index) => {
          console.log(`Game ${index + 1}: ${perf.fantasyPoints.toFixed(2)} fantasy points`);
          console.log(`  🎮 Match: ${perf.matchId}, Game: ${perf.gameId}`);
          console.log(`  📊 KDA: ${perf.kills}/${perf.deaths}/${perf.assists}`);
          console.log(`  💰 GPM: ${perf.gpm}, XPM: ${perf.xpm}`);
          console.log(`  ⚔️  Damage: ${perf.heroDamage?.toLocaleString()}`);
          console.log('');
        });
      
      const actualTotal = actualPerformances.reduce((sum, p) => sum + p.fantasyPoints, 0);
      const actualAvg = actualTotal / actualPerformances.length;
      
      console.log('🔄 Cross-verification:');
      console.log(`Calculated average: ${overallAverage.toFixed(2)}`);
      console.log(`Actual performances average: ${actualAvg.toFixed(2)}`);
      console.log(`Match: ${Math.abs(overallAverage - actualAvg) < 0.1 ? '✅ Yes' : '❌ No'}`);
      
    } else {
      console.log('❌ No actual performances found in recent matches');
    }
    
  } catch (error) {
    console.error('❌ Check failed:', error);
  }
}

simpleGandalf1kCheck();