#!/usr/bin/env node
const fs = require('fs');

function analyzeScorePatterns() {
    console.log('=== FANTASY SCORING PATTERN ANALYSIS ===\n');
    
    const csvData = fs.readFileSync('fantasy-scoring-unified.csv', 'utf8');
    const lines = csvData.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',');
    
    const playerStats = new Map();
    const roleStats = new Map();
    const teamStats = new Map();
    
    // Parse each line
    for (let i = 1; i < lines.length; i++) {
        const fields = lines[i].split(',');
        if (fields.length < 9) continue;
        
        const playerName = fields[0];
        const role = fields[1];
        const teamName = fields[2];
        const totalPoints = parseFloat(fields[7]) || 0;
        const ppg = parseFloat(fields[8]) || 0;
        const playerWon = fields[14] === 'true';
        const kills = parseInt(fields[15]) || 0;
        const deaths = parseInt(fields[16]) || 0;
        const assists = parseInt(fields[17]) || 0;
        const gamePoints = parseFloat(fields[32]) || 0;
        
        // Aggregate by player
        if (!playerStats.has(playerName)) {
            playerStats.set(playerName, {
                role, teamName, totalPoints, ppg,
                games: 0, wins: 0, totalGamePoints: 0,
                totalKills: 0, totalDeaths: 0, totalAssists: 0
            });
        }
        
        const pStats = playerStats.get(playerName);
        pStats.games++;
        if (playerWon) pStats.wins++;
        pStats.totalGamePoints += gamePoints;
        pStats.totalKills += kills;
        pStats.totalDeaths += deaths;
        pStats.totalAssists += assists;
        
        // Aggregate by role
        if (!roleStats.has(role)) {
            roleStats.set(role, { players: [], totalPPG: 0, count: 0 });
        }
        if (!roleStats.get(role).players.includes(playerName)) {
            roleStats.get(role).players.push(playerName);
            roleStats.get(role).totalPPG += ppg;
            roleStats.get(role).count++;
        }
        
        // Aggregate by team
        if (!teamStats.has(teamName)) {
            teamStats.set(teamName, { players: new Set(), totalPPG: 0, wins: 0, games: 0 });
        }
        teamStats.get(teamName).players.add(playerName);
        if (playerWon) teamStats.get(teamName).wins++;
        teamStats.get(teamName).games++;
    }
    
    // Calculate team win rates
    for (const [teamName, stats] of teamStats) {
        stats.winRate = stats.games > 0 ? (stats.wins / stats.games * 100) : 0;
        stats.avgPPG = 0;
        for (const playerName of stats.players) {
            if (playerStats.has(playerName)) {
                stats.avgPPG += playerStats.get(playerName).ppg;
            }
        }
        stats.avgPPG /= stats.players.size;
    }
    
    console.log('=== ROLE PERFORMANCE ANALYSIS ===');
    const sortedRoles = Array.from(roleStats.entries())
        .map(([role, stats]) => ({
            role,
            avgPPG: stats.totalPPG / stats.count,
            playerCount: stats.count
        }))
        .sort((a, b) => b.avgPPG - a.avgPPG);
    
    sortedRoles.forEach(r => {
        console.log(`${r.role}: ${r.avgPPG.toFixed(2)} avg PPG (${r.playerCount} players)`);
    });
    
    console.log('\n=== TOP PERFORMERS BY ROLE ===');
    const roleGroups = {};
    for (const [playerName, stats] of playerStats) {
        if (!roleGroups[stats.role]) roleGroups[stats.role] = [];
        roleGroups[stats.role].push({ playerName, ...stats });
    }
    
    Object.keys(roleGroups).forEach(role => {
        console.log(`\n${role} (top 5):`);
        roleGroups[role]
            .sort((a, b) => b.ppg - a.ppg)
            .slice(0, 5)
            .forEach((p, i) => {
                const winRate = p.games > 0 ? (p.wins / p.games * 100).toFixed(1) : '0.0';
                console.log(`  ${i+1}. ${p.playerName} (${p.teamName}): ${p.ppg.toFixed(2)} PPG, ${winRate}% WR`);
            });
    });
    
    console.log('\n=== TEAM PERFORMANCE ANALYSIS ===');
    const sortedTeams = Array.from(teamStats.entries())
        .map(([teamName, stats]) => ({ teamName, ...stats }))
        .sort((a, b) => b.winRate - a.winRate);
    
    console.log('Top teams by win rate:');
    sortedTeams.slice(0, 10).forEach((t, i) => {
        console.log(`  ${i+1}. ${t.teamName}: ${t.winRate.toFixed(1)}% WR, ${t.avgPPG.toFixed(2)} avg PPG`);
    });
    
    console.log('\n=== WIN IMPACT ANALYSIS ===');
    const winners = [];
    const losers = [];
    
    for (const [playerName, stats] of playerStats) {
        const winRate = stats.games > 0 ? (stats.wins / stats.games) : 0;
        if (winRate >= 0.7) {
            winners.push({ playerName, winRate: winRate * 100, ppg: stats.ppg, role: stats.role });
        } else if (winRate <= 0.3) {
            losers.push({ playerName, winRate: winRate * 100, ppg: stats.ppg, role: stats.role });
        }
    }
    
    console.log('High win rate players (70%+):');
    winners.sort((a, b) => b.ppg - a.ppg).slice(0, 10).forEach(p => {
        console.log(`  ${p.playerName} (${p.role}): ${p.ppg.toFixed(2)} PPG, ${p.winRate.toFixed(1)}% WR`);
    });
    
    console.log('\nLow win rate players (30%-):');
    losers.sort((a, b) => b.ppg - a.ppg).slice(0, 10).forEach(p => {
        console.log(`  ${p.playerName} (${p.role}): ${p.ppg.toFixed(2)} PPG, ${p.winRate.toFixed(1)}% WR`);
    });
    
    console.log('\n=== SCORING IMBALANCE SUMMARY ===');
    const hardSupports = roleGroups['Hard Support'] || [];
    const carries = roleGroups['Carry'] || [];
    const mids = roleGroups['Mid'] || [];
    
    const hsAvg = hardSupports.reduce((sum, p) => sum + p.ppg, 0) / hardSupports.length || 0;
    const carryAvg = carries.reduce((sum, p) => sum + p.ppg, 0) / carries.length || 0;
    const midAvg = mids.reduce((sum, p) => sum + p.ppg, 0) / mids.length || 0;
    
    console.log(`Hard Support average: ${hsAvg.toFixed(2)} PPG`);
    console.log(`Carry average: ${carryAvg.toFixed(2)} PPG`);
    console.log(`Mid average: ${midAvg.toFixed(2)} PPG`);
    console.log(`Hard Support advantage: ${((hsAvg / carryAvg - 1) * 100).toFixed(1)}% over Carry`);
    console.log(`Hard Support advantage: ${((hsAvg / midAvg - 1) * 100).toFixed(1)}% over Mid`);
}

if (require.main === module) {
    analyzeScorePatterns();
}