#!/usr/bin/env node

// Complete detailed fantasy leaderboard with all user info
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
    
    req.setTimeout(30000, () => {
      req.abort();
      reject(new Error('Request timeout'));
    });
  });
}

async function showCompleteDetailedLeaderboard() {
  try {
    console.log('🏆 FETCHING COMPLETE DETAILED FANTASY LEADERBOARD...\n');
    
    const url = 'http://localhost:3003/api/admin/debugFantasyRounds';
    const response = await makeRequest(url);
    
    if (!response.success) {
      throw new Error(`API request failed: ${response.message || 'Unknown error'}`);
    }
    
    console.log('=' .repeat(150));
    console.log('🏆 COMPLETE DETAILED FANTASY LEADERBOARD (Corrected Player-Game Scoring)');
    console.log('=' .repeat(150));
    
    // Extract and sort the sample lineups by average PPG
    const leaderboard = response.sampleLineups || [];
    leaderboard.sort((a, b) => b.userData.averageFantasyScore - a.userData.averageFantasyScore);
    
    // Display each user with full details
    leaderboard.forEach((user, index) => {
      const rank = index + 1;
      const userId = user.userId;
      const totalPoints = user.userData.totalFantasyScore.toFixed(1);
      const games = user.userData.gamesPlayed;
      const avgPPG = user.userData.averageFantasyScore.toFixed(2);
      
      console.log(`\n${rank}. USER: ${userId}`);
      console.log(`   Total Points: ${totalPoints} | Player-Games: ${games} | Average PPG: ${avgPPG}`);
      
      // Show lineup details for each round
      if (user.rounds && user.rounds.length > 0) {
        user.rounds.forEach(roundInfo => {
          console.log(`   \n   📋 ROUND: ${roundInfo.roundId}`);
          
          if (roundInfo.data && roundInfo.data.lineup) {
            const lineup = roundInfo.data.lineup;
            
            console.log('   🎮 LINEUP:');
            Object.entries(lineup).forEach(([role, player]) => {
              if (player && player.nickname) {
                console.log(`      ${role}: ${player.nickname} (${player.teamName || 'Unknown Team'}) - ID: ${player.id}`);
              }
            });
            
            // If we have detailed performance data, show individual player scores
            if (roundInfo.data.playerPerformances) {
              console.log('   \n   📊 INDIVIDUAL PLAYER SCORES:');
              Object.entries(roundInfo.data.playerPerformances).forEach(([playerId, performance]) => {
                const playerInfo = Object.values(lineup).find(p => p && p.id === playerId);
                const playerName = playerInfo ? playerInfo.nickname : 'Unknown';
                console.log(`      ${playerName} (${playerId}): ${performance.totalPoints.toFixed(1)} pts in ${performance.gamesPlayed} games (${performance.avgPPG.toFixed(1)} PPG)`);
              });
            }
          }
        });
      }
      
      console.log('   ' + '-'.repeat(140));
    });
    
    console.log('\n' + '=' .repeat(150));
    
    // Summary statistics
    const activeUsers = leaderboard.filter(u => u.userData.gamesPlayed > 0);
    const totalPoints = activeUsers.reduce((sum, u) => sum + u.userData.totalFantasyScore, 0);
    const totalGames = activeUsers.reduce((sum, u) => sum + u.userData.gamesPlayed, 0);
    const avgScore = activeUsers.length > 0 ? activeUsers.reduce((sum, u) => sum + u.userData.averageFantasyScore, 0) / activeUsers.length : 0;
    
    console.log('📊 COMPLETE LEADERBOARD SUMMARY:');
    console.log(`   Total Fantasy Users: ${leaderboard.length}`);
    console.log(`   Active Users: ${activeUsers.length}`);
    console.log(`   Total Points Distributed: ${totalPoints.toFixed(1)}`);
    console.log(`   Total Player-Games Played: ${totalGames}`);
    console.log(`   Average Score Across All Users: ${avgScore.toFixed(2)} PPG`);
    
    if (activeUsers.length > 0) {
      const topUser = activeUsers[0];
      const medianIndex = Math.floor(activeUsers.length / 2);
      const medianUser = activeUsers[medianIndex];
      
      console.log(`   Highest Average: ${topUser.userData.averageFantasyScore.toFixed(2)} PPG (${topUser.userId})`);
      console.log(`   Median Average: ${medianUser.userData.averageFantasyScore.toFixed(2)} PPG`);
      console.log(`   Lowest Active: ${activeUsers[activeUsers.length - 1].userData.averageFantasyScore.toFixed(2)} PPG`);
    }
    
    console.log('\n🎯 CORRECTED SCORING SYSTEM FEATURES:');
    console.log('   ✅ Individual player-games counted (not tournament games)');
    console.log('   ✅ Role-balanced multipliers (Mid 3.8x kills, Offlane 3.0x kills)');
    console.log('   ✅ Hard Support healing properly nerfed (÷150 instead of ÷80)');
    console.log('   ✅ No performance floor - bad play gets negative scores');
    console.log('   ✅ Realistic PPG averages (35-95 range instead of 400+)');
    console.log('   ✅ Mixed lineups competitive with same-team strategies');
    
  } catch (error) {
    console.error('❌ Error fetching detailed leaderboard:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  showCompleteDetailedLeaderboard();
}

module.exports = { showCompleteDetailedLeaderboard };