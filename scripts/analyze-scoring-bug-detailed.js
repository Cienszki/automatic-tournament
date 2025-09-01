#!/usr/bin/env node

const admin = require('firebase-admin');

// Initialize Firebase Admin if not already done
if (!admin.apps.length) {
  try {
    // Load environment variables
    require('dotenv').config({ path: '.env.local' });
    
    // Decode the base64 encoded service account
    const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
    if (!serviceAccountBase64) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_BASE64 environment variable not found');
    }
    
    const serviceAccount = JSON.parse(Buffer.from(serviceAccountBase64, 'base64').toString('utf8'));
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase Admin SDK initialized successfully.');
  } catch (error) {
    console.error('Failed to initialize Firebase:', error.message);
    process.exit(1);
  }
}

const db = admin.firestore();

async function analyzeScoringBugDetailed() {
  console.log('🔍 Detailed analysis of fantasy scoring bug in Klałn Fiesta vs Psychiatryk matches...\n');

  const buggyMatchId = 'J95h0uRTgPUe0zh4EEsi';
  const buggyGameIds = ['8434604708', '8434681576'];

  try {
    // First, let's get detailed match and game data
    console.log(`📊 ANALYZING MATCH: ${buggyMatchId}`);
    console.log('═'.repeat(80));

    const matchDoc = await db.collection('matches').doc(buggyMatchId).get();
    if (!matchDoc.exists) {
      console.log('❌ Match document not found');
      return;
    }

    const matchData = matchDoc.data();
    console.log(`📋 Match Info:`);
    console.log(`   Round: ${matchData.round || 'Unknown'}`);
    console.log(`   Date: ${matchData.date || matchData.createdAt || 'Unknown'}`);
    console.log(`   Status: ${matchData.status || 'Unknown'}`);
    console.log(`   Teams: ${matchData.team1?.name || 'Unknown'} vs ${matchData.team2?.name || 'Unknown'}`);
    console.log();

    // Analyze each buggy game in detail
    for (const gameId of buggyGameIds) {
      console.log(`🎮 DETAILED GAME ANALYSIS: ${gameId}`);
      console.log('─'.repeat(60));

      const gameDoc = await db.collection('matches').doc(buggyMatchId)
        .collection('games').doc(gameId).get();

      if (!gameDoc.exists) {
        console.log('❌ Game document not found');
        continue;
      }

      const gameData = gameDoc.data();
      console.log(`📊 Game Metadata:`);
      console.log(`   Duration: ${gameData.duration || 0} seconds (${((gameData.duration || 0) / 60).toFixed(1)} minutes)`);
      console.log(`   Radiant Win: ${gameData.radiantWin ? 'Yes' : 'No'}`);
      console.log(`   OpenDota Match ID: ${gameData.opendotaMatchId || 'Unknown'}`);
      console.log(`   Created: ${gameData.createdAt || 'Unknown'}`);
      console.log(`   Updated: ${gameData.updatedAt || 'Unknown'}`);
      console.log(`   Import Source: ${gameData.importSource || 'Unknown'}`);
      console.log();

      // Get performance data and analyze the fantasy scoring calculation
      const performancesSnap = await db.collection('matches').doc(buggyMatchId)
        .collection('games').doc(gameId)
        .collection('performances').get();

      console.log(`👥 PERFORMANCE DATA (${performancesSnap.size} players):`);

      const performances = [];
      for (const perfDoc of performancesSnap.docs) {
        const perf = perfDoc.data();
        performances.push({
          playerId: perfDoc.id,
          ...perf
        });
      }

      // Sort by fantasy points for easier analysis
      performances.sort((a, b) => (b.fantasyPoints || 0) - (a.fantasyPoints || 0));

      performances.forEach((perf, index) => {
        console.log(`\n${index + 1}. ${perf.playerName || perf.nickname || 'Unknown'} (${perf.teamName || 'Unknown'})`);
        console.log(`   📊 Fantasy Points: ${(perf.fantasyPoints || 0).toFixed(2)}`);
        console.log(`   ⚔️  Basic Stats: ${perf.kills || 0}/${perf.deaths || 0}/${perf.assists || 0}`);
        console.log(`   💰 Economy: ${perf.gpm || 0} GPM, ${perf.xpm || 0} XPM`);
        console.log(`   🏗️  Farm: ${perf.lastHits || 0} LH, ${perf.denies || 0} denies`);
        console.log(`   ⚔️  Combat: ${(perf.heroDamage || 0).toLocaleString()} hero dmg, ${(perf.netWorth || 0).toLocaleString()} NW`);
        console.log(`   🏢 Objectives: ${(perf.towerDamage || 0).toLocaleString()} tower dmg`);
        console.log(`   🔍 Wards: ${perf.obsPlaced || 0} obs, ${perf.senPlaced || 0} sen`);
        console.log(`   🎯 Special: ${perf.courierKills || 0} courier, FB: ${perf.firstBloodClaimed ? 'Yes' : 'No'}`);
        
        // Let's manually calculate what the fantasy score SHOULD be using normal algorithm
        const gameDurationMinutes = (gameData.duration || 0) / 60;
        
        // Basic fantasy scoring components (simplified)
        let expectedScore = 0;
        
        // Kills (typically 2-3 points each for mid)
        expectedScore += (perf.kills || 0) * 2.3;
        
        // Deaths (typically -1.5 to -2 points each)
        expectedScore += (perf.deaths || 0) * -1.8;
        
        // Assists (typically 1-1.5 points each)
        expectedScore += (perf.assists || 0) * 1.2;
        
        // Tower damage (1 point per 1000, capped at 15)
        const towerPoints = Math.min((perf.towerDamage || 0) / 1000, 15);
        expectedScore += towerPoints;
        
        // Observer wards (typically 2-3 points each)
        expectedScore += (perf.obsPlaced || 0) * 2.5;
        
        // Sentry wards (typically 1-2 points each)
        expectedScore += (perf.senPlaced || 0) * 1.5;
        
        // Courier kills (typically 5-10 points each)
        expectedScore += (perf.courierKills || 0) * 8;
        
        // First blood (typically 10-15 points)
        if (perf.firstBloodClaimed) expectedScore += 12;
        
        // Win bonus (typically 5-15 points)
        const playerWon = (perf.isRadiant && gameData.radiantWin) || (!perf.isRadiant && !gameData.radiantWin);
        if (playerWon) expectedScore += 10;
        
        const actualScore = perf.fantasyPoints || 0;
        const scoreRatio = actualScore / Math.max(expectedScore, 1);
        
        console.log(`   🧮 Expected Score: ~${expectedScore.toFixed(2)}`);
        console.log(`   📈 Actual/Expected Ratio: ${scoreRatio.toFixed(2)}x`);
        
        if (scoreRatio > 3) {
          console.log(`   🚨 EXTREME INFLATION: ${scoreRatio.toFixed(1)}x higher than expected!`);
        } else if (scoreRatio > 2) {
          console.log(`   ⚠️  HIGH INFLATION: ${scoreRatio.toFixed(1)}x higher than expected`);
        } else if (scoreRatio < 0.5) {
          console.log(`   📉 DEFLATED: Lower than expected scoring`);
        } else {
          console.log(`   ✅ NORMAL: Within expected range`);
        }
      });

      // Look for patterns that might explain the inflation
      console.log(`\n🔍 INFLATION PATTERN ANALYSIS:`);
      const inflationRatios = performances.map(perf => {
        // Simple expected calculation
        let expected = (perf.kills || 0) * 2.3 + (perf.deaths || 0) * -1.8 + (perf.assists || 0) * 1.2;
        expected += Math.min((perf.towerDamage || 0) / 1000, 15);
        expected += (perf.obsPlaced || 0) * 2.5 + (perf.senPlaced || 0) * 1.5;
        expected += (perf.courierKills || 0) * 8;
        if (perf.firstBloodClaimed) expected += 12;
        expected += 10; // Assume win bonus for simplicity
        
        return (perf.fantasyPoints || 0) / Math.max(expected, 1);
      });
      
      const avgInflation = inflationRatios.reduce((sum, ratio) => sum + ratio, 0) / inflationRatios.length;
      const minInflation = Math.min(...inflationRatios);
      const maxInflation = Math.max(...inflationRatios);
      
      console.log(`   Average Inflation: ${avgInflation.toFixed(2)}x`);
      console.log(`   Range: ${minInflation.toFixed(2)}x - ${maxInflation.toFixed(2)}x`);
      
      if (avgInflation > 3) {
        console.log(`   🚨 CONSISTENT SYSTEM BUG: All scores inflated by ~${avgInflation.toFixed(1)}x`);
      }
      
      // Check for specific suspicious values
      console.log(`\n🔬 LOOKING FOR SUSPICIOUS DATA PATTERNS:`);
      
      // Check if any values seem doubled/multiplied
      const suspiciousPatterns = [];
      performances.forEach(perf => {
        if (perf.heroDamage && perf.heroDamage > 100000) {
          suspiciousPatterns.push(`${perf.playerName}: Hero damage ${perf.heroDamage.toLocaleString()} (unusually high)`);
        }
        if (perf.netWorth && perf.netWorth > 50000) {
          suspiciousPatterns.push(`${perf.playerName}: Net worth ${perf.netWorth.toLocaleString()} (unusually high)`);
        }
        if (perf.gpm && perf.gpm > 1000) {
          suspiciousPatterns.push(`${perf.playerName}: GPM ${perf.gpm} (unusually high)`);
        }
        if (perf.xpm && perf.xpm > 1200) {
          suspiciousPatterns.push(`${perf.playerName}: XPM ${perf.xpm} (unusually high)`);
        }
      });
      
      if (suspiciousPatterns.length > 0) {
        console.log(`   Found suspicious patterns:`);
        suspiciousPatterns.forEach(pattern => console.log(`     - ${pattern}`));
      } else {
        console.log(`   ✅ Individual stats look normal - bug is in fantasy calculation only`);
      }
      
      console.log('\n' + '═'.repeat(80) + '\n');
    }

    // Final recommendations
    console.log('💡 RECOMMENDATIONS:');
    console.log('1. Check if this match used a different fantasy scoring algorithm');
    console.log('2. Look for data processing errors during match import');
    console.log('3. Verify if fantasy points were accidentally multiplied during calculation');
    console.log('4. Check if this match had different scoring rules/period');
    console.log('5. Consider recalculating fantasy scores for this specific match');

  } catch (error) {
    console.error('❌ Error analyzing scoring bug:', error);
  }
}

analyzeScoringBugDetailed();