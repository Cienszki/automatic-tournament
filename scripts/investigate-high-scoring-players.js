const http = require('http');

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(new Error(`Failed to parse JSON: ${error.message}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.setTimeout(10000, () => {
      req.abort();
      reject(new Error('Request timeout'));
    });
  });
}

async function investigateHighScoringPlayers() {
  console.log('🔍 Investigating high-scoring players from Psychiatryk and Klałn Fiesta...\n');

  try {
    // Get current leaderboards via API
    console.log('📡 Fetching leaderboards from API...');
    const response = await makeRequest('http://localhost:3003/api/fantasy/leaderboards');
    
    if (!response.success) {
      console.log('❌ Failed to fetch leaderboards:', response.message);
      return;
    }
    
    const leaderboards = response.leaderboards;
    const overallLeaderboard = leaderboards.overall || [];
    
    console.log(`📊 Found ${overallLeaderboard.length} players in overall leaderboard\n`);
    
    // Filter and analyze leaderboard for suspicious patterns
    console.log('🔍 Analyzing leaderboard for suspicious patterns...\n');
    
    // Look for players with lineups containing Psychiatryk or Klałn Fiesta players
    const suspiciousTeams = ['Psychiatryk', 'Kłałn Fiesta', 'psychiatryk', 'klan fiesta', 'Klan Fiesta'];
    const playersWithSuspiciousLineups = [];
    const suspiciousIndividualPlayers = [];
    
    overallLeaderboard.forEach((player, rank) => {
      const lineup = player.currentLineup || {};
      
      // Check if any player in the lineup is from suspicious teams
      const suspiciousPlayersInLineup = [];
      Object.entries(lineup).forEach(([role, p]) => {
        if (p && p.teamName && suspiciousTeams.some(team => 
          p.teamName.toLowerCase().includes(team.toLowerCase())
        )) {
          suspiciousPlayersInLineup.push({
            role,
            nickname: p.nickname,
            teamName: p.teamName
          });
        }
      });
      
      if (suspiciousPlayersInLineup.length > 0) {
        playersWithSuspiciousLineups.push({
          rank: rank + 1,
          userId: player.userId,
          displayName: player.displayName,
          averageScore: player.averageScore,
          gamesPlayed: player.gamesPlayed,
          totalScore: player.totalScore,
          suspiciousPlayers: suspiciousPlayersInLineup
        });
      }
    });
    
    console.log(`🚨 Found ${playersWithSuspiciousLineups.length} fantasy users with Psychiatryk/Klałn Fiesta players in their lineups:\n`);
    
    playersWithSuspiciousLineups.forEach(user => {
      console.log(`🏆 Rank ${user.rank}: ${user.displayName}`);
      console.log(`   📈 Average Score: ${user.averageScore?.toFixed(2)} (${user.gamesPlayed} games)`);
      console.log(`   📊 Total Score: ${user.totalScore?.toFixed(2)}`);
      console.log(`   🚨 Suspicious players in lineup:`);
      user.suspiciousPlayers.forEach(p => {
        console.log(`      ${p.role}: ${p.nickname} from ${p.teamName}`);
      });
      console.log('');
    });
    
    // Analyze role-based leaderboards too
    console.log('\n🔍 Checking role-based leaderboards for suspicious patterns...\n');
    
    Object.entries(leaderboards.byRole || {}).forEach(([role, rolePlayers]) => {
      const suspiciousInRole = rolePlayers.filter(player => 
        suspiciousTeams.some(team => 
          player.teamName?.toLowerCase().includes(team.toLowerCase())
        )
      );
      
      if (suspiciousInRole.length > 0) {
        console.log(`🎯 ${role} Role - Found ${suspiciousInRole.length} suspicious players:`);
        suspiciousInRole.forEach((player, index) => {
          console.log(`   ${index + 1}. ${player.nickname} (${player.teamName})`);
          console.log(`      📈 Average Score: ${player.averageScore?.toFixed(2)}`);
          console.log(`      🎮 Games Played: ${player.totalMatches || 0}`);
          console.log(`      🏆 Rank in Role: ${player.rank || 'Unknown'}`);
        });
        console.log('');
      }
    });
    
    // Statistical analysis
    console.log('\n📊 Statistical Analysis:\n');
    
    const allAverageScores = overallLeaderboard.map(p => p.averageScore || 0);
    const totalPlayers = allAverageScores.length;
    const avgOfAll = allAverageScores.reduce((sum, score) => sum + score, 0) / totalPlayers;
    const sortedScores = [...allAverageScores].sort((a, b) => b - a);
    const top10Avg = sortedScores.slice(0, 10).reduce((sum, score) => sum + score, 0) / 10;
    const median = sortedScores[Math.floor(totalPlayers / 2)];
    
    console.log(`📈 Overall Tournament Statistics:`);
    console.log(`   Total Players: ${totalPlayers}`);
    console.log(`   Average Score (all): ${avgOfAll.toFixed(2)}`);
    console.log(`   Average Score (top 10): ${top10Avg.toFixed(2)}`);
    console.log(`   Median Score: ${median.toFixed(2)}`);
    console.log(`   Highest Score: ${sortedScores[0].toFixed(2)}`);
    console.log(`   Lowest Score: ${sortedScores[totalPlayers - 1].toFixed(2)}\n`);
    
    // Analyze suspicious players' performance vs. tournament average
    if (playersWithSuspiciousLineups.length > 0) {
      const suspiciousAvgs = playersWithSuspiciousLineups.map(p => p.averageScore || 0);
      const suspiciousAvgScore = suspiciousAvgs.reduce((sum, score) => sum + score, 0) / suspiciousAvgs.length;
      const highScoringCount = suspiciousAvgs.filter(score => score > top10Avg).length;
      
      console.log(`🚨 Suspicious Users Analysis:`);
      console.log(`   Users with suspicious lineups: ${playersWithSuspiciousLineups.length}`);
      console.log(`   Average score of suspicious users: ${suspiciousAvgScore.toFixed(2)}`);
      console.log(`   Users scoring above top-10 average: ${highScoringCount} (${(highScoringCount/suspiciousAvgs.length*100).toFixed(1)}%)`);
      console.log(`   Performance vs tournament average: ${((suspiciousAvgScore/avgOfAll-1)*100).toFixed(1)}% ${suspiciousAvgScore > avgOfAll ? 'higher' : 'lower'}`);
    }
    
  } catch (error) {
    console.error('❌ Investigation failed:', error);
  }
}

investigateHighScoringPlayers();