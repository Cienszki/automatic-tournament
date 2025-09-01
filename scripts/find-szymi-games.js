#!/usr/bin/env node

// Simple HTTP request to query SZYMI stats via API
const http = require('http');

function makeRequest(url, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method,
      headers: {
        'Content-Type': 'application/json',
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
          resolve(responseData);
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

    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function findSZYMIGames() {
  console.log('🔍 Searching for SZYMI games via leaderboard API...\n');
  
  try {
    // Get leaderboard data
    const response = await makeRequest('http://localhost:3001/api/fantasy/leaderboards');
    
    if (!response.success) {
      throw new Error('Failed to fetch leaderboard data');
    }
    
    // Look for SZYMI in the Offlane role leaderboard
    const offlaners = response.leaderboards.byRole['Offlane'] || [];
    const szymi = offlaners.find(player => player.nickname === 'SZYMI');
    
    if (szymi) {
      console.log('📊 SZYMI FOUND IN LEADERBOARD:');
      console.log(`   Player ID: ${szymi.playerId}`);
      console.log(`   Nickname: ${szymi.nickname}`);
      console.log(`   Team: ${szymi.teamName}`);
      console.log(`   Role: Offlane`);
      console.log(`   Total Games: ${szymi.totalMatches}`);
      console.log(`   Average Score: ${szymi.averageScore.toFixed(1)}`);
      console.log(`   Rank in Role: ${szymi.rank}`);
    } else {
      console.log('❌ SZYMI not found in Offlane leaderboard');
      console.log('\n🔍 Checking all roles...');
      
      // Check all roles
      Object.keys(response.leaderboards.byRole).forEach(role => {
        const players = response.leaderboards.byRole[role];
        const foundPlayer = players.find(p => p.nickname === 'SZYMI');
        if (foundPlayer) {
          console.log(`   Found SZYMI in ${role}: ${foundPlayer.totalMatches} games`);
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Error searching for SZYMI games:', error.message);
  }
}

// Run the script
if (require.main === module) {
  findSZYMIGames();
}

module.exports = { findSZYMIGames };