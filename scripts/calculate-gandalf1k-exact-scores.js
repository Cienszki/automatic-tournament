const fs = require('fs');

// Parse the CSV data and calculate exact fantasy scores for Gandalf1k
function calculateGandalf1kExactScores() {
  console.log('🧮 Calculating Gandalf1k\'s fantasy scores using exact leaderboard algorithm...\n');

  try {
    // Read the fantasy scoring CSV file
    const csvData = fs.readFileSync('./fantasy-scoring-final.csv', 'utf8');
    const lines = csvData.split('\n').filter(line => line.trim());
    
    // Get header to understand structure
    const header = lines[0].split(',');
    console.log('📋 CSV Structure:', header.slice(0, 10), '... (', header.length, 'total columns)');
    
    // Find Gandalf1k's performances
    const gandalf1kLines = lines.filter(line => 
      line.toLowerCase().includes('gandalf1k')
    );
    
    console.log(`\n🎯 Found ${gandalf1kLines.length} Gandalf1k performance records\n`);
    
    if (gandalf1kLines.length === 0) {
      console.log('❌ No Gandalf1k performances found in CSV');
      return;
    }
    
    // Parse each performance and extract the actual calculated fantasy points
    const performances = gandalf1kLines.map((line, index) => {
      const values = line.split(',');
      
      // Based on the CSV header structure:
      // Last column (index 49) is "Est Total Points" - the final calculated fantasy score
      const fantasyPoints = parseFloat(values[49]) || 0;
      
      // Extract key performance metrics using correct column indexes
      const nickname = values[0] || '';
      const role = values[1] || '';
      const team = values[2] || '';
      const matchId = values[9] || '';
      const gameId = values[10] || '';
      const hero = values[11] || '';   // Hero name
      const gameDuration = parseFloat(values[12]) || 0;
      const radiantWin = values[13] === 'true';
      const playerWon = values[14] === 'true'; // This is already calculated
      const kills = parseInt(values[15]) || 0;
      const deaths = parseInt(values[16]) || 0;
      const assists = parseInt(values[17]) || 0;
      const kda = parseFloat(values[18]) || 0;
      const gpm = parseInt(values[19]) || 0;
      const xpm = parseInt(values[20]) || 0;
      const lastHits = parseInt(values[21]) || 0;
      const denies = parseInt(values[22]) || 0;
      const netWorth = parseInt(values[23]) || 0;
      const heroDamage = parseInt(values[24]) || 0;
      const towerDamage = parseInt(values[25]) || 0;
      
      const teamWon = playerWon; // Use the pre-calculated field
      
      return {
        gameIndex: index + 1,
        nickname,
        role,
        team,
        matchId,
        gameId,
        hero,
        gameDuration,
        teamWon,
        radiantWin,
        kills,
        deaths,
        assists,
        kda,
        gpm,
        xpm,
        lastHits,
        denies,
        heroDamage,
        netWorth,
        towerDamage,
        calculatedFantasyPoints: fantasyPoints
      };
    });
    
    // Display each game performance with detailed breakdown
    console.log('🎮 Individual Game Performances:\n');
    console.log('═'.repeat(80));
    
    let totalPoints = 0;
    let totalGames = performances.length;
    
    performances.forEach(perf => {
      totalPoints += perf.calculatedFantasyPoints;
      
      console.log(`Game ${perf.gameIndex}: ${perf.calculatedFantasyPoints.toFixed(2)} fantasy points`);
      console.log(`  🏆 Hero: ${perf.hero} (${perf.gameDuration.toFixed(1)}m game)`);
      console.log(`  🎯 Game ID: ${perf.gameId}`);
      console.log(`  ${perf.teamWon ? '🟢 WIN' : '🔴 LOSS'} (${perf.gameDuration.toFixed(1)} minute game)`);
      console.log(`  📊 KDA: ${perf.kills}/${perf.deaths}/${perf.assists} (${perf.kda.toFixed(2)} ratio)`);
      console.log(`  💰 Economy: ${perf.gpm} GPM, ${perf.xpm} XPM`);
      console.log(`  ⚔️  Combat: ${perf.heroDamage?.toLocaleString()} hero dmg, ${perf.netWorth?.toLocaleString()} net worth`);
      console.log(`  🏗️  Objectives: ${perf.towerDamage?.toLocaleString()} tower dmg, ${perf.lastHits} LH, ${perf.denies} denies`);
      console.log(`  🎯 Match/Game: ${perf.matchId}/${perf.gameId}`);
      console.log('');
    });
    
    // Calculate summary statistics
    const averageScore = totalPoints / totalGames;
    const maxScore = Math.max(...performances.map(p => p.calculatedFantasyPoints));
    const minScore = Math.min(...performances.map(p => p.calculatedFantasyPoints));
    const maxGame = performances.find(p => p.calculatedFantasyPoints === maxScore);
    const minGame = performances.find(p => p.calculatedFantasyPoints === minScore);
    
    console.log('📊 EXACT LEADERBOARD CALCULATION RESULTS:');
    console.log('═'.repeat(60));
    console.log(`Player: Gandalf1k (Mid, Psychiatryk)`);
    console.log(`Total Games: ${totalGames}`);
    console.log(`Total Fantasy Points: ${totalPoints.toFixed(2)}`);
    console.log(`Average Score: ${averageScore.toFixed(2)} points per game`);
    console.log(`Score Range: ${minScore.toFixed(2)} - ${maxScore.toFixed(2)}`);
    console.log(`\n🏆 Best Game: ${maxScore.toFixed(2)} pts (${maxGame.hero} vs Game ${maxGame.gameId})`);
    console.log(`   ${maxGame.teamWon ? '🟢 WIN' : '🔴 LOSS'} - ${maxGame.kills}/${maxGame.deaths}/${maxGame.assists}, ${maxGame.gpm} GPM`);
    console.log(`\n📉 Worst Game: ${minScore.toFixed(2)} pts (${minGame.hero} vs Game ${minGame.gameId})`);
    console.log(`   ${minGame.teamWon ? '🟢 WIN' : '🔴 LOSS'} - ${minGame.kills}/${minGame.deaths}/${minGame.assists}, ${minGame.gpm} GPM`);
    
    // Compare with the leaderboard value we saw earlier (301.15)
    const expectedLeaderboardAvg = 301.15;
    const difference = Math.abs(averageScore - expectedLeaderboardAvg);
    
    console.log(`\n🔍 VERIFICATION:`);
    console.log(`Calculated Average: ${averageScore.toFixed(2)}`);
    console.log(`Leaderboard Shows: ${expectedLeaderboardAvg}`);
    console.log(`Difference: ${difference.toFixed(2)} points`);
    console.log(`Match Status: ${difference < 1.0 ? '✅ EXACT MATCH' : difference < 5.0 ? '⚠️  CLOSE MATCH' : '❌ SIGNIFICANT DIFFERENCE'}`);
    
    // Analyze performance patterns
    console.log(`\n🔬 PERFORMANCE ANALYSIS:`);
    const wins = performances.filter(p => p.teamWon).length;
    const losses = performances.filter(p => !p.teamWon).length;
    const winRate = (wins / totalGames * 100);
    
    const avgOnWin = performances.filter(p => p.teamWon).reduce((sum, p) => sum + p.calculatedFantasyPoints, 0) / wins;
    const avgOnLoss = performances.filter(p => !p.teamWon).reduce((sum, p) => sum + p.calculatedFantasyPoints, 0) / losses;
    
    console.log(`Win Rate: ${wins}W-${losses}L (${winRate.toFixed(1)}%)`);
    console.log(`Average on Wins: ${avgOnWin.toFixed(2)} points`);
    console.log(`Average on Losses: ${avgOnLoss.toFixed(2)} points`);
    console.log(`Win/Loss Scoring Difference: ${(avgOnWin - avgOnLoss).toFixed(2)} points`);
    
    // Check for specific heroes or patterns
    const heroStats = {};
    performances.forEach(perf => {
      if (!heroStats[perf.hero]) {
        heroStats[perf.hero] = { games: 0, totalPoints: 0, wins: 0 };
      }
      heroStats[perf.hero].games++;
      heroStats[perf.hero].totalPoints += perf.calculatedFantasyPoints;
      if (perf.teamWon) heroStats[perf.hero].wins++;
    });
    
    console.log(`\n🦸 HERO PERFORMANCE:`);
    Object.entries(heroStats).forEach(([hero, stats]) => {
      const avg = stats.totalPoints / stats.games;
      const winRate = (stats.wins / stats.games * 100);
      console.log(`  ${hero}: ${avg.toFixed(2)} avg (${stats.games} games, ${winRate.toFixed(0)}% WR)`);
    });
    
    // Flag any unusually high scoring games
    const outlierThreshold = averageScore + (averageScore * 0.5); // 50% above average
    const outliers = performances.filter(p => p.calculatedFantasyPoints > outlierThreshold);
    
    if (outliers.length > 0) {
      console.log(`\n🚨 HIGH-SCORING GAMES (>${outlierThreshold.toFixed(2)} pts):`);
      outliers.forEach(game => {
        console.log(`  ${game.calculatedFantasyPoints.toFixed(2)} pts - ${game.hero} (${game.kills}/${game.deaths}/${game.assists})`);
        console.log(`     ${game.gpm} GPM, ${game.heroDamage?.toLocaleString()} damage, ${game.teamWon ? 'WIN' : 'LOSS'}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Calculation failed:', error);
  }
}

calculateGandalf1kExactScores();