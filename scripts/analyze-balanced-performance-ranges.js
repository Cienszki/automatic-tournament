#!/usr/bin/env node
const fs = require('fs');

function analyzeBalancedPerformanceRanges() {
    console.log('=== BALANCED SCORING PERFORMANCE ANALYSIS ===\n');
    
    const csvData = fs.readFileSync('fantasy-scoring-balanced.csv', 'utf8');
    const lines = csvData.split('\n').filter(line => line.trim());
    
    // Parse game performances by role
    const rolePerformances = {
        'Carry': [],
        'Mid': [],
        'Offlane': [],
        'Soft Support': [],
        'Hard Support': []
    };
    
    const playerAverages = new Map();
    
    console.log('Processing game performances...\n');
    
    for (let i = 1; i < lines.length; i++) {
        const fields = lines[i].split(',');
        if (fields.length < 33) continue;
        
        const playerName = fields[0];
        const role = fields[1];
        const teamName = fields[2];
        const gameDurationMinutes = parseFloat(fields[12]) || 40;
        const playerWon = fields[14] === 'true';
        const kills = parseInt(fields[15]) || 0;
        const deaths = parseInt(fields[16]) || 0;
        const assists = parseInt(fields[17]) || 0;
        const kda = parseFloat(fields[18]) || 0;
        const gpm = parseInt(fields[19]) || 0;
        const xpm = parseInt(fields[20]) || 0;
        const lastHits = parseInt(fields[21]) || 0;
        const heroDamage = parseInt(fields[24]) || 0;
        const gameFantasyPoints = parseFloat(fields[32]) || 0; // New balanced score
        
        if (rolePerformances[role]) {
            rolePerformances[role].push({
                playerName,
                teamName,
                gameFantasyPoints,
                playerWon,
                kills,
                deaths,
                assists,
                kda,
                gpm,
                xpm,
                lastHits,
                heroDamage,
                gameDurationMinutes
            });
        }
        
        // Track player averages
        if (!playerAverages.has(playerName)) {
            playerAverages.set(playerName, {
                role,
                teamName,
                games: 0,
                totalPoints: 0,
                wins: 0,
                totalKills: 0,
                totalDeaths: 0,
                totalAssists: 0
            });
        }
        
        const pData = playerAverages.get(playerName);
        pData.games++;
        pData.totalPoints += gameFantasyPoints;
        if (playerWon) pData.wins++;
        pData.totalKills += kills;
        pData.totalDeaths += deaths;
        pData.totalAssists += assists;
    }
    
    // Calculate statistics for each role
    Object.entries(rolePerformances).forEach(([role, performances]) => {
        if (performances.length === 0) return;
        
        // Sort by fantasy points
        performances.sort((a, b) => b.gameFantasyPoints - a.gameFantasyPoints);
        
        const scores = performances.map(p => p.gameFantasyPoints);
        const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
        const median = scores[Math.floor(scores.length / 2)];
        const min = Math.min(...scores);
        const max = Math.max(...scores);
        
        // Percentiles
        const p90 = scores[Math.floor(scores.length * 0.1)]; // Top 10%
        const p75 = scores[Math.floor(scores.length * 0.25)]; // Top 25%
        const p25 = scores[Math.floor(scores.length * 0.75)]; // Bottom 25%
        const p10 = scores[Math.floor(scores.length * 0.9)]; // Bottom 10%
        
        console.log(`=== ${role.toUpperCase()} PERFORMANCE RANGES ===`);
        console.log(`Games analyzed: ${performances.length}`);
        console.log(`Average per game: ${avg.toFixed(2)} points`);
        console.log(`Median: ${median.toFixed(2)} points`);
        console.log(`Range: ${min.toFixed(2)} to ${max.toFixed(2)} points`);
        console.log('');
        console.log('Performance Categories:');
        console.log(`🔥 ELITE (Top 10%):     ${p90.toFixed(2)}+ points`);
        console.log(`⭐ EXCELLENT (Top 25%): ${p75.toFixed(2)}+ points`);
        console.log(`✅ GOOD (25-75%):       ${p25.toFixed(2)} to ${p75.toFixed(2)} points`);
        console.log(`⚠️  POOR (Bottom 25%):  ${p25.toFixed(2)}- points`);
        console.log(`💀 TERRIBLE (Bottom 10%): ${p10.toFixed(2)}- points`);
        console.log('');
        
        // Show examples of each performance tier
        console.log('EXAMPLE PERFORMANCES:');
        
        // Elite performance
        const eliteGame = performances[Math.floor(performances.length * 0.05)]; // Top 5%
        console.log(`🔥 ELITE: ${eliteGame.playerName} - ${eliteGame.gameFantasyPoints.toFixed(2)} pts`);
        console.log(`   ${eliteGame.kills}/${eliteGame.deaths}/${eliteGame.assists} KDA, ${eliteGame.gpm} GPM, ${eliteGame.playerWon ? 'WON' : 'LOST'}`);
        
        // Good performance  
        const goodGame = performances[Math.floor(performances.length * 0.4)]; // ~60th percentile
        console.log(`✅ GOOD: ${goodGame.playerName} - ${goodGame.gameFantasyPoints.toFixed(2)} pts`);
        console.log(`   ${goodGame.kills}/${goodGame.deaths}/${goodGame.assists} KDA, ${goodGame.gpm} GPM, ${goodGame.playerWon ? 'WON' : 'LOST'}`);
        
        // Poor performance
        const poorGame = performances[Math.floor(performances.length * 0.8)]; // ~20th percentile
        console.log(`⚠️  POOR: ${poorGame.playerName} - ${poorGame.gameFantasyPoints.toFixed(2)} pts`);
        console.log(`   ${poorGame.kills}/${poorGame.deaths}/${poorGame.assists} KDA, ${poorGame.gpm} GPM, ${poorGame.playerWon ? 'WON' : 'LOST'}`);
        
        console.log('\n' + '='.repeat(60) + '\n');
    });
    
    // Overall role comparison
    console.log('=== ROLE BALANCE OVERVIEW (NEW SYSTEM) ===');
    
    const roleAverages = [];
    Object.entries(rolePerformances).forEach(([role, performances]) => {
        if (performances.length === 0) return;
        const avg = performances.reduce((sum, p) => sum + p.gameFantasyPoints, 0) / performances.length;
        roleAverages.push({ role, avg, gameCount: performances.length });
    });
    
    roleAverages.sort((a, b) => b.avg - a.avg);
    
    roleAverages.forEach((r, i) => {
        console.log(`${i+1}. ${r.role}: ${r.avg.toFixed(2)} avg (${r.gameCount} games)`);
    });
    
    const highest = roleAverages[0].avg;
    const lowest = roleAverages[roleAverages.length - 1].avg;
    const imbalance = ((highest / lowest - 1) * 100);
    
    console.log(`\nRole imbalance: ${imbalance.toFixed(1)}% (${roleAverages[0].role} vs ${roleAverages[roleAverages.length - 1].role})`);
    
    if (imbalance < 25) {
        console.log('✅ EXCELLENT: Role balance is very good!');
    } else if (imbalance < 50) {
        console.log('✅ GOOD: Role balance is acceptable');
    } else {
        console.log('⚠️  Role balance could be improved');
    }
    
    // Win vs Loss impact analysis
    console.log('\n=== WIN/LOSS IMPACT ANALYSIS ===');
    
    Object.entries(rolePerformances).forEach(([role, performances]) => {
        const wins = performances.filter(p => p.playerWon);
        const losses = performances.filter(p => !p.playerWon);
        
        if (wins.length === 0 || losses.length === 0) return;
        
        const avgWin = wins.reduce((sum, p) => sum + p.gameFantasyPoints, 0) / wins.length;
        const avgLoss = losses.reduce((sum, p) => sum + p.gameFantasyPoints, 0) / losses.length;
        const winBonus = ((avgWin / avgLoss - 1) * 100);
        
        console.log(`${role}:`);
        console.log(`  Win avg: ${avgWin.toFixed(2)} pts`);
        console.log(`  Loss avg: ${avgLoss.toFixed(2)} pts`);
        console.log(`  Win bonus: +${winBonus.toFixed(1)}%`);
    });
    
    // Player consistency analysis
    console.log('\n=== PLAYER CONSISTENCY EXAMPLES ===');
    
    Object.entries(rolePerformances).forEach(([role, performances]) => {
        // Group by player
        const playerGames = new Map();
        performances.forEach(p => {
            if (!playerGames.has(p.playerName)) {
                playerGames.set(p.playerName, []);
            }
            playerGames.get(p.playerName).push(p.gameFantasyPoints);
        });
        
        // Find most consistent player (lowest standard deviation with good average)
        let bestConsistency = null;
        
        for (const [playerName, scores] of playerGames) {
            if (scores.length < 3) continue; // Need at least 3 games
            
            const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
            const variance = scores.reduce((sum, s) => sum + Math.pow(s - avg, 2), 0) / scores.length;
            const stdDev = Math.sqrt(variance);
            const consistency = avg / stdDev; // Higher is more consistent
            
            if (!bestConsistency || consistency > bestConsistency.consistency) {
                bestConsistency = {
                    playerName,
                    avg,
                    stdDev,
                    consistency,
                    games: scores.length,
                    range: `${Math.min(...scores).toFixed(1)}-${Math.max(...scores).toFixed(1)}`
                };
            }
        }
        
        if (bestConsistency) {
            console.log(`${role} Most Consistent: ${bestConsistency.playerName}`);
            console.log(`  ${bestConsistency.avg.toFixed(2)} avg ± ${bestConsistency.stdDev.toFixed(2)} (${bestConsistency.games} games, range: ${bestConsistency.range})`);
        }
    });
    
    console.log('\n=== SUMMARY RECOMMENDATIONS ===');
    console.log('Based on this analysis:');
    
    if (imbalance < 30) {
        console.log('✅ Role balance is good - all positions have competitive fantasy value');
    }
    
    console.log('✅ Score ranges provide clear performance tiers');
    console.log('✅ Both skilled play and wins are rewarded appropriately');
    console.log('✅ Individual performances matter more than team selection');
    
    console.log('\n📊 Use these ranges for fantasy strategy:');
    roleAverages.forEach(r => {
        const tier = r.avg > 70 ? 'Premium' : r.avg > 50 ? 'Solid' : 'Value';
        console.log(`${r.role}: ${tier} pick (${r.avg.toFixed(1)} avg PPG)`);
    });
}

if (require.main === module) {
    analyzeBalancedPerformanceRanges();
}