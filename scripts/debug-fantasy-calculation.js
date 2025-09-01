#!/usr/bin/env node

// Debug the exact fantasy calculation for Gandalf1k's high-scoring games

function debugFantasyCalculation() {
  console.log('🧮 Debugging Fantasy Score Calculation for Gandalf1k\'s Outlier Games\n');

  // Gandalf1k's data from the outlier games
  const outlierGames = [
    {
      gameId: '8434604708',
      actualScore: 1126.98,
      duration: 2327, // seconds
      kills: 20,
      deaths: 1,
      assists: 19,
      lastHits: 272,
      denies: 22,
      gpm: 705,
      xpm: 932,
      netWorth: 26220,
      heroDamage: 43564,
      towerDamage: 10443,
      obsPlaced: 2,
      senPlaced: 2,
      courierKills: 1,
      firstBlood: false,
      teamWon: true, // Assuming Dire won based on game data
      role: 'Mid'
    },
    {
      gameId: '8434681576',
      actualScore: 367.38,
      duration: 2451, // seconds
      kills: 10,
      deaths: 5,
      assists: 9,
      lastHits: 252,
      denies: 6,
      gpm: 523,
      xpm: 829,
      netWorth: 17749,
      heroDamage: 28929,
      towerDamage: 3978,
      obsPlaced: 0,
      senPlaced: 0,
      courierKills: 0,
      firstBlood: false,
      teamWon: true,
      role: 'Mid'
    }
  ];

  outlierGames.forEach((game, index) => {
    console.log(`🎮 GAME ${index + 1}: ${game.gameId}`);
    console.log('═'.repeat(60));
    console.log(`📊 Actual Score: ${game.actualScore}`);
    console.log(`⏱️  Duration: ${game.duration} sec (${(game.duration / 60).toFixed(1)} min)`);
    console.log(`⚔️  KDA: ${game.kills}/${game.deaths}/${game.assists}`);
    console.log();

    // Step-by-step calculation using the exact algorithm from opendota.ts
    let points = 0;
    const gameDurationMinutes = game.duration / 60;
    
    console.log('🔢 STEP-BY-STEP CALCULATION:');
    console.log('─'.repeat(40));

    // === UNIVERSAL BASE SCORING ===
    if (game.teamWon) {
      points += 5;
      console.log(`✅ Team won: +5 pts (total: ${points.toFixed(2)})`);
    }
    
    if (game.firstBlood) {
      points += 12;
      console.log(`🩸 First blood: +12 pts (total: ${points.toFixed(2)})`);
    }
    
    const towerPoints = game.towerDamage / 1000;
    points += towerPoints;
    console.log(`🏗️  Tower damage: ${game.towerDamage} → +${towerPoints.toFixed(2)} pts (total: ${points.toFixed(2)})`);
    
    const courierPoints = game.courierKills * 10;
    points += courierPoints;
    console.log(`🐎 Courier kills: ${game.courierKills} → +${courierPoints} pts (total: ${points.toFixed(2)})`);
    
    // Death penalty
    const deathPenalty = game.deaths * -0.5;
    points += deathPenalty;
    console.log(`💀 Death penalty: ${game.deaths} → ${deathPenalty} pts (total: ${points.toFixed(2)})`);
    
    // Net worth per minute bonus
    const netWorthPerMin = game.netWorth / gameDurationMinutes;
    if (netWorthPerMin > 350) {
      const netWorthBonus = Math.sqrt(netWorthPerMin - 350) / 10;
      points += netWorthBonus;
      console.log(`💰 Net worth/min: ${netWorthPerMin.toFixed(0)} → +${netWorthBonus.toFixed(2)} pts (total: ${points.toFixed(2)})`);
    }
    
    // === MID ROLE SPECIFIC SCORING ===
    console.log('\n🎯 MID ROLE SCORING:');
    
    const killPoints = game.kills * 3.8; // Major buff for Mid
    points += killPoints;
    console.log(`⚔️  Kills: ${game.kills} × 3.8 = +${killPoints.toFixed(2)} pts (total: ${points.toFixed(2)})`);
    
    const assistPoints = game.assists * 2.0; // Major buff for Mid  
    points += assistPoints;
    console.log(`🤝 Assists: ${game.assists} × 2.0 = +${assistPoints.toFixed(2)} pts (total: ${points.toFixed(2)})`);
    
    // Enhanced damage scaling for Mid
    const heroDamagePoints = game.heroDamage / 100;
    points += heroDamagePoints;
    console.log(`⚔️  Hero damage: ${game.heroDamage} ÷ 100 = +${heroDamagePoints.toFixed(2)} pts (total: ${points.toFixed(2)})`);
    
    const xpmBonus = game.xpm > 600 ? (game.xpm - 600) * 0.08 : 0;
    points += xpmBonus;
    console.log(`📈 XPM bonus: ${game.xpm} > 600 → +${xpmBonus.toFixed(2)} pts (total: ${points.toFixed(2)})`);
    
    const lhBonus = game.lastHits > 150 ? (game.lastHits - 150) * 0.06 : 0;
    points += lhBonus;
    console.log(`🎯 LH bonus: ${game.lastHits} > 150 → +${lhBonus.toFixed(2)} pts (total: ${points.toFixed(2)})`);
    
    console.log(`\n📊 Score before bonuses: ${points.toFixed(2)}`);
    
    // === DURATION NORMALIZATION ===
    const durationMultiplier = Math.min(gameDurationMinutes / 40, 1.25);
    console.log(`⏱️  Duration multiplier: min(${gameDurationMinutes.toFixed(1)}/40, 1.25) = ${durationMultiplier.toFixed(3)}`);
    points = points / durationMultiplier;
    console.log(`📊 After duration normalization: ${points.toFixed(2)}`);
    
    // === EXCELLENCE BONUSES ===
    console.log('\n🌟 EXCELLENCE BONUSES:');
    
    const kda = game.deaths > 0 ? (game.kills + game.assists) / game.deaths : (game.kills + game.assists);
    console.log(`🎯 KDA ratio: (${game.kills} + ${game.assists}) ÷ ${game.deaths} = ${kda.toFixed(2)}`);
    
    if (kda >= 6) {
      const kdaBonus = (kda - 5) * 4;
      points += kdaBonus;
      console.log(`⭐ KDA >= 6: (${kda.toFixed(2)} - 5) × 4 = +${kdaBonus.toFixed(2)} pts (total: ${points.toFixed(2)})`);
    }
    
    if (game.kills >= 10) {
      const killsBonus = Math.pow(game.kills - 9, 1.3) * 3;
      points += killsBonus;
      console.log(`🔥 Kills >= 10: (${game.kills} - 9)^1.3 × 3 = +${killsBonus.toFixed(2)} pts (total: ${points.toFixed(2)})`);
    }
    
    if (game.assists >= 20) {
      const assistsBonus = Math.pow(game.assists - 19, 1.2) * 2;
      points += assistsBonus;
      console.log(`🤝 Assists >= 20: (${game.assists} - 19)^1.2 × 2 = +${assistsBonus.toFixed(2)} pts (total: ${points.toFixed(2)})`);
    }
    
    // Multi-stat excellence multiplier
    let excellenceMultiplier = 1;
    if (game.kills >= 8 && game.assists >= 12) {
      excellenceMultiplier += 0.15;
      console.log(`⚡ Kills >= 8 AND Assists >= 12: +15% multiplier`);
    }
    if (game.kills >= 5 && kda >= 4) {
      excellenceMultiplier += 0.1;
      console.log(`💎 Kills >= 5 AND KDA >= 4 (Mid role): +10% multiplier`);
    }
    
    console.log(`🎊 Total excellence multiplier: ${excellenceMultiplier.toFixed(3)}`);
    points *= excellenceMultiplier;
    console.log(`📊 After excellence multiplier: ${points.toFixed(2)}`);
    
    // Final rounding
    const finalScore = Math.round(points * 100) / 100;
    console.log(`\n🎯 FINAL CALCULATED SCORE: ${finalScore}`);
    console.log(`📊 ACTUAL DATABASE SCORE: ${game.actualScore}`);
    console.log(`📈 DIFFERENCE: ${(game.actualScore - finalScore).toFixed(2)} points`);
    console.log(`📊 RATIO: ${(game.actualScore / finalScore).toFixed(2)}x`);
    
    if (Math.abs(game.actualScore - finalScore) > 50) {
      console.log('🚨 MAJOR DISCREPANCY: Calculated score differs significantly from database!');
      console.log('   Possible causes:');
      console.log('   - Different algorithm version was used');
      console.log('   - Additional multipliers not accounted for');
      console.log('   - Data processing error during import');
      console.log('   - Score was manually modified or corrupted');
    } else {
      console.log('✅ SCORES MATCH: Algorithm working as expected');
    }
    
    console.log('\n' + '═'.repeat(80) + '\n');
  });
  
  console.log('💡 ANALYSIS CONCLUSION:');
  console.log('If calculated scores are much lower than actual scores:');
  console.log('→ There\'s likely a bug in the scoring calculation or data import');
  console.log('→ Check for accidental multiplication or different algorithm versions');
  console.log('→ Consider recalculating these specific games with the current algorithm');
}

debugFantasyCalculation();