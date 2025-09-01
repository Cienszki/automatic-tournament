// Calculate what the missing games must have scored

function calculateMissingGames() {
  console.log('🧮 Calculating the missing games for Gandalf1k...\n');

  // Data from CSV exports
  const csvGames = 4;
  const csvTotalPoints = 298.06; // From fantasy-player-summary.csv
  const csvAverage = csvTotalPoints / csvGames;

  // Data from current leaderboard 
  const leaderboardGames = 6;
  const leaderboardAverage = 301.15;
  const leaderboardTotalPoints = leaderboardAverage * leaderboardGames;

  // Calculate missing games
  const missingGames = leaderboardGames - csvGames;
  const missingTotalPoints = leaderboardTotalPoints - csvTotalPoints;
  const missingAverage = missingTotalPoints / missingGames;

  console.log('📊 ANALYSIS OF MISSING GAMES:');
  console.log('═'.repeat(50));
  console.log(`CSV Export Data:`);
  console.log(`  Games: ${csvGames}`);
  console.log(`  Total Points: ${csvTotalPoints.toFixed(2)}`);
  console.log(`  Average: ${csvAverage.toFixed(2)}`);
  console.log('');
  console.log(`Current Leaderboard:`);
  console.log(`  Games: ${leaderboardGames}`);
  console.log(`  Average: ${leaderboardAverage}`);
  console.log(`  Implied Total: ${leaderboardTotalPoints.toFixed(2)}`);
  console.log('');
  console.log(`Missing Games Analysis:`);
  console.log(`  Missing Games: ${missingGames}`);
  console.log(`  Missing Total Points: ${missingTotalPoints.toFixed(2)}`);
  console.log(`  Required Average per Missing Game: ${missingAverage.toFixed(2)}`);
  console.log('');

  // Compare with known game scores from CSV
  const knownScores = [22.54, 66.50, 31.79, 55.10]; // From our earlier calculation
  const knownTotal = knownScores.reduce((sum, score) => sum + score, 0);
  const knownAverage = knownTotal / knownScores.length;

  console.log(`🔍 DETAILED COMPARISON:`);
  console.log(`Known Individual Game Scores: [${knownScores.join(', ')}]`);
  console.log(`Known Total: ${knownTotal.toFixed(2)}`);
  console.log(`Known Average: ${knownAverage.toFixed(2)}`);
  console.log(`CSV Summary Total: ${csvTotalPoints.toFixed(2)}`);
  console.log(`Difference: ${Math.abs(knownTotal - csvTotalPoints).toFixed(2)}`);
  console.log('');

  // Analyze what types of games could achieve the missing average
  const maxKnownScore = Math.max(...knownScores);
  const minKnownScore = Math.min(...knownScores);
  
  console.log(`🎮 MISSING GAME SCORE ANALYSIS:`);
  console.log(`Each missing game needs to score: ${missingAverage.toFixed(2)} points`);
  console.log(`Highest known game: ${maxKnownScore.toFixed(2)} points`);
  console.log(`Lowest known game: ${minKnownScore.toFixed(2)} points`);
  console.log(`Known game range: ${minKnownScore.toFixed(2)} - ${maxKnownScore.toFixed(2)}`);
  console.log('');
  
  if (missingAverage > maxKnownScore) {
    console.log(`🚨 SUSPICIOUS: Missing games need ${missingAverage.toFixed(2)} pts each`);
    console.log(`   This is ${(missingAverage - maxKnownScore).toFixed(2)} points higher than his best known game!`);
    console.log(`   This suggests either:`);
    console.log(`   1. Gandalf1k had 2 exceptionally high-scoring games`);
    console.log(`   2. There's still a calculation error in the leaderboard`);
    console.log(`   3. The missing games are from a different scoring system/period`);
  } else if (missingAverage >= knownAverage) {
    console.log(`✅ PLAUSIBLE: Missing games need ${missingAverage.toFixed(2)} pts each`);
    console.log(`   This is within the range of his known performances (avg: ${knownAverage.toFixed(2)})`);
  } else {
    console.log(`📉 LOW: Missing games only need ${missingAverage.toFixed(2)} pts each`);
    console.log(`   This is below his known average, suggesting weaker recent games`);
  }

  // Show what a complete 6-game breakdown might look like
  console.log(`\n🎯 PROJECTED 6-GAME BREAKDOWN:`);
  console.log(`Games 1-4 (Known): ${knownTotal.toFixed(2)} total, ${knownAverage.toFixed(2)} avg`);
  console.log(`Games 5-6 (Missing): ${missingTotalPoints.toFixed(2)} total, ${missingAverage.toFixed(2)} avg each`);
  console.log(`All 6 Games: ${leaderboardTotalPoints.toFixed(2)} total, ${leaderboardAverage} avg`);
  
  // Final assessment
  console.log(`\n🔍 CONCLUSION:`);
  if (Math.abs(missingAverage - knownAverage) > 50) {
    console.log(`❌ LIKELY DATA ISSUE: Missing games would need very different scoring`);
    console.log(`   Expected: ~${knownAverage.toFixed(2)} per game`);
    console.log(`   Actual needed: ${missingAverage.toFixed(2)} per game`);
    console.log(`   This suggests the leaderboard calculation may still be incorrect`);
  } else {
    console.log(`✅ PLAUSIBLE: Missing games are within reasonable scoring range`);
    console.log(`   The 301.15 average could be legitimate if 2 more games exist`);
  }
}

calculateMissingGames();