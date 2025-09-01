const http = require('http');

function makePostRequest(url, data = {}) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: 'localhost',
      port: 3003,
      path: url.replace('http://localhost:3003', ''),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          resolve(JSON.parse(responseData));
        } catch (error) {
          reject(new Error(`Failed to parse JSON: ${error.message}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.setTimeout(30000, () => {
      req.abort();
      reject(new Error('Request timeout'));
    });
    
    req.write(postData);
    req.end();
  });
}

async function findAllGandalf1kGames() {
  console.log('🔍 Finding all Gandalf1k games from database match collection...\n');

  try {
    // First, find Gandalf1k's player ID
    console.log('📡 Finding Gandalf1k player data...');
    const findPlayerResponse = await makePostRequest('http://localhost:3003/api/admin/findPlayerData', {
      searchTerm: 'gandalf1k'
    });
    
    let gandalf1kId = null;
    
    if (findPlayerResponse.success && findPlayerResponse.players && findPlayerResponse.players.length > 0) {
      const player = findPlayerResponse.players[0];
      gandalf1kId = player.playerId;
      console.log(`✅ Found Gandalf1k: ${player.nickname} (ID: ${gandalf1kId})`);
      console.log(`   Role: ${player.role}, Team: ${player.teamName}`);
    } else {
      console.log('❌ Could not find Gandalf1k in tournament players');
      console.log('Searching by examining match structure instead...');
    }
    
    // Examine all matches to find Gandalf1k performances
    console.log('\n📊 Examining all matches for Gandalf1k performances...');
    const examineResponse = await makePostRequest('http://localhost:3003/api/admin/examineMatchStructure', {});
    
    if (!examineResponse.success) {
      console.log('❌ Failed to examine match structure:', examineResponse.message);
      return;
    }
    
    console.log(`✅ Found ${examineResponse.matchesWithStructure?.length || 0} matches to examine\n`);
    
    const allGandalf1kGames = [];
    const matchSummary = [];
    
    if (examineResponse.matchesWithStructure) {
      examineResponse.matchesWithStructure.forEach(match => {
        const matchId = match.matchId;
        const matchRound = match.round || 'Unknown';
        let matchGamesCount = 0;
        let matchGandalf1kGames = 0;
        
        if (match.games && match.games.length > 0) {
          matchGamesCount = match.games.length;
          
          match.games.forEach(game => {
            const gameId = game.gameId;
            const gameDate = game.gameDate || 'Unknown date';
            
            if (game.performances && game.performances.length > 0) {
              // Look for Gandalf1k in this game's performances
              const gandalf1kPerf = game.performances.find(perf => {
                return (
                  (gandalf1kId && perf.playerId === gandalf1kId) ||
                  (perf.playerName && perf.playerName.toLowerCase().includes('gandalf1k')) ||
                  (perf.nickname && perf.nickname.toLowerCase().includes('gandalf1k'))
                );
              });
              
              if (gandalf1kPerf) {
                matchGandalf1kGames++;
                allGandalf1kGames.push({
                  matchId,
                  matchRound,
                  gameId,
                  gameDate,
                  playerId: gandalf1kPerf.playerId || 'Unknown',
                  playerName: gandalf1kPerf.playerName || gandalf1kPerf.nickname || 'Gandalf1k',
                  teamName: gandalf1kPerf.teamName || 'Unknown',
                  fantasyPoints: gandalf1kPerf.fantasyPoints || 0,
                  kills: gandalf1kPerf.kills || 0,
                  deaths: gandalf1kPerf.deaths || 0,
                  assists: gandalf1kPerf.assists || 0,
                  gpm: gandalf1kPerf.gpm || 0,
                  xpm: gandalf1kPerf.xpm || 0,
                  netWorth: gandalf1kPerf.netWorth || 0,
                  heroDamage: gandalf1kPerf.heroDamage || 0,
                  lastHits: gandalf1kPerf.lastHits || 0,
                  heroId: gandalf1kPerf.heroId || 0
                });
              }
            }
          });
        }
        
        matchSummary.push({
          matchId,
          round: matchRound,
          totalGames: matchGamesCount,
          gandalf1kGames: matchGandalf1kGames
        });
      });
    }
    
    // Display results
    console.log('🎮 ALL GANDALF1K GAMES FOUND IN DATABASE:');
    console.log('═'.repeat(80));
    
    if (allGandalf1kGames.length === 0) {
      console.log('❌ No Gandalf1k games found in database!');
      console.log('\n📋 Match Summary:');
      matchSummary.forEach(match => {
        console.log(`  ${match.matchId} (${match.round}): ${match.totalGames} games, ${match.gandalf1kGames} with Gandalf1k`);
      });
      return;
    }
    
    // Sort games by match and game ID for chronological order
    allGandalf1kGames.sort((a, b) => {
      if (a.matchId !== b.matchId) return a.matchId.localeCompare(b.matchId);
      return a.gameId.localeCompare(b.gameId);
    });
    
    console.log(`✅ Found ${allGandalf1kGames.length} Gandalf1k games in database:\n`);
    
    let totalFantasyPoints = 0;
    
    allGandalf1kGames.forEach((game, index) => {
      totalFantasyPoints += game.fantasyPoints;
      
      console.log(`Game ${index + 1}: ${game.fantasyPoints.toFixed(2)} fantasy points`);
      console.log(`  🎯 Match: ${game.matchId} (${game.matchRound})`);
      console.log(`  🎮 Game: ${game.gameId}`);
      console.log(`  🗓️  Date: ${game.gameDate}`);
      console.log(`  👤 Player: ${game.playerName} (${game.teamName})`);
      console.log(`  📊 KDA: ${game.kills}/${game.deaths}/${game.assists}`);
      console.log(`  💰 Economy: ${game.gpm} GPM, ${game.xpm} XPM`);
      console.log(`  ⚔️  Combat: ${game.heroDamage?.toLocaleString()} hero damage, ${game.netWorth?.toLocaleString()} net worth`);
      console.log(`  🏗️  Farm: ${game.lastHits} last hits`);
      console.log('');
    });
    
    // Calculate statistics
    const averageFantasyPoints = totalFantasyPoints / allGandalf1kGames.length;
    const maxGame = allGandalf1kGames.reduce((max, game) => game.fantasyPoints > max.fantasyPoints ? game : max);
    const minGame = allGandalf1kGames.reduce((min, game) => game.fantasyPoints < min.fantasyPoints ? game : min);
    
    console.log('📊 GANDALF1K DATABASE STATISTICS:');
    console.log('═'.repeat(50));
    console.log(`Total Games Found: ${allGandalf1kGames.length}`);
    console.log(`Total Fantasy Points: ${totalFantasyPoints.toFixed(2)}`);
    console.log(`Average Fantasy Points: ${averageFantasyPoints.toFixed(2)}`);
    console.log(`Highest Game: ${maxGame.fantasyPoints.toFixed(2)} (Game ${maxGame.gameId})`);
    console.log(`Lowest Game: ${minGame.fantasyPoints.toFixed(2)} (Game ${minGame.gameId})`);
    console.log('');
    
    // Compare with leaderboard
    const leaderboardAverage = 301.15;
    const leaderboardGames = 6;
    const difference = Math.abs(averageFantasyPoints - leaderboardAverage);
    
    console.log('🔍 COMPARISON WITH LEADERBOARD:');
    console.log(`Database Average: ${averageFantasyPoints.toFixed(2)}`);
    console.log(`Leaderboard Average: ${leaderboardAverage}`);
    console.log(`Database Games: ${allGandalf1kGames.length}`);
    console.log(`Leaderboard Games: ${leaderboardGames}`);
    console.log(`Difference: ${difference.toFixed(2)} points`);
    console.log(`Match Status: ${difference < 1.0 ? '✅ EXACT MATCH' : difference < 10.0 ? '⚠️  CLOSE' : '❌ MAJOR DIFFERENCE'}`);
    
    // Show breakdown by round
    const roundBreakdown = {};
    allGandalf1kGames.forEach(game => {
      if (!roundBreakdown[game.matchRound]) {
        roundBreakdown[game.matchRound] = {
          games: 0,
          totalPoints: 0,
          matches: new Set()
        };
      }
      roundBreakdown[game.matchRound].games++;
      roundBreakdown[game.matchRound].totalPoints += game.fantasyPoints;
      roundBreakdown[game.matchRound].matches.add(game.matchId);
    });
    
    console.log('\n📈 BREAKDOWN BY ROUND:');
    Object.entries(roundBreakdown).forEach(([round, stats]) => {
      const avg = stats.totalPoints / stats.games;
      console.log(`  ${round}: ${stats.games} games, ${stats.totalPoints.toFixed(2)} total, ${avg.toFixed(2)} avg`);
      console.log(`    Matches: ${Array.from(stats.matches).join(', ')}`);
    });
    
  } catch (error) {
    console.error('❌ Failed to find Gandalf1k games:', error);
  }
}

findAllGandalf1kGames();