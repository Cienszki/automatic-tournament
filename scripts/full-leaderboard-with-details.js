#!/usr/bin/env node

// Complete fantasy leaderboard with all users from the recalculation logs
const recalculationData = [
  { userId: "28vD5PHBQCMefj1gbWrX1R8kBjM2", totalScore: 1714.33, games: 18, avgPPG: 95.24 },
  { userId: "1uTIoCrW2vaa0rMy04MR55Pt3GA2", totalScore: 2788.97, games: 30, avgPPG: 92.97 },
  { userId: "ECWWYGZeAuRh4nyD8zcNh2NFX2r2", totalScore: 2788.97, games: 30, avgPPG: 92.97 },
  { userId: "vqqEyhJ9U7ZMESuFm4RelmByIhm2", totalScore: 2788.97, games: 30, avgPPG: 92.97 },
  { userId: "CTRKrFfa37MuLQymMNEv9r4kVUh2", totalScore: 2329.32, games: 25, avgPPG: 93.17 },
  { userId: "8oeeUe3zBVVjaIOX8zKDOlkysKj1", totalScore: 1732.09, games: 20, avgPPG: 86.60 },
  { userId: "QiKViRHIprRbeVhXYfNBzvuapMF3", totalScore: 1732.09, games: 20, avgPPG: 86.60 },
  { userId: "c91YulN8KSQwki2zVaQBguPFXZk2", totalScore: 1732.09, games: 20, avgPPG: 86.60 },
  { userId: "yeXJO3djDBgyY8GMr5Xc3C4A9L23", totalScore: 1732.09, games: 20, avgPPG: 86.60 },
  { userId: "VUqv1SY8xrakEuZxwGUsN1Z41r32", totalScore: 2182.54, games: 26, avgPPG: 83.94 },
  { userId: "XxwSTC2zLdWhQ5bskt7ByTK00gi2", totalScore: 1823.43, games: 22, avgPPG: 82.88 },
  { userId: "DXAM2KwCqMTMWUjJXwdvjNerwyH2", totalScore: 1592.22, games: 20, avgPPG: 79.61 },
  { userId: "7if9nv0u6MM7NlWpqXmLLYVbzrT2", totalScore: 2066.97, games: 26, avgPPG: 79.50 },
  { userId: "ikta9wKQWZX1L8G0ibZyFSAqoBG3", totalScore: 2363.48, games: 30, avgPPG: 78.78 },
  { userId: "m61mxZB8PpXtj8kZd9Bp0pbNasM2", totalScore: 1715.86, games: 22, avgPPG: 77.99 },
  { userId: "Tr7Npo8S2UZVinprXx5c9AKIlIa2", totalScore: 1869.65, games: 24, avgPPG: 77.90 },
  { userId: "3gYCMp5COPMglCtEnfOQLC7pMR02", totalScore: 2327.22, games: 30, avgPPG: 77.57 },
  { userId: "YDiEUBjYykOobOOO2wDrya1u5WE3", totalScore: 2161.87, games: 28, avgPPG: 77.21 },
  { userId: "MpmwGNCgxgV104JKuxVyFrW9H442", totalScore: 2275.98, games: 30, avgPPG: 75.87 },
  { userId: "1mrcPz4VUXXvYdQPxaNu02Eq5hv2", totalScore: 2230.52, games: 30, avgPPG: 74.35 },
  { userId: "pDHbVWVDbyaABCcxUQMIq7C8op53", totalScore: 2230.52, games: 30, avgPPG: 74.35 },
  { userId: "pQq8ZzwA49XMH2JsdDcmVJbkTAn1", totalScore: 2230.52, games: 30, avgPPG: 74.35 },
  { userId: "UL9KjiwerNfrxeYqoZ7anIFZr1e2", totalScore: 2129.34, games: 29, avgPPG: 73.43 },
  { userId: "PkWaYKRyh5gHGkeyZevXy8H5eNy1", totalScore: 2027.36, games: 28, avgPPG: 72.41 },
  { userId: "h8btj7iQIvfTVPbSFZ6Y0cFwLRC2", totalScore: 1865.09, games: 26, avgPPG: 71.73 },
  { userId: "OS1Bc8jxMpPm4OKMllx8LJTO54S2", totalScore: 1999.20, games: 28, avgPPG: 71.40 },
  { userId: "u2HvIE3odIRdqfYECfqpTjYrTd32", totalScore: 1638.39, games: 23, avgPPG: 71.23 },
  { userId: "YoqDTaqgpoYB9NXB3BPHIcq2zGZ2", totalScore: 1699.74, games: 24, avgPPG: 70.82 },
  { userId: "AHkAid7rEVQ9saTSpXweoIMXlT52", totalScore: 1808.04, games: 26, avgPPG: 69.54 },
  { userId: "wyuueJzhcqgfa8A2hXeZRmQ7kPo2", totalScore: 1479.16, games: 22, avgPPG: 67.23 },
  { userId: "3E8pFGDDX4beFQKbAbM7MWIpwFG2", totalScore: 1809.28, games: 27, avgPPG: 67.01 },
  { userId: "48TQEwgZqDOxrBis5H4Ft2h6JmP2", totalScore: 1809.28, games: 27, avgPPG: 67.01 },
  { userId: "l2FeI27KagVZ87kx5agC1BDqntQ2", totalScore: 1337.46, games: 20, avgPPG: 66.87 },
  { userId: "SBrDWbzCmXfbb5uVoLBNibPGP2k2", totalScore: 1404.62, games: 21, avgPPG: 66.89 },
  { userId: "LOez7qT4PnMuD4OCyzpbHy9K9PS2", totalScore: 1463.47, games: 22, avgPPG: 66.52 },
  { userId: "LohyNnaCCYPrBYT7u7IZsZcutWk2", totalScore: 1791.98, games: 27, avgPPG: 66.37 },
  { userId: "wSKPAIrnkNWUM1SNAuW3Q9ElEJm2", totalScore: 1390.25, games: 21, avgPPG: 66.20 },
  { userId: "WHXXfpvffZTVrZkXnHOftBx049x2", totalScore: 1303.72, games: 20, avgPPG: 65.19 },
  { userId: "fJELOCQNLJfYTH4fUqibFrz3LbJ2", totalScore: 1676.88, games: 26, avgPPG: 64.50 },
  { userId: "LPFqK6LG9peJHyYlX6iY3IJiym93", totalScore: 1914.31, games: 30, avgPPG: 63.81 },
  { userId: "O2NnFom79uTEHPpG5Vo5189Dryk2", totalScore: 1910.19, games: 30, avgPPG: 63.67 },
  { userId: "5W0ImllRfzLlVm8sAHlpIjpSsvi2", totalScore: 1650.11, games: 26, avgPPG: 63.47 },
  { userId: "YFLSAcZiAsMwxuHmAuzgeTcumoE2", totalScore: 1896.91, games: 30, avgPPG: 63.23 },
  { userId: "4lqPnHjIJSUturGiNH5Nz2CWROe2", totalScore: 1231.43, games: 20, avgPPG: 61.57 },
  { userId: "TKMaItSUo1akIwkW7WvwoAqAYqm2", totalScore: 1778.93, games: 30, avgPPG: 59.30 },
  { userId: "d26RbdMe7BZjo1iooE2HZ5Rxnph1", totalScore: 1600.67, games: 27, avgPPG: 59.28 },
  { userId: "XSnF9QKG2ndTmrGNoetJArDp9r32", totalScore: 1174.69, games: 20, avgPPG: 58.73 },
  { userId: "kSrcjQpfZ5U02U64m9RsIhgdZSE2", totalScore: 1199.18, games: 21, avgPPG: 57.10 },
  { userId: "8CxMgZZYbyNbSAowYQkB07SAECJ2", totalScore: 1216.52, games: 22, avgPPG: 55.30 },
  { userId: "JmT1z4SmSydHuoTPdrjAPBwEo1K3", totalScore: 1133.65, games: 21, avgPPG: 53.98 },
  { userId: "HQurTstE2XMTkc9Qu0T68Il5ipt2", totalScore: 769.96, games: 15, avgPPG: 51.33 },
  { userId: "HwjIc3zP3uY4gwlbrd9LEKJ1E762", totalScore: 920.04, games: 18, avgPPG: 51.11 },
  { userId: "80myI4UK7OUHRRVQGZYaqNDgM0o1", totalScore: 1271.60, games: 25, avgPPG: 50.86 },
  { userId: "uCEuncmaYTO0RPh0UcOeTjIAvSm1", totalScore: 1012.47, games: 20, avgPPG: 50.62 },
  { userId: "VZM0b5v9IBNc5XM9uQfnAnsNToH2", totalScore: 836.45, games: 17, avgPPG: 49.20 },
  { userId: "HLg8P2lsrPaSRphUUy8NFbFvAr92", totalScore: 470.68, games: 10, avgPPG: 47.07 },
  { userId: "JFpHkZZ4gMMXhn9gpVqtT69P21z2", totalScore: 844.97, games: 18, avgPPG: 46.94 },
  { userId: "zbkJBpHGGYWEg1Hl8rrSCYoY4a73", totalScore: 813.40, games: 18, avgPPG: 45.19 },
  { userId: "3AcfJgh704dudWw1tjHgy03URzh1", totalScore: 870.37, games: 20, avgPPG: 43.52 },
  { userId: "Tves9yTlAIRdo2n8Y79Eod6gV1v2", totalScore: 1553.63, games: 36, avgPPG: 43.16 },
  { userId: "qiwt8uJn4PTVMMPK2vdqU5LpiS42", totalScore: 1553.63, games: 36, avgPPG: 43.16 },
  { userId: "6H6r4rDYtmYiQ2WH4EhwG6yJns42", totalScore: 664.65, games: 16, avgPPG: 41.54 },
  { userId: "QiWqndtZ4RgdkqfXWVzDhR01fkv1", totalScore: 716.99, games: 20, avgPPG: 35.85 },
  // Inactive users (0 games)
  { userId: "5ClPwAtByhUPfg1HCJghYqhmOBY2", totalScore: 0, games: 0, avgPPG: 0.00 },
  { userId: "B2u5siBFOcOAQpIJzUYObEcwOm02", totalScore: 0, games: 0, avgPPG: 0.00 },
  { userId: "C6smvVgO7Ud0wIgYdNOAIGI2ofi1", totalScore: 0, games: 0, avgPPG: 0.00 },
  { userId: "OJwgGag6dnU6lFiscmq6ygTOtic2", totalScore: 0, games: 0, avgPPG: 0.00 },
  { userId: "bPyjuTke7Jf3GEFLi2k734hG8193", totalScore: 0, games: 0, avgPPG: 0.00 },
  { userId: "jrqMpRIrxwPEHrOCc452jD2llAJ2", totalScore: 0, games: 0, avgPPG: 0.00 },
  { userId: "qyR08Ed67ZbZvHhOYJbB7UiJJOX2", totalScore: 0, games: 0, avgPPG: 0.00 },
  { userId: "xTMQ1gTrg0VEBZLU9z2uEbT2BhJ3", totalScore: 0, games: 0, avgPPG: 0.00 },
  { userId: "zggNQMfaSsUp4u7MLDK6XUwsEAE3", totalScore: 0, games: 0, avgPPG: 0.00 }
];

// Known lineup examples (top users)
const knownLineups = {
  "1uTIoCrW2vaa0rMy04MR55Pt3GA2": {
    displayName: "Jest Letko Fan #1",
    lineup: {
      Carry: { nickname: "-Obstacle", teamName: "Jest Letko", points: "558.0", games: 6 },
      Mid: { nickname: "Bocian", teamName: "Jest Letko", points: "557.8", games: 6 },
      Offlane: { nickname: "Pocieszny", teamName: "Jest Letko", points: "557.9", games: 6 },
      "Soft Support": { nickname: "AaDeHaDe", teamName: "Jest Letko", points: "557.6", games: 6 },
      "Hard Support": { nickname: "Be Boy", teamName: "Jest Letko", points: "557.7", games: 6 }
    }
  },
  "1mrcPz4VUXXvYdQPxaNu02Eq5hv2": {
    displayName: "Divine 640x480 Fan",
    lineup: {
      Carry: { nickname: "Fey", teamName: "divine 640x480", points: "446.1", games: 6 },
      Mid: { nickname: "dave", teamName: "divine 640x480", points: "446.1", games: 6 },
      Offlane: { nickname: "RKX", teamName: "divine 640x480", points: "446.1", games: 6 },
      "Soft Support": { nickname: "Whalesdontflop", teamName: "divine 640x480", points: "446.1", games: 6 },
      "Hard Support": { nickname: "Freenki", teamName: "divine 640x480", points: "446.1", games: 6 }
    }
  }
};

function getPerformanceTier(avgPPG) {
  if (avgPPG >= 90) return "🔥 ELITE";
  if (avgPPG >= 80) return "⭐ EXCELLENT";
  if (avgPPG >= 70) return "✅ GOOD";
  if (avgPPG >= 60) return "📈 AVERAGE";
  if (avgPPG >= 50) return "📉 BELOW AVG";
  if (avgPPG > 0) return "🔻 POOR";
  return "❌ INACTIVE";
}

async function showCompleteLeaderboard() {
  console.log('=' .repeat(180));
  console.log('🏆 COMPLETE FANTASY LEADERBOARD - ALL 72 USERS (Corrected Player-Game Scoring)');
  console.log('=' .repeat(180));
  
  // Sort by average PPG (descending)
  const sortedUsers = recalculationData.sort((a, b) => b.avgPPG - a.avgPPG);
  
  console.log(`\n${'Rank'.padEnd(5)} | ${'User ID'.padEnd(35)} | ${'Total Pts'.padStart(10)} | ${'Games'.padStart(6)} | ${'Avg PPG'.padStart(8)} | ${'Tier'.padEnd(12)} | Lineup Details`);
  console.log('-'.repeat(180));
  
  // Display each user
  sortedUsers.forEach((user, index) => {
    const rank = `${index + 1}.`.padEnd(5);
    const userId = user.userId.substring(0, 35).padEnd(35);
    const totalPts = user.totalScore.toFixed(1).padStart(10);
    const games = user.games.toString().padStart(6);
    const avgPPG = user.avgPPG.toFixed(2).padStart(8);
    const tier = getPerformanceTier(user.avgPPG).padEnd(12);
    
    // Check if we have lineup details
    const lineupInfo = knownLineups[user.userId];
    let lineupStr = "Mixed strategy lineup";
    
    if (lineupInfo) {
      const lineup = lineupInfo.lineup;
      lineupStr = Object.entries(lineup).map(([role, player]) => 
        `${role}: ${player.nickname} (${player.teamName})`
      ).join(', ');
    } else if (user.avgPPG === 92.97) {
      lineupStr = "Jest Letko full team (all 5 players)";
    } else if (user.avgPPG === 74.35) {
      lineupStr = "divine 640x480 full team (all 5 players)";
    }
    
    console.log(`${rank} | ${userId} | ${totalPts} | ${games} | ${avgPPG} | ${tier} | ${lineupStr}`);
    
    // Show detailed player breakdown for top 10
    if (index < 10 && lineupInfo && lineupInfo.lineup) {
      console.log('     └─ Player breakdown:');
      Object.entries(lineupInfo.lineup).forEach(([role, player]) => {
        console.log(`        ${role}: ${player.nickname} - ${player.points} pts in ${player.games} games (${(player.points/player.games).toFixed(1)} PPG)`);
      });
    }
  });
  
  console.log('\n' + '=' .repeat(180));
  
  // Performance distribution
  const tiers = {
    elite: sortedUsers.filter(u => u.avgPPG >= 90),
    excellent: sortedUsers.filter(u => u.avgPPG >= 80 && u.avgPPG < 90),
    good: sortedUsers.filter(u => u.avgPPG >= 70 && u.avgPPG < 80),
    average: sortedUsers.filter(u => u.avgPPG >= 60 && u.avgPPG < 70),
    belowAvg: sortedUsers.filter(u => u.avgPPG >= 50 && u.avgPPG < 60),
    poor: sortedUsers.filter(u => u.avgPPG > 0 && u.avgPPG < 50),
    inactive: sortedUsers.filter(u => u.avgPPG === 0)
  };
  
  console.log('📊 PERFORMANCE DISTRIBUTION:');
  console.log(`   🔥 Elite (90+ PPG): ${tiers.elite.length} users (${(tiers.elite.length/sortedUsers.length*100).toFixed(1)}%)`);
  console.log(`   ⭐ Excellent (80-90 PPG): ${tiers.excellent.length} users (${(tiers.excellent.length/sortedUsers.length*100).toFixed(1)}%)`);
  console.log(`   ✅ Good (70-80 PPG): ${tiers.good.length} users (${(tiers.good.length/sortedUsers.length*100).toFixed(1)}%)`);
  console.log(`   📈 Average (60-70 PPG): ${tiers.average.length} users (${(tiers.average.length/sortedUsers.length*100).toFixed(1)}%)`);
  console.log(`   📉 Below Average (50-60 PPG): ${tiers.belowAvg.length} users (${(tiers.belowAvg.length/sortedUsers.length*100).toFixed(1)}%)`);
  console.log(`   🔻 Poor (<50 PPG): ${tiers.poor.length} users (${(tiers.poor.length/sortedUsers.length*100).toFixed(1)}%)`);
  console.log(`   ❌ Inactive (0 games): ${tiers.inactive.length} users (${(tiers.inactive.length/sortedUsers.length*100).toFixed(1)}%)`);
  
  // Summary statistics
  const activeUsers = sortedUsers.filter(u => u.games > 0);
  const totalPoints = activeUsers.reduce((sum, u) => sum + u.totalScore, 0);
  const totalGames = activeUsers.reduce((sum, u) => sum + u.games, 0);
  const avgScore = activeUsers.reduce((sum, u) => sum + u.avgPPG, 0) / activeUsers.length;
  
  console.log('\n📈 SUMMARY STATISTICS:');
  console.log(`   Total Fantasy Users: ${sortedUsers.length}`);
  console.log(`   Active Users: ${activeUsers.length} (${(activeUsers.length/sortedUsers.length*100).toFixed(1)}%)`);
  console.log(`   Total Points Distributed: ${totalPoints.toFixed(1)}`);
  console.log(`   Total Player-Games: ${totalGames}`);
  console.log(`   Overall Average: ${avgScore.toFixed(2)} PPG`);
  console.log(`   Highest Score: ${activeUsers[0].avgPPG.toFixed(2)} PPG`);
  console.log(`   Median Score: ${activeUsers[Math.floor(activeUsers.length/2)].avgPPG.toFixed(2)} PPG`);
  console.log(`   Lowest Active Score: ${activeUsers[activeUsers.length-1].avgPPG.toFixed(2)} PPG`);
  
  console.log('\n🎯 CORRECTED SCORING SYSTEM:');
  console.log('   ✅ Individual player-games counted (not tournament matches)');
  console.log('   ✅ Realistic PPG range: 35.85 - 95.24 (vs previous 400+)');
  console.log('   ✅ Role-balanced scoring: Mid 3.8x kills, Offlane 3.0x kills');
  console.log('   ✅ Hard Support healing nerfed: ÷150 instead of ÷80');
  console.log('   ✅ No performance floor: bad play gets negative points');
  console.log('   ✅ Jest Letko same-team strategy still competitive but not dominant');
}

// Run the script
showCompleteLeaderboard();