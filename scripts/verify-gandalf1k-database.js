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
    
    req.setTimeout(30000, () => {
      req.abort();
      reject(new Error('Request timeout'));
    });
    
    req.write(postData);
    req.end();
  });
}

async function verifyGandalf1kDatabase() {
  console.log('🔍 Verifying Gandalf1k data in current database...\n');

  try {
    // First, let's verify the current fantasy data structure
    console.log('📡 Calling verifyFantasyData API...');
    const verifyResponse = await makePostRequest('http://localhost:3003/api/admin/verifyFantasyData');
    
    console.log('📊 Fantasy data verification results:');
    console.log('─'.repeat(60));
    
    if (verifyResponse.success) {
      console.log(`✅ Success: ${verifyResponse.message}`);
      
      if (verifyResponse.databaseStructure) {
        const structure = verifyResponse.databaseStructure;
        console.log(`\n📁 Database Structure:`);
        console.log(`  Tournament Players: ${structure.tournamentPlayers} documents`);
        console.log(`  Fantasy Lineups: ${structure.fantasyLineups} documents`);
        console.log(`  Matches: ${structure.matches} documents`);
        console.log(`  Games with Performances: ${structure.gamesWithPerformances} documents`);
        
        if (structure.samplePlayers && structure.samplePlayers.length > 0) {
          console.log(`\n👥 Sample Players:`);
          structure.samplePlayers.forEach((player, index) => {
            console.log(`  ${index + 1}. ${player.nickname} (${player.role}) - Team: ${player.teamName || 'Unknown'}`);
          });
        }
        
        if (structure.samplePerformances && structure.samplePerformances.length > 0) {
          console.log(`\n🎮 Sample Performances:`);
          structure.samplePerformances.forEach((perf, index) => {
            console.log(`  ${index + 1}. ${perf.playerName} - ${perf.fantasyPoints || 0} pts (Game: ${perf.gameId})`);
          });
        }
        
        // Look for Gandalf1k specifically
        const gandalf1kInSample = structure.samplePlayers?.find(p => 
          p.nickname?.toLowerCase().includes('gandalf1k')
        );
        
        if (gandalf1kInSample) {
          console.log(`\n🎯 Found Gandalf1k in tournament players:`);
          console.log(`  Player ID: ${gandalf1kInSample.playerId}`);
          console.log(`  Nickname: ${gandalf1kInSample.nickname}`);
          console.log(`  Role: ${gandalf1kInSample.role}`);
          console.log(`  Team: ${gandalf1kInSample.teamName}`);
        }
        
        // Check if Gandalf1k has any performances in the sample
        const gandalf1kPerfs = structure.samplePerformances?.filter(p => 
          p.playerName?.toLowerCase().includes('gandalf1k') || 
          p.playerId === gandalf1kInSample?.playerId
        );
        
        if (gandalf1kPerfs && gandalf1kPerfs.length > 0) {
          console.log(`\n🎮 Gandalf1k performances in sample:`);
          gandalf1kPerfs.forEach((perf, index) => {
            console.log(`  Game ${index + 1}: ${perf.fantasyPoints || 0} pts - Game ${perf.gameId} (${perf.matchId})`);
          });
        }
      }
      
      // Now let's run the enhanced recalculation and see what it finds
      console.log(`\n\n🧮 Running enhanced fantasy recalculation to get current data...`);
      const recalcResponse = await makePostRequest('http://localhost:3003/api/admin/recalculateFantasyScoresEnhanced');
      
      if (recalcResponse.success) {
        console.log(`✅ Recalculation Success: ${recalcResponse.message}`);
        
        if (recalcResponse.statistics) {
          const stats = recalcResponse.statistics;
          console.log(`\n📊 Recalculation Statistics:`);
          console.log(`  Users Processed: ${stats.usersProcessed || 0}`);
          console.log(`  Total Player Games: ${stats.totalPlayerGames || 0}`);
          console.log(`  Total Fantasy Points: ${stats.totalFantasyPoints?.toFixed(2) || 0}`);
          console.log(`  Average PPG: ${stats.averagePointsPerGame?.toFixed(2) || 0}`);
        }
        
        // Look for specific Gandalf1k data in the results
        if (recalcResponse.sampleCalculations) {
          const gandalf1kCalc = recalcResponse.sampleCalculations.find(calc => 
            calc.displayName?.toLowerCase().includes('gandalf1k') || 
            Object.values(calc.currentLineup || {}).some(p => 
              p.nickname?.toLowerCase().includes('gandalf1k')
            )
          );
          
          if (gandalf1kCalc) {
            console.log(`\n🎯 Found Gandalf1k calculation:`);
            console.log(`  User: ${gandalf1kCalc.displayName}`);
            console.log(`  Total Points: ${gandalf1kCalc.totalFantasyScore?.toFixed(2) || 0}`);
            console.log(`  Total Games: ${gandalf1kCalc.totalPlayerGames || 0}`);
            console.log(`  Average: ${gandalf1kCalc.averageFantasyScore?.toFixed(2) || 0}`);
            
            if (gandalf1kCalc.roundScores) {
              console.log(`  Round Scores:`);
              Object.entries(gandalf1kCalc.roundScores).forEach(([round, roundData]) => {
                console.log(`    ${round}: ${roundData.totalPoints?.toFixed(2) || 0} pts in ${roundData.totalPlayerGames || 0} games`);
              });
            }
          }
        }
      } else {
        console.log(`❌ Recalculation failed: ${recalcResponse.message}`);
        if (recalcResponse.error) {
          console.log(`Error details: ${recalcResponse.error}`);
        }
      }
      
    } else {
      console.log(`❌ Verification failed: ${verifyResponse.message}`);
      if (verifyResponse.error) {
        console.log(`Error details: ${verifyResponse.error}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Database verification failed:', error);
  }
}

verifyGandalf1kDatabase();