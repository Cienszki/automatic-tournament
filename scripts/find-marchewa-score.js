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

// Exact fantasy calculation function
function calculateExactFantasyScore(gameData) {
  let points = 0;
  const gameDurationMinutes = gameData.duration / 60;
  
  console.log(`🧮 CALCULATING FOR: ${gameData.playerName}`);
  console.log(`📊 Raw data: ${gameData.kills}/${gameData.deaths}/${gameData.assists}, ${gameData.heroDamage} hero damage`);
  console.log('─'.repeat(60));
  
  // === STEP 1: UNIVERSAL BASE SCORING ===
  if (gameData.teamWon) {
    points += 5;
    console.log(`✅ Team won: +5 → points = ${points.toFixed(2)}`);
  }
  
  if (gameData.firstBlood) {
    points += 12;
    console.log(`🩸 First blood: +12 → points = ${points.toFixed(2)}`);
  }
  
  const towerPoints = gameData.towerDamage / 1000;
  points += towerPoints;
  console.log(`🏗️  Tower damage: ${gameData.towerDamage} ÷ 1000 = +${towerPoints.toFixed(2)} → points = ${points.toFixed(2)}`);
  
  const courierPoints = gameData.courierKills * 10;
  points += courierPoints;
  console.log(`🐎 Courier kills: ${gameData.courierKills} × 10 = +${courierPoints} → points = ${points.toFixed(2)}`);
  
  const deathPenalty = gameData.deaths * -0.5;
  points += deathPenalty;
  console.log(`💀 Death penalty: ${gameData.deaths} × -0.5 = ${deathPenalty} → points = ${points.toFixed(2)}`);
  
  const netWorthPerMin = gameData.netWorth / gameDurationMinutes;
  if (netWorthPerMin > 350) {
    const netWorthBonus = Math.sqrt(netWorthPerMin - 350) / 10;
    points += netWorthBonus;
    console.log(`💰 Net worth/min: ${netWorthPerMin.toFixed(0)} > 350 → +${netWorthBonus.toFixed(2)} → points = ${points.toFixed(2)}`);
  }
  
  // === STEP 2: ROLE-SPECIFIC SCORING ===
  console.log(`\n🎯 ${gameData.role.toUpperCase()} ROLE SCORING:`);
  
  if (gameData.role === 'Mid') {
    const killPoints = gameData.kills * 3.8;
    points += killPoints;
    console.log(`⚔️  Kills: ${gameData.kills} × 3.8 = +${killPoints.toFixed(2)} → points = ${points.toFixed(2)}`);
    
    const assistPoints = gameData.assists * 2.0;
    points += assistPoints;
    console.log(`🤝 Assists: ${gameData.assists} × 2.0 = +${assistPoints.toFixed(2)} → points = ${points.toFixed(2)}`);
    
    const heroDamagePoints = gameData.heroDamage / 100;
    points += heroDamagePoints;
    console.log(`⚔️  🚨 HERO DAMAGE: ${gameData.heroDamage} ÷ 100 = +${heroDamagePoints.toFixed(2)} → points = ${points.toFixed(2)}`);
    
    const xpmBonus = gameData.xpm > 600 ? (gameData.xpm - 600) * 0.08 : 0;
    points += xpmBonus;
    console.log(`📈 XPM bonus: ${gameData.xpm} > 600 → +${xpmBonus.toFixed(2)} → points = ${points.toFixed(2)}`);
    
    const lhBonus = gameData.lastHits > 150 ? (gameData.lastHits - 150) * 0.06 : 0;
    points += lhBonus;
    console.log(`🎯 LH bonus: ${gameData.lastHits} > 150 → +${lhBonus.toFixed(2)} → points = ${points.toFixed(2)}`);
  }
  
  // === STEP 3: DURATION NORMALIZATION ===
  console.log(`\n⏱️  DURATION NORMALIZATION:`);
  const durationMultiplier = Math.min(gameDurationMinutes / 40, 1.25);
  console.log(`Duration: ${gameDurationMinutes.toFixed(1)} min, multiplier: ${durationMultiplier.toFixed(3)}`);
  points = points / durationMultiplier;
  console.log(`After normalization: ${points.toFixed(2)}`);
  
  // === STEP 4: EXCELLENCE BONUSES ===
  console.log(`\n🌟 EXCELLENCE BONUSES:`);
  const kda = gameData.deaths > 0 ? (gameData.kills + gameData.assists) / gameData.deaths : (gameData.kills + gameData.assists);
  console.log(`KDA ratio: ${kda.toFixed(2)}`);
  
  if (kda >= 6) {
    const kdaBonus = (kda - 5) * 4;
    points += kdaBonus;
    console.log(`⭐ KDA ≥ 6: +${kdaBonus.toFixed(2)} → points = ${points.toFixed(2)}`);
  }
  
  if (gameData.kills >= 10) {
    const killsBonus = Math.pow(gameData.kills - 9, 1.3) * 3;
    points += killsBonus;
    console.log(`🔥 Kills ≥ 10: +${killsBonus.toFixed(2)} → points = ${points.toFixed(2)}`);
  }
  
  // === STEP 5: EXCELLENCE MULTIPLIERS ===
  console.log(`\n🎊 EXCELLENCE MULTIPLIERS:`);
  let excellenceMultiplier = 1;
  
  if (gameData.kills >= 8 && gameData.assists >= 12) {
    excellenceMultiplier += 0.15;
    console.log(`⚡ Kills ≥ 8 AND Assists ≥ 12: +15%`);
  }
  
  if (gameData.kills >= 5 && kda >= 4 && gameData.role === 'Mid') {
    excellenceMultiplier += 0.1;
    console.log(`💎 Mid excellence: +10%`);
  }
  
  console.log(`Total multiplier: ${excellenceMultiplier.toFixed(3)}`);
  points *= excellenceMultiplier;
  console.log(`After multipliers: ${points.toFixed(2)}`);
  
  // === FINAL ROUNDING ===
  const finalScore = Math.round(points * 100) / 100;
  console.log(`\n🎯 FINAL SCORE: ${finalScore}`);
  
  return finalScore;
}

async function findMarchewaScore() {
  console.log('🔍 Finding marchewa\'s score from match 8433022489 (20/2/11)...\n');

  try {
    // Search for the specific game in all matches
    const matchesSnap = await db.collection('matches').get();
    
    let foundMarchewa = false;
    
    for (const matchDoc of matchesSnap.docs) {
      const matchId = matchDoc.id;
      
      try {
        const gamesSnap = await db.collection('matches').doc(matchId).collection('games').get();
        
        for (const gameDoc of gamesSnap.docs) {
          const gameId = gameDoc.id;
          
          // Check if this is the game we're looking for
          if (gameId === '8433022489') {
            console.log(`✅ Found game ${gameId} in match ${matchId}`);
            
            const gameData = gameDoc.data();
            console.log(`📊 Game duration: ${gameData.duration} seconds`);
            console.log(`🏆 Winner: ${gameData.radiantWin ? 'Radiant' : 'Dire'}`);
            console.log();
            
            // Get all performances and look for marchewa
            const performancesSnap = await db.collection('matches').doc(matchId)
              .collection('games').doc(gameId)
              .collection('performances').get();
            
            console.log(`👥 Found ${performancesSnap.size} player performances`);
            
            for (const perfDoc of performancesSnap.docs) {
              const perf = perfDoc.data();
              const playerName = (perf.playerName || perf.nickname || 'Unknown').toLowerCase();
              
              // Look for marchewa with the specific KDA
              if (playerName.includes('marchewa') && perf.kills === 20 && perf.deaths === 2 && perf.assists === 11) {
                foundMarchewa = true;
                
                console.log(`🎯 FOUND MARCHEWA!`);
                console.log('═'.repeat(80));
                
                // Get tournament player data for role
                const tournamentPlayerDoc = await db.collection('tournamentPlayers').doc(perfDoc.id).get();
                const role = tournamentPlayerDoc.exists ? tournamentPlayerDoc.data().role : 'Unknown';
                
                const marchewaData = {
                  playerName: perf.playerName || perf.nickname,
                  duration: gameData.duration || 0,
                  role: role,
                  kills: perf.kills || 0,
                  deaths: perf.deaths || 0,
                  assists: perf.assists || 0,
                  lastHits: perf.lastHits || 0,
                  gpm: perf.gpm || 0,
                  xpm: perf.xpm || 0,
                  netWorth: perf.netWorth || 0,
                  heroDamage: perf.heroDamage || 0,
                  towerDamage: perf.towerDamage || 0,
                  courierKills: perf.courierKills || 0,
                  firstBlood: perf.firstBloodClaimed || false,
                  teamWon: (perf.isRadiant && gameData.radiantWin) || (!perf.isRadiant && !gameData.radiantWin),
                  actualDatabaseScore: perf.fantasyPoints || 0
                };
                
                console.log(`📋 Player: ${marchewaData.playerName} (${marchewaData.role})`);
                console.log(`📊 Database Score: ${marchewaData.actualDatabaseScore}`);
                console.log('');
                
                // Calculate what the score should be
                const calculatedScore = calculateExactFantasyScore(marchewaData);
                
                console.log('\n🔍 COMPARISON:');
                console.log('═'.repeat(50));
                console.log(`Calculated Score: ${calculatedScore}`);
                console.log(`Database Score: ${marchewaData.actualDatabaseScore}`);
                console.log(`Difference: ${(marchewaData.actualDatabaseScore - calculatedScore).toFixed(2)}`);
                console.log(`Ratio: ${(marchewaData.actualDatabaseScore / calculatedScore).toFixed(3)}x`);
                
                if (Math.abs(marchewaData.actualDatabaseScore - calculatedScore) > 10) {
                  console.log('\n🚨 MAJOR DISCREPANCY DETECTED!');
                  console.log(`Hero damage contribution: ${marchewaData.heroDamage} ÷ 100 = ${(marchewaData.heroDamage / 100).toFixed(2)} points`);
                  console.log(`Hero damage as % of total: ${((marchewaData.heroDamage / 100) / calculatedScore * 100).toFixed(1)}%`);
                  
                  if (marchewaData.heroDamage > 30000) {
                    console.log('⚠️  Hero damage > 30,000 - this could be inflating scores significantly!');
                  }
                } else {
                  console.log('✅ Scores match within reasonable margin');
                }
                
                break;
              }
            }
            
            if (!foundMarchewa) {
              console.log('❌ No marchewa found with KDA 20/2/11 in this game');
              
              // Show all players in this game for debugging
              console.log('\n📋 All players in this game:');
              for (const perfDoc of performancesSnap.docs) {
                const perf = perfDoc.data();
                console.log(`  ${perf.playerName || perf.nickname || 'Unknown'}: ${perf.kills}/${perf.deaths}/${perf.assists}`);
              }
            }
            
            break;
          }
        }
      } catch (e) {
        // Skip matches without games
      }
      
      if (foundMarchewa) break;
    }
    
    if (!foundMarchewa) {
      console.log('❌ Game 8433022489 not found in database');
    }
    
  } catch (error) {
    console.error('❌ Error finding marchewa:', error);
  }
}

findMarchewaScore();