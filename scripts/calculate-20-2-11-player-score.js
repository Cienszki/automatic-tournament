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

async function calculate20211PlayerScore() {
  console.log('🔍 Calculating fantasy score for player with 20/2/11 KDA in game 8433022489...\n');

  try {
    // Get the specific game data
    const matchId = '3nsXHgbRZNL2Bo3w6R18';
    const gameId = '8433022489';
    
    const gameDoc = await db.collection('matches').doc(matchId).collection('games').doc(gameId).get();
    const gameData = gameDoc.data();
    
    const performancesSnap = await db.collection('matches').doc(matchId)
      .collection('games').doc(gameId)
      .collection('performances').get();
    
    // Find the player with 20/2/11
    let targetPlayer = null;
    let targetPlayerId = null;
    
    for (const perfDoc of performancesSnap.docs) {
      const perf = perfDoc.data();
      if (perf.kills === 20 && perf.deaths === 2 && perf.assists === 11) {
        targetPlayer = perf;
        targetPlayerId = perfDoc.id;
        break;
      }
    }
    
    if (!targetPlayer) {
      console.log('❌ Player with 20/2/11 not found');
      return;
    }
    
    console.log('✅ FOUND PLAYER WITH 20/2/11 KDA');
    console.log('═'.repeat(80));
    
    // Get role from tournament players
    const tournamentPlayerDoc = await db.collection('tournamentPlayers').doc(targetPlayerId).get();
    const role = tournamentPlayerDoc.exists ? tournamentPlayerDoc.data().role || 'Unknown' : 'Unknown';
    const playerName = tournamentPlayerDoc.exists ? tournamentPlayerDoc.data().nickname || 'Unknown' : 'Unknown';
    
    console.log(`👤 Player: ${playerName} (${role})`);
    console.log(`📊 Database Fantasy Score: ${targetPlayer.fantasyPoints || 0}`);
    console.log(`⏱️  Game Duration: ${gameData.duration} seconds (${(gameData.duration / 60).toFixed(1)} minutes)`);
    console.log(`🏆 Game Winner: ${gameData.radiantWin ? 'Radiant' : 'Dire'}`);
    console.log();
    
    // Extract all performance data
    const perfData = {
      playerName: playerName,
      role: role,
      duration: gameData.duration || 0,
      kills: targetPlayer.kills || 0,
      deaths: targetPlayer.deaths || 0,
      assists: targetPlayer.assists || 0,
      lastHits: targetPlayer.lastHits || 0,
      denies: targetPlayer.denies || 0,
      gpm: targetPlayer.gpm || 0,
      xpm: targetPlayer.xpm || 0,
      netWorth: targetPlayer.netWorth || 0,
      heroDamage: targetPlayer.heroDamage || 0,
      heroHealing: targetPlayer.heroHealing || 0,
      towerDamage: targetPlayer.towerDamage || 0,
      obsPlaced: targetPlayer.obsPlaced || 0,
      senPlaced: targetPlayer.senPlaced || 0,
      courierKills: targetPlayer.courierKills || 0,
      observerKills: targetPlayer.observerKills || 0,
      sentryKills: targetPlayer.sentryKills || 0,
      firstBlood: targetPlayer.firstBloodClaimed || false,
      teamWon: (targetPlayer.isRadiant && gameData.radiantWin) || (!targetPlayer.isRadiant && !gameData.radiantWin),
      actualScore: targetPlayer.fantasyPoints || 0
    };
    
    console.log('📋 RAW PERFORMANCE DATA:');
    console.log(`   KDA: ${perfData.kills}/${perfData.deaths}/${perfData.assists}`);
    console.log(`   Economy: ${perfData.gpm} GPM, ${perfData.xpm} XPM, ${perfData.netWorth} NW`);
    console.log(`   🚨 HERO DAMAGE: ${perfData.heroDamage.toLocaleString()}`);
    console.log(`   Tower Damage: ${perfData.towerDamage.toLocaleString()}`);
    console.log(`   Farm: ${perfData.lastHits} LH, ${perfData.denies} denies`);
    console.log(`   Wards: ${perfData.obsPlaced} obs, ${perfData.senPlaced} sen`);
    console.log(`   Other: ${perfData.courierKills} courier kills, FB: ${perfData.firstBlood}`);
    console.log(`   Team Won: ${perfData.teamWon}`);
    console.log();
    
    // Now calculate exact fantasy score step by step
    console.log('🧮 STEP-BY-STEP FANTASY CALCULATION:');
    console.log('═'.repeat(80));
    
    let points = 0;
    const gameDurationMinutes = perfData.duration / 60;
    
    // === UNIVERSAL BASE SCORING ===
    console.log('STEP 1: UNIVERSAL BASE SCORING');
    console.log('─'.repeat(40));
    
    if (perfData.teamWon) {
      points += 5;
      console.log(`✅ Team won: +5 → points = ${points.toFixed(2)}`);
    } else {
      console.log(`❌ Team lost: +0 → points = ${points.toFixed(2)}`);
    }
    
    if (perfData.firstBlood) {
      points += 12;
      console.log(`🩸 First blood: +12 → points = ${points.toFixed(2)}`);
    }
    
    const towerPoints = perfData.towerDamage / 1000;
    points += towerPoints;
    console.log(`🏗️  Tower damage: ${perfData.towerDamage.toLocaleString()} ÷ 1000 = +${towerPoints.toFixed(2)} → points = ${points.toFixed(2)}`);
    
    const observerKillsPoints = perfData.observerKills * 2.5;
    points += observerKillsPoints;
    console.log(`👁️  Observer kills: ${perfData.observerKills} × 2.5 = +${observerKillsPoints} → points = ${points.toFixed(2)}`);
    
    const courierKillsPoints = perfData.courierKills * 10;
    points += courierKillsPoints;
    console.log(`🐎 Courier kills: ${perfData.courierKills} × 10 = +${courierKillsPoints} → points = ${points.toFixed(2)}`);
    
    const sentryKillsPoints = perfData.sentryKills * 2;
    points += sentryKillsPoints;
    console.log(`🔍 Sentry kills: ${perfData.sentryKills} × 2 = +${sentryKillsPoints} → points = ${points.toFixed(2)}`);
    
    const deathPenalty = perfData.deaths * -0.5;
    points += deathPenalty;
    console.log(`💀 Death penalty: ${perfData.deaths} × -0.5 = ${deathPenalty} → points = ${points.toFixed(2)}`);
    
    const netWorthPerMin = perfData.netWorth / gameDurationMinutes;
    if (netWorthPerMin > 350) {
      const netWorthBonus = Math.sqrt(netWorthPerMin - 350) / 10;
      points += netWorthBonus;
      console.log(`💰 NetWorth/min: ${netWorthPerMin.toFixed(0)} > 350 → +${netWorthBonus.toFixed(2)} → points = ${points.toFixed(2)}`);
    } else {
      console.log(`💰 NetWorth/min: ${netWorthPerMin.toFixed(0)} ≤ 350 → +0 → points = ${points.toFixed(2)}`);
    }
    
    // === ROLE-SPECIFIC SCORING ===
    console.log(`\nSTEP 2: ${perfData.role.toUpperCase()} ROLE SCORING`);
    console.log('─'.repeat(40));
    
    if (perfData.role === 'Mid') {
      const killPoints = perfData.kills * 3.8;
      points += killPoints;
      console.log(`⚔️  Mid kills: ${perfData.kills} × 3.8 = +${killPoints.toFixed(2)} → points = ${points.toFixed(2)}`);
      
      const assistPoints = perfData.assists * 2.0;
      points += assistPoints;
      console.log(`🤝 Mid assists: ${perfData.assists} × 2.0 = +${assistPoints.toFixed(2)} → points = ${points.toFixed(2)}`);
      
      const heroDamagePoints = perfData.heroDamage / 100;
      points += heroDamagePoints;
      console.log(`⚔️  🚨 MID HERO DAMAGE: ${perfData.heroDamage.toLocaleString()} ÷ 100 = +${heroDamagePoints.toFixed(2)} → points = ${points.toFixed(2)}`);
      
      const xpmBonus = perfData.xpm > 600 ? (perfData.xpm - 600) * 0.08 : 0;
      points += xpmBonus;
      console.log(`📈 XPM bonus: ${perfData.xpm} > 600 ? +${xpmBonus.toFixed(2)} → points = ${points.toFixed(2)}`);
      
      const lhBonus = perfData.lastHits > 150 ? (perfData.lastHits - 150) * 0.06 : 0;
      points += lhBonus;
      console.log(`🎯 LH bonus: ${perfData.lastHits} > 150 ? +${lhBonus.toFixed(2)} → points = ${points.toFixed(2)}`);
      
    } else if (perfData.role === 'Carry') {
      const killPoints = perfData.kills * 2.8;
      points += killPoints;
      console.log(`⚔️  Carry kills: ${perfData.kills} × 2.8 = +${killPoints.toFixed(2)} → points = ${points.toFixed(2)}`);
      
      const assistPoints = perfData.assists * 1.4;
      points += assistPoints;
      console.log(`🤝 Carry assists: ${perfData.assists} × 1.4 = +${assistPoints.toFixed(2)} → points = ${points.toFixed(2)}`);
      
      const heroDamagePoints = perfData.heroDamage / 120;
      points += heroDamagePoints;
      console.log(`⚔️  🚨 CARRY HERO DAMAGE: ${perfData.heroDamage.toLocaleString()} ÷ 120 = +${heroDamagePoints.toFixed(2)} → points = ${points.toFixed(2)}`);
      
    } else {
      console.log(`❓ Role '${perfData.role}' - using default scoring`);
      const killPoints = perfData.kills * 2.0;
      const assistPoints = perfData.assists * 1.5;
      points += killPoints + assistPoints;
      console.log(`⚔️  Default kills: ${perfData.kills} × 2.0 = +${killPoints.toFixed(2)}`);
      console.log(`🤝 Default assists: ${perfData.assists} × 1.5 = +${assistPoints.toFixed(2)} → points = ${points.toFixed(2)}`);
    }
    
    console.log(`\n📊 Score before duration normalization: ${points.toFixed(2)}`);
    
    // === DURATION NORMALIZATION ===
    console.log('\nSTEP 3: DURATION NORMALIZATION');
    console.log('─'.repeat(40));
    
    const durationMultiplier = Math.min(gameDurationMinutes / 40, 1.25);
    console.log(`Duration: ${gameDurationMinutes.toFixed(1)} min, multiplier: min(${gameDurationMinutes.toFixed(1)}/40, 1.25) = ${durationMultiplier.toFixed(3)}`);
    points = points / durationMultiplier;
    console.log(`After normalization: ${points.toFixed(2)}`);
    
    // === EXCELLENCE BONUSES ===
    console.log('\nSTEP 4: EXCELLENCE BONUSES');
    console.log('─'.repeat(40));
    
    const kda = perfData.deaths > 0 ? (perfData.kills + perfData.assists) / perfData.deaths : (perfData.kills + perfData.assists);
    console.log(`KDA ratio: (${perfData.kills} + ${perfData.assists}) ÷ ${perfData.deaths} = ${kda.toFixed(2)}`);
    
    if (kda >= 6) {
      const kdaBonus = (kda - 5) * 4;
      points += kdaBonus;
      console.log(`⭐ KDA ≥ 6: (${kda.toFixed(2)} - 5) × 4 = +${kdaBonus.toFixed(2)} → points = ${points.toFixed(2)}`);
    }
    
    if (perfData.kills >= 10) {
      const killsBonus = Math.pow(perfData.kills - 9, 1.3) * 3;
      points += killsBonus;
      console.log(`🔥 Kills ≥ 10: (${perfData.kills} - 9)^1.3 × 3 = +${killsBonus.toFixed(2)} → points = ${points.toFixed(2)}`);
    }
    
    // === EXCELLENCE MULTIPLIERS ===
    console.log('\nSTEP 5: EXCELLENCE MULTIPLIERS');
    console.log('─'.repeat(40));
    
    let excellenceMultiplier = 1;
    
    if (perfData.kills >= 8 && perfData.assists >= 12) {
      excellenceMultiplier += 0.15;
      console.log(`⚡ Kills ≥ 8 AND Assists ≥ 12: +15% → multiplier = ${excellenceMultiplier.toFixed(3)}`);
    }
    
    if (perfData.kills >= 5 && kda >= 4 && (perfData.role === 'Carry' || perfData.role === 'Mid')) {
      excellenceMultiplier += 0.1;
      console.log(`💎 Excellence bonus (Carry/Mid): +10% → multiplier = ${excellenceMultiplier.toFixed(3)}`);
    }
    
    console.log(`Final multiplier: ${excellenceMultiplier.toFixed(3)}`);
    points *= excellenceMultiplier;
    console.log(`After excellence: ${points.toFixed(2)}`);
    
    // === FINAL ROUNDING ===
    const finalScore = Math.round(points * 100) / 100;
    console.log(`\n🎯 FINAL CALCULATED SCORE: ${finalScore}`);
    
    // === COMPARISON ===
    console.log('\n🔍 COMPARISON WITH DATABASE:');
    console.log('═'.repeat(60));
    console.log(`Calculated Score: ${finalScore}`);
    console.log(`Database Score: ${perfData.actualScore}`);
    console.log(`Difference: ${(perfData.actualScore - finalScore).toFixed(2)} points`);
    console.log(`Ratio: ${(perfData.actualScore / finalScore).toFixed(3)}x`);
    
    // === HERO DAMAGE ANALYSIS ===
    console.log('\n🚨 HERO DAMAGE IMPACT ANALYSIS:');
    console.log('═'.repeat(60));
    const heroDamageContribution = perfData.role === 'Mid' ? perfData.heroDamage / 100 : 
                                   perfData.role === 'Carry' ? perfData.heroDamage / 120 : 0;
    console.log(`Hero Damage: ${perfData.heroDamage.toLocaleString()}`);
    console.log(`Hero Damage Points: ${heroDamageContribution.toFixed(2)}`);
    console.log(`% of Total Score: ${(heroDamageContribution / finalScore * 100).toFixed(1)}%`);
    
    if (heroDamageContribution > finalScore * 0.4) {
      console.log('🚨 WARNING: Hero damage accounts for >40% of fantasy score!');
      console.log('   This suggests hero damage scaling might be too high');
    } else if (heroDamageContribution > finalScore * 0.25) {
      console.log('⚠️  CAUTION: Hero damage accounts for >25% of fantasy score');
    } else {
      console.log('✅ Hero damage contribution seems reasonable');
    }
    
    if (Math.abs(perfData.actualScore - finalScore) > 1) {
      console.log('\n🚨 SIGNIFICANT DISCREPANCY DETECTED!');
      console.log('   This suggests the algorithm used to calculate the database score differs from the current code');
    }
    
  } catch (error) {
    console.error('❌ Error calculating score:', error);
  }
}

calculate20211PlayerScore();