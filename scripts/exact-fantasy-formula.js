// EXACT Fantasy Scoring Formula from opendota.ts

function calculateExactFantasyPoints(gameData) {
  console.log('🧮 EXACT FANTASY SCORING FORMULA');
  console.log('═'.repeat(80));
  console.log(`Input data for ${gameData.player}:`);
  console.log(`  Duration: ${gameData.duration} seconds (${(gameData.duration / 60).toFixed(6)} minutes)`);
  console.log(`  Role: ${gameData.role}`);
  console.log(`  KDA: ${gameData.kills}/${gameData.deaths}/${gameData.assists}`);
  console.log(`  Stats: ${gameData.gpm} GPM, ${gameData.xpm} XPM, ${gameData.netWorth} NW`);
  console.log(`  Combat: ${gameData.heroDamage} hero dmg, ${gameData.towerDamage} tower dmg`);
  console.log(`  Wards: ${gameData.obsPlaced} obs, ${gameData.senPlaced} sen`);
  console.log(`  Other: ${gameData.courierKills} courier, FB: ${gameData.firstBlood}, Won: ${gameData.teamWon}`);
  console.log('');

  let points = 0;
  const gameDurationMinutes = gameData.duration / 60;
  
  // === STEP 1: UNIVERSAL BASE SCORING ===
  console.log('STEP 1: UNIVERSAL BASE SCORING');
  console.log('─'.repeat(40));
  
  if (gameData.teamWon) {
    points += 5;
    console.log(`Team won: +5.000000 → points = ${points.toFixed(6)}`);
  }
  
  if (gameData.firstBlood) {
    points += 12;
    console.log(`First blood: +12.000000 → points = ${points.toFixed(6)}`);
  }
  
  const towerPoints = gameData.towerDamage / 1000;
  points += towerPoints;
  console.log(`Tower damage: ${gameData.towerDamage} ÷ 1000 = +${towerPoints.toFixed(6)} → points = ${points.toFixed(6)}`);
  
  const observerKillsPoints = (gameData.observerKills || 0) * 2.5;
  points += observerKillsPoints;
  console.log(`Observer kills: ${gameData.observerKills || 0} × 2.5 = +${observerKillsPoints.toFixed(6)} → points = ${points.toFixed(6)}`);
  
  const courierKillsPoints = gameData.courierKills * 10;
  points += courierKillsPoints;
  console.log(`Courier kills: ${gameData.courierKills} × 10 = +${courierKillsPoints.toFixed(6)} → points = ${points.toFixed(6)}`);
  
  const sentryKillsPoints = (gameData.sentryKills || 0) * 2;
  points += sentryKillsPoints;
  console.log(`Sentry kills: ${gameData.sentryKills || 0} × 2 = +${sentryKillsPoints.toFixed(6)} → points = ${points.toFixed(6)}`);
  
  // Kill streak bonus
  const highestStreak = gameData.killStreaks || 0;
  if (highestStreak >= 3) {
    const killStreakPoints = Math.pow(highestStreak - 2, 1.2) * 2.5;
    points += killStreakPoints;
    console.log(`Kill streak: (${highestStreak} - 2)^1.2 × 2.5 = +${killStreakPoints.toFixed(6)} → points = ${points.toFixed(6)}`);
  } else {
    console.log(`Kill streak: ${highestStreak} < 3, no bonus → points = ${points.toFixed(6)}`);
  }
  
  const deathPenalty = gameData.deaths * -0.5;
  points += deathPenalty;
  console.log(`Death penalty: ${gameData.deaths} × -0.5 = ${deathPenalty.toFixed(6)} → points = ${points.toFixed(6)}`);
  
  const netWorthPerMin = gameData.netWorth / gameDurationMinutes;
  if (netWorthPerMin > 350) {
    const netWorthBonus = Math.sqrt(netWorthPerMin - 350) / 10;
    points += netWorthBonus;
    console.log(`NetWorth/min: ${netWorthPerMin.toFixed(6)} > 350, sqrt(${(netWorthPerMin - 350).toFixed(6)}) ÷ 10 = +${netWorthBonus.toFixed(6)} → points = ${points.toFixed(6)}`);
  } else {
    console.log(`NetWorth/min: ${netWorthPerMin.toFixed(6)} ≤ 350, no bonus → points = ${points.toFixed(6)}`);
  }
  
  // === STEP 2: ROLE-SPECIFIC SCORING ===
  console.log('\nSTEP 2: ROLE-SPECIFIC SCORING (' + gameData.role + ')');
  console.log('─'.repeat(40));
  
  if (gameData.role === 'Mid') {
    const killPoints = gameData.kills * 3.8;
    points += killPoints;
    console.log(`Mid kills: ${gameData.kills} × 3.8 = +${killPoints.toFixed(6)} → points = ${points.toFixed(6)}`);
    
    const assistPoints = gameData.assists * 2.0;
    points += assistPoints;
    console.log(`Mid assists: ${gameData.assists} × 2.0 = +${assistPoints.toFixed(6)} → points = ${points.toFixed(6)}`);
    
    const heroDamagePoints = gameData.heroDamage / 100;
    points += heroDamagePoints;
    console.log(`Mid hero damage: ${gameData.heroDamage} ÷ 100 = +${heroDamagePoints.toFixed(6)} → points = ${points.toFixed(6)}`);
    
    const xpmBonus = gameData.xpm > 600 ? (gameData.xpm - 600) * 0.08 : 0;
    points += xpmBonus;
    console.log(`XPM bonus: ${gameData.xpm} > 600 ? (${gameData.xpm} - 600) × 0.08 = +${xpmBonus.toFixed(6)} → points = ${points.toFixed(6)}`);
    
    const lhBonus = gameData.lastHits > 150 ? (gameData.lastHits - 150) * 0.06 : 0;
    points += lhBonus;
    console.log(`LH bonus: ${gameData.lastHits} > 150 ? (${gameData.lastHits} - 150) × 0.06 = +${lhBonus.toFixed(6)} → points = ${points.toFixed(6)}`);
  }
  
  // === STEP 3: DURATION NORMALIZATION ===
  console.log('\nSTEP 3: DURATION NORMALIZATION');
  console.log('─'.repeat(40));
  
  const durationMultiplier = Math.min(gameDurationMinutes / 40, 1.25);
  console.log(`Duration multiplier: min(${gameDurationMinutes.toFixed(6)} ÷ 40, 1.25) = ${durationMultiplier.toFixed(6)}`);
  points = points / durationMultiplier;
  console.log(`After normalization: ${points.toFixed(6)} ÷ ${durationMultiplier.toFixed(6)} = ${points.toFixed(6)}`);
  
  // === STEP 4: EXCELLENCE BONUSES ===
  console.log('\nSTEP 4: EXCELLENCE BONUSES');
  console.log('─'.repeat(40));
  
  const kda = gameData.deaths > 0 ? (gameData.kills + gameData.assists) / gameData.deaths : (gameData.kills + gameData.assists);
  console.log(`KDA: ${gameData.deaths} > 0 ? (${gameData.kills} + ${gameData.assists}) ÷ ${gameData.deaths} = ${kda.toFixed(6)}`);
  
  if (kda >= 6) {
    const kdaBonus = (kda - 5) * 4;
    points += kdaBonus;
    console.log(`KDA ≥ 6: (${kda.toFixed(6)} - 5) × 4 = +${kdaBonus.toFixed(6)} → points = ${points.toFixed(6)}`);
  } else {
    console.log(`KDA < 6: no bonus → points = ${points.toFixed(6)}`);
  }
  
  if (gameData.kills >= 10) {
    const killsBonus = Math.pow(gameData.kills - 9, 1.3) * 3;
    points += killsBonus;
    console.log(`Kills ≥ 10: (${gameData.kills} - 9)^1.3 × 3 = +${killsBonus.toFixed(6)} → points = ${points.toFixed(6)}`);
  } else {
    console.log(`Kills < 10: no bonus → points = ${points.toFixed(6)}`);
  }
  
  if (gameData.assists >= 20) {
    const assistsBonus = Math.pow(gameData.assists - 19, 1.2) * 2;
    points += assistsBonus;
    console.log(`Assists ≥ 20: (${gameData.assists} - 19)^1.2 × 2 = +${assistsBonus.toFixed(6)} → points = ${points.toFixed(6)}`);
  } else {
    console.log(`Assists < 20: no bonus → points = ${points.toFixed(6)}`);
  }
  
  // === STEP 5: EXCELLENCE MULTIPLIERS ===
  console.log('\nSTEP 5: EXCELLENCE MULTIPLIERS');
  console.log('─'.repeat(40));
  
  let excellenceMultiplier = 1;
  
  if (gameData.kills >= 8 && gameData.assists >= 12) {
    excellenceMultiplier += 0.15;
    console.log(`Kills ≥ 8 AND Assists ≥ 12: +0.15 → multiplier = ${excellenceMultiplier.toFixed(6)}`);
  }
  
  if (gameData.kills >= 5 && kda >= 4 && (gameData.role === 'Carry' || gameData.role === 'Mid')) {
    excellenceMultiplier += 0.1;
    console.log(`Kills ≥ 5 AND KDA ≥ 4 AND (Carry/Mid): +0.10 → multiplier = ${excellenceMultiplier.toFixed(6)}`);
  }
  
  if (gameData.assists >= 25 && gameData.obsPlaced >= 8 && (gameData.role === 'Soft Support' || gameData.role === 'Hard Support')) {
    excellenceMultiplier += 0.2;
    console.log(`Assists ≥ 25 AND Obs ≥ 8 AND (Support): +0.20 → multiplier = ${excellenceMultiplier.toFixed(6)}`);
  }
  
  console.log(`Final excellence multiplier: ${excellenceMultiplier.toFixed(6)}`);
  points *= excellenceMultiplier;
  console.log(`After excellence: ${points.toFixed(6)} × ${excellenceMultiplier.toFixed(6)} = ${points.toFixed(6)}`);
  
  // === STEP 6: FINAL ROUNDING ===
  console.log('\nSTEP 6: FINAL ROUNDING');
  console.log('─'.repeat(40));
  
  const finalScore = Math.round(points * 100) / 100;
  console.log(`Final: Math.round(${points.toFixed(6)} × 100) ÷ 100 = ${finalScore.toFixed(6)}`);
  
  return finalScore;
}

// Test with Gandalf1k's exact data
const game1Data = {
  player: 'Gandalf1k Game 1',
  duration: 2327,
  role: 'Mid',
  kills: 20,
  deaths: 1,
  assists: 19,
  lastHits: 272,
  gpm: 705,
  xpm: 932,
  netWorth: 26220,
  heroDamage: 43564,
  towerDamage: 10443,
  obsPlaced: 2,
  senPlaced: 2,
  courierKills: 1,
  observerKills: 0,
  sentryKills: 0,
  killStreaks: 0, // We don't have this data
  firstBlood: false,
  teamWon: true
};

const calculatedScore = calculateExactFantasyPoints(game1Data);

console.log('\n🎯 FINAL COMPARISON:');
console.log('═'.repeat(50));
console.log(`Calculated Score: ${calculatedScore}`);
console.log(`Database Score: 1126.98`);
console.log(`Difference: ${(1126.98 - calculatedScore).toFixed(6)}`);
console.log(`Ratio: ${(1126.98 / calculatedScore).toFixed(6)}x`);

if (Math.abs(1126.98 - calculatedScore) < 0.01) {
  console.log('✅ PERFECT MATCH: Scores match within rounding error');
} else {
  console.log('🚨 DISCREPANCY: Mathematical calculation differs from database');
  console.log('   Possible causes:');
  console.log('   - Missing kill streak data');
  console.log('   - Different algorithm version was used');
  console.log('   - Floating point precision errors');
  console.log('   - Additional data fields not accounted for');
}