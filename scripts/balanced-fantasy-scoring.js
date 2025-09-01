#!/usr/bin/env node
const fs = require('fs');

/**
 * BALANCED FANTASY SCORING SYSTEM
 * 
 * DESIGN GOALS:
 * 1. Reduce role imbalance (Hard Supports way too strong)
 * 2. Boost individual performance over team wins
 * 3. Add core bonuses (Mid/Carry/Offlane need buffs)
 * 4. Cap assist spam but reward good support play
 * 5. Promote skill-based scoring over lucky team picks
 */

function calculateBalancedFantasyPoints(gameData, gameDurationMinutes) {
    let points = 0;
    
    const { 
        role, kills, deaths, assists, gpm, xpm, lastHits, 
        heroDamage, towerDamage, heroHealing, 
        obsPlaced, senPlaced, playerWon,
        firstBloodClaimed, courierKills, observerKills, sentryKills
    } = gameData;
    
    // === REDUCED WIN BONUS (was 15, now 8) ===
    // This was the biggest problem - same-team lineups got 5x15=75 points just for team winning
    if (playerWon) points += 8;
    
    // === INDIVIDUAL SKILL BONUSES (NEW) ===
    // First Blood bonus (skill-based)
    if (firstBloodClaimed) points += 12; // Increased from 10
    
    // Objective contributions
    points += Math.min(towerDamage / 1000, 12); // Reduced cap from 15 to 12
    points += (observerKills || 0) * 2.5; // Increased from 2
    points += (courierKills || 0) * 10; // Increased from 8
    
    // Hero damage per minute (skill indicator)
    const heroDamagePerMin = heroDamage / gameDurationMinutes;
    if (heroDamagePerMin > 300) {
        points += Math.min((heroDamagePerMin - 300) / 150, 12); // Max 12 bonus
    }
    
    // REDUCED death penalties for all roles (was -1.5, now -1.0)
    const deathPenalty = Math.min(deaths * -1.0, -10); // Cap at -10
    points += deathPenalty;
    
    // === BALANCED ROLE-SPECIFIC SCORING ===
    
    if (role === 'Carry') {
        // BUFFED CARRY SCORING
        points += kills * 2.8; // Increased from 2.2
        points += assists * 1.2; // Increased from 0.8
        
        // Enhanced farming rewards
        const farmEfficiency = Math.min((gpm - 350) / 40, 12); // Increased max from 8 to 12
        points += Math.max(farmEfficiency, 0);
        
        // Last hit mastery bonus (NEW)
        const lastHitBonus = Math.min(lastHits / gameDurationMinutes / 6, 10); // Increased max
        points += lastHitBonus;
        
        // Late game scaling bonus (NEW)
        if (gameDurationMinutes > 35 && gpm > 500) {
            points += 8; // Reward late-game carries
        }
        
    } else if (role === 'Mid') {
        // BUFFED MID SCORING
        points += kills * 2.8; // Increased from 2.3
        points += assists * 1.5; // Increased from 1.2
        
        // Enhanced XP advantage bonus
        const xpmBonus = Math.min((xpm - 450) / 50, 12); // Increased max from 8 to 12
        points += Math.max(xpmBonus, 0);
        
        // Hero damage leadership bonus (NEW)
        points += Math.min(heroDamagePerMin / 150, 10); // Increased from /200 to /150
        
        // Mid dominance bonus (NEW)
        if (kills >= 8 && heroDamagePerMin > 500) {
            points += 10; // Reward dominant mid performances
        }
        
    } else if (role === 'Offlane') {
        // BUFFED OFFLANE SCORING
        points += kills * 2.5; // Increased from 2.0
        points += assists * 2.2; // Reduced from 2.5 but still strong
        
        // Enhanced teamfight participation
        const participationRate = (kills + assists) / Math.max((kills + assists + deaths), 1);
        points += participationRate * 12; // Increased from 8
        
        // Space creation bonus (NEW)
        if (deaths <= 6 && (kills + assists) >= 10) {
            points += 8; // Reward effective space creation
        }
        
        // Durability bonus (ENHANCED)
        if (deaths <= 4 && (kills + assists) >= 8) {
            points += 8; // Increased from 5
        }
        
    } else if (role === 'Soft Support') {
        // NERFED SOFT SUPPORT (was too strong)
        points += kills * 1.4; // Increased from 1.2
        points += Math.min(assists * 2.0, 35); // REDUCED from 2.5 and cap from 50 to 35
        
        // Vision game
        points += (obsPlaced || 0) * 1.8; // Increased from 1.5
        points += (senPlaced || 0) * 1.4; // Increased from 1.2
        
        // Support impact bonus (NEW)
        if ((obsPlaced + senPlaced) >= 12 && assists >= 15) {
            points += 6; // Reward high-impact support play
        }
        
    } else if (role === 'Hard Support') {
        // HEAVILY NERFED HARD SUPPORT (was way too strong)
        points += kills * 1.2; // Increased from 1.0
        points += Math.min(assists * 2.2, 40); // REDUCED from 3.0 and cap from 60 to 40
        
        // Enhanced support activity
        points += (obsPlaced || 0) * 2.2; // Increased from 2.0
        points += (senPlaced || 0) * 2.0; // Increased from 1.8
        points += (heroHealing || 0) / 80; // Increased from /100
        
        // Sacrifice bonus (supports can die for team)
        if (deaths >= 8 && assists >= 18) {
            points += 6; // Increased from 5
        }
        
        // Vision mastery bonus (NEW)
        if ((obsPlaced + senPlaced) >= 15) {
            points += 8; // Reward exceptional vision control
        }
        
    } else {
        // Unknown role - balanced defaults
        points += kills * 2.0;
        points += assists * 1.8;
    }
    
    // === GAME DURATION NORMALIZATION ===
    const durationMultiplier = Math.min(gameDurationMinutes / 40, 1.4); // Reduced from 1.5
    points = points / durationMultiplier;
    
    // === PERFORMANCE FLOOR ===
    points = Math.max(points, -8); // Increased from -10 (less harsh)
    
    // === INDIVIDUAL EXCELLENCE BONUSES (NEW) ===
    // KDA excellence bonus
    const kda = deaths > 0 ? (kills + assists) / deaths : (kills + assists);
    if (kda >= 8) {
        points += Math.min((kda - 8) * 2, 15); // Max 15 bonus for exceptional KDA
    }
    
    // Multi-stat excellence (NEW)
    let excellenceCount = 0;
    if (kills >= 12) excellenceCount++;
    if (assists >= 20) excellenceCount++;
    if (gpm >= 600) excellenceCount++;
    if (heroDamagePerMin >= 600) excellenceCount++;
    if (lastHits >= gameDurationMinutes * 8) excellenceCount++;
    
    if (excellenceCount >= 3) {
        points += 12; // Reward multi-dimensional excellence
    }
    
    return Math.round(points * 100) / 100;
}

function recalculateAllFantasyScores() {
    console.log('=== BALANCED FANTASY SCORING RECALCULATION ===\n');
    
    const csvData = fs.readFileSync('fantasy-scoring-unified.csv', 'utf8');
    const lines = csvData.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',');
    
    console.log('Processing player performances...');
    
    const newScores = [];
    const playerTotals = new Map();
    
    // Process each game performance
    for (let i = 1; i < lines.length; i++) {
        const fields = lines[i].split(',');
        if (fields.length < 20) continue;
        
        const playerName = fields[0];
        const role = fields[1];
        const teamName = fields[2];
        const gameDurationMinutes = parseFloat(fields[12]) || 40;
        const playerWon = fields[14] === 'true';
        const kills = parseInt(fields[15]) || 0;
        const deaths = parseInt(fields[16]) || 0;
        const assists = parseInt(fields[17]) || 0;
        const gpm = parseInt(fields[19]) || 0;
        const xpm = parseInt(fields[20]) || 0;
        const lastHits = parseInt(fields[21]) || 0;
        const heroDamage = parseInt(fields[24]) || 0;
        const towerDamage = parseInt(fields[25]) || 0;
        const heroHealing = parseInt(fields[26]) || 0;
        const obsPlaced = parseInt(fields[27]) || 0;
        const senPlaced = parseInt(fields[28]) || 0;
        const firstBloodClaimed = fields[29] === 'true';
        const courierKills = parseInt(fields[30]) || 0;
        const observerKills = parseInt(fields[31]) || 0;
        const sentryKills = parseInt(fields[32]) || 0;
        
        const gameData = {
            role, kills, deaths, assists, gpm, xpm, lastHits,
            heroDamage, towerDamage, heroHealing, obsPlaced, senPlaced,
            playerWon, firstBloodClaimed, courierKills, observerKills, sentryKills
        };
        
        const newFantasyPoints = calculateBalancedFantasyPoints(gameData, gameDurationMinutes);
        
        // Build new CSV line with recalculated score
        const newLine = [...fields];
        newLine[32] = newFantasyPoints.toFixed(2); // Replace game fantasy points
        newScores.push(newLine);
        
        // Track player totals
        if (!playerTotals.has(playerName)) {
            playerTotals.set(playerName, { 
                role, teamName, totalPoints: 0, games: 0, 
                totalKills: 0, totalDeaths: 0, totalAssists: 0 
            });
        }
        
        const pData = playerTotals.get(playerName);
        pData.totalPoints += newFantasyPoints;
        pData.games++;
        pData.totalKills += kills;
        pData.totalDeaths += deaths;
        pData.totalAssists += assists;
    }
    
    // Update total points and PPG for each player row
    for (let i = 0; i < newScores.length; i++) {
        const playerName = newScores[i][0];
        const pData = playerTotals.get(playerName);
        
        newScores[i][7] = pData.totalPoints.toFixed(2); // Total fantasy points
        newScores[i][8] = (pData.totalPoints / pData.games).toFixed(2); // PPG
    }
    
    // Write new CSV
    const newCsvContent = [headers.join(','), ...newScores.map(line => line.join(','))].join('\n');
    fs.writeFileSync('fantasy-scoring-balanced.csv', newCsvContent);
    
    console.log('✅ Created fantasy-scoring-balanced.csv\n');
    
    // Analysis of new scores
    console.log('=== NEW BALANCED SCORING ANALYSIS ===');
    
    const roleStats = new Map();
    for (const [playerName, pData] of playerTotals) {
        if (!roleStats.has(pData.role)) {
            roleStats.set(pData.role, { totalPPG: 0, count: 0, players: [] });
        }
        
        const ppg = pData.totalPoints / pData.games;
        roleStats.get(pData.role).totalPPG += ppg;
        roleStats.get(pData.role).count++;
        roleStats.get(pData.role).players.push({ playerName, ppg, teamName: pData.teamName });
    }
    
    console.log('NEW ROLE AVERAGES:');
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
    
    console.log('\nTOP PERFORMERS IN NEW SYSTEM:');
    Object.entries(Object.fromEntries(roleStats)).forEach(([role, stats]) => {
        console.log(`\n${role} (top 3):`);
        stats.players
            .sort((a, b) => b.ppg - a.ppg)
            .slice(0, 3)
            .forEach((p, i) => {
                console.log(`  ${i+1}. ${p.playerName} (${p.teamName}): ${p.ppg.toFixed(2)} PPG`);
            });
    });
    
    console.log('\n=== COMPARISON TO OLD SYSTEM ===');
    console.log('Role balance improvements:');
    
    // Compare to old averages
    const oldAverages = {
        'Hard Support': 110.08,
        'Soft Support': 59.82,
        'Carry': 43.59,
        'Mid': 42.49,
        'Offlane': 45.23
    };
    
    sortedRoles.forEach(r => {
        const oldAvg = oldAverages[r.role] || 0;
        const change = ((r.avgPPG - oldAvg) / oldAvg * 100);
        const changeStr = change > 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`;
        console.log(`${r.role}: ${oldAvg.toFixed(2)} → ${r.avgPPG.toFixed(2)} (${changeStr})`);
    });
    
    console.log('\n✅ Balanced scoring system implemented!');
    console.log('📁 Results saved to: fantasy-scoring-balanced.csv');
}

if (require.main === module) {
    recalculateAllFantasyScores();
}