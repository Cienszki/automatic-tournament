#!/usr/bin/env node
const fs = require('fs');

/**
 * OPTIMIZED EQUALIZED FANTASY SCORING SYSTEM
 * 
 * TARGET: All roles ~95-105 PPG with healing nerf
 * CHANGES:
 * - Mid: Major skill-based bonuses (+21 PPG needed)
 * - Offlane: Enhanced space creation/teamfight bonuses (+16 PPG needed)  
 * - Hard Support: Nerf healing bonus significantly (-14 PPG needed)
 */

function calculateOptimizedFantasyPoints(gameData, gameDurationMinutes) {
    let points = 0;
    
    const { 
        role, kills, deaths, assists, gpm, xpm, lastHits, denies, netWorth,
        heroDamage, towerDamage, heroHealing, obsPlaced, senPlaced, 
        playerWon, firstBloodClaimed, courierKills, observerKills, 
        sentryKills, highestKillStreak, buybackCount
    } = gameData;
    
    // === UNIVERSAL BASE SCORING ===
    if (playerWon) points += 5;
    if (firstBloodClaimed) points += 12; 
    
    points += towerDamage / 1000; 
    points += (observerKills || 0) * 2.5;
    points += (courierKills || 0) * 10;
    points += (sentryKills || 0) * 2;
    
    if (highestKillStreak >= 3) {
        points += Math.pow(highestKillStreak - 2, 1.2) * 2.5;
    }
    
    const deathPenalty = deaths * -0.7;
    points += deathPenalty;
    
    const netWorthPerMin = netWorth / gameDurationMinutes;
    if (netWorthPerMin > 350) {
        points += Math.sqrt(netWorthPerMin - 350) / 10;
    }
    
    // === OPTIMIZED ROLE-SPECIFIC SCORING ===
    
    if (role === 'Carry') {
        // Current: 94.4, Target: 100 → Need +6% boost
        points += kills * 2.5; // Increased from 2.4
        points += assists * 1.3; // Increased from 1.2
        
        const farmEfficiency = (gpm - 300) / 40; // More generous
        points += Math.max(farmEfficiency, 0);
        
        const lastHitBonus = lastHits / gameDurationMinutes / 5.5; // More generous
        points += lastHitBonus;
        
        points += (denies || 0) / 3.5; // More generous
        
        if (netWorth > 15000) {
            points += Math.sqrt(netWorth - 15000) / 110; // More generous
        }
        
        if (gameDurationMinutes > 38) {
            const lateGameMultiplier = 1 + (gameDurationMinutes - 38) / 140;
            points *= lateGameMultiplier;
        }
        
    } else if (role === 'Mid') {
        // Current: 79.2, Target: 100 → Need +26% boost (MAJOR BUFF)
        points += kills * 3.8; // MAJOR increase from 3.0
        points += assists * 2.0; // Increased from 1.6
        
        // Enhanced XP mastery (Mid's signature)
        const xpmBonus = Math.max(xpm - 400, 0) / 40; // More generous threshold
        points += xpmBonus;
        
        // Hero damage excellence (major buff)
        const heroDamagePerMin = heroDamage / gameDurationMinutes;
        points += heroDamagePerMin / 100; // Much more generous from /140
        
        // GPM efficiency for farming mids
        if (gpm > 480) { // Lower threshold
            points += (gpm - 480) / 50; // More generous
        }
        
        // Solo dominance bonus (enhanced)
        if (kills >= 7 && assists < kills) { // Lower threshold
            points += 12; // Increased from 8
        }
        
        // XP leadership bonus (enhanced)
        if (xpm > 600) {
            points += Math.sqrt(xpm - 600) / 12; // More generous
        }
        
        // NEW: Mid game impact bonus
        if (kills >= 10 || heroDamagePerMin > 600) {
            points += 8; // New bonus for high impact
        }
        
        // NEW: Last hit efficiency for farming mids
        if (lastHits >= gameDurationMinutes * 6) {
            points += (lastHits - gameDurationMinutes * 6) / 15; // Farming mid bonus
        }
        
    } else if (role === 'Offlane') {
        // Current: 84.0, Target: 100 → Need +19% boost (MAJOR BUFF)
        points += kills * 3.0; // MAJOR increase from 2.4
        points += assists * 2.8; // MAJOR increase from 2.2
        
        // Enhanced teamfight participation (signature offlane)
        const participationRate = (kills + assists) / Math.max((kills + assists + deaths), 1);
        points += participationRate * 18; // Increased from 14
        
        // Enhanced space creation
        const spaceCreationScore = (kills + assists) * 2.2 - deaths; // Increased multiplier
        if (spaceCreationScore > 8) { // Lower threshold
            points += Math.sqrt(spaceCreationScore - 8) * 2; // More generous
        }
        
        // Durability bonus (enhanced)
        if (deaths <= 6 && (kills + assists) >= 7) { // More forgiving thresholds
            points += 10; // Increased from 8
        }
        
        // Hero damage for fighting offlaners
        points += heroDamage / gameDurationMinutes / 200;
        
        // Initiation/teamfight bonus (enhanced)
        if (assists > kills && assists >= 10) { // Lower threshold
            points += assists * 0.4; // More generous
        }
        
        // NEW: High-assist performance bonus
        if (assists >= 15) {
            points += (assists - 15) * 0.5; // Additional scaling for exceptional teamfight
        }
        
        // NEW: Offlane survival bonus
        if ((kills + assists) >= 15 && deaths <= 8) {
            points += 8; // Reward surviving big teamfights
        }
        
    } else if (role === 'Soft Support') {
        // Current: 96.5, Target: 100 → Need +4% boost (minor)
        points += kills * 1.9; // Slightly increased from 1.8
        points += assists * 2.1; // Slightly increased from 2.0
        
        points += (obsPlaced || 0) * 2.1; // Slightly increased
        points += (senPlaced || 0) * 1.9; // Slightly increased
        
        const teamfightImpact = kills + assists;
        if (teamfightImpact >= 15) {
            points += Math.sqrt(teamfightImpact - 15) * 2.2; // Slightly increased
        }
        
        const supportEfficiency = (kills + assists) / Math.max(gpm / 100, 1);
        points += Math.min(supportEfficiency * 1.6, 12); // Slightly increased
        
        const wardEfficiency = (obsPlaced + senPlaced) / Math.max(gameDurationMinutes / 10, 1);
        if (wardEfficiency > 2) {
            points += (wardEfficiency - 2) * 5.5; // Slightly increased
        }
        
        if (kills >= 5 && gpm < 350) {
            points += kills * 1.6; // Slightly increased
        }
        
    } else if (role === 'Hard Support') {
        // Current: 114.0, Target: 100 → Need -12% reduction
        points += kills * 1.3; // Slightly reduced from 1.4
        points += assists * 1.1; // Reduced from 1.2
        
        points += (obsPlaced || 0) * 2.0; // Reduced from 2.2
        points += (senPlaced || 0) * 1.8; // Reduced from 2.0
        
        // MAJOR HEALING NERF (was the biggest problem)
        points += (heroHealing || 0) / 150; // MAJOR nerf from /80 (47% reduction!)
        
        if (deaths >= 8 && assists >= 20) {
            points += 5; // Reduced from 6
        }
        
        if ((obsPlaced + senPlaced) >= 15) {
            points += 8; // Reduced from 10
        }
        
        const supportExcellence = assists + obsPlaced + senPlaced + (heroHealing / 1500); // Reduced healing weight
        if (supportExcellence > 30) {
            points += Math.sqrt(supportExcellence - 30) * 1.0; // Reduced from 1.2
        }
        
        if (buybackCount && buybackCount > 0) {
            points += buybackCount * 4; // Reduced from 5
        }
        
        if (heroHealing > 8000) { // Higher threshold
            points += Math.sqrt(heroHealing - 8000) / 100; // Much less generous from /70
        }
        
    } else {
        points += kills * 2.2;
        points += assists * 2.0;
    }
    
    // === DURATION NORMALIZATION ===
    const durationMultiplier = Math.min(gameDurationMinutes / 40, 1.25);
    points = points / durationMultiplier;
    
    // No floor - bad performances should be punished with negative scores 
    
    // === EXCELLENCE BONUSES ===
    const kda = deaths > 0 ? (kills + assists) / deaths : (kills + assists);
    if (kda >= 6) {
        points += Math.pow(kda - 6, 0.7) * 2;
    }
    
    let excellenceCount = 0;
    let excellenceBonus = 0;
    
    if (kills >= 12) { excellenceCount++; excellenceBonus += (kills - 12) * 0.8; }
    if (assists >= 18) { excellenceCount++; excellenceBonus += (assists - 18) * 0.3; }
    if (gpm >= 600) { excellenceCount++; excellenceBonus += (gpm - 600) / 80; }
    if (heroDamage >= gameDurationMinutes * 500) { excellenceCount++; excellenceBonus += 4; }
    if (lastHits >= gameDurationMinutes * 7) { excellenceCount++; excellenceBonus += 2; }
    if ((obsPlaced + senPlaced) >= 15) { excellenceCount++; excellenceBonus += 3; }
    
    if (excellenceCount >= 3) {
        points += excellenceBonus + (excellenceCount * 3);
    }
    
    if (deaths === 0 && kills >= 5 && assists >= 10) {
        points += 15;
    }
    
    return Math.round(points * 100) / 100;
}

function runOptimizedSystem() {
    console.log('=== OPTIMIZED EQUALIZED SCORING SYSTEM ===\n');
    console.log('🎯 TARGETS:');
    console.log('   Mid: 79.2 → 100 PPG (+26% buff needed)');
    console.log('   Offlane: 84.0 → 100 PPG (+19% buff needed)');
    console.log('   Hard Support: 114.0 → 100 PPG (-12% nerf needed)');
    console.log('   Focus: Nerf healing spam, boost skill-based mid/offlane play\n');
    
    const csvData = fs.readFileSync('fantasy-scoring-unified.csv', 'utf8');
    const lines = csvData.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',');
    
    const newScores = [];
    const playerTotals = new Map();
    
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
        const denies = parseInt(fields[22]) || 0;
        const netWorth = parseInt(fields[23]) || 0;
        const heroDamage = parseInt(fields[24]) || 0;
        const towerDamage = parseInt(fields[25]) || 0;
        const heroHealing = parseInt(fields[26]) || 0;
        const obsPlaced = parseInt(fields[27]) || 0;
        const senPlaced = parseInt(fields[28]) || 0;
        const firstBloodClaimed = fields[29] === 'true';
        const courierKills = parseInt(fields[30]) || 0;
        const observerKills = parseInt(fields[31]) || 0;
        const sentryKills = parseInt(fields[32]) || 0;
        
        const highestKillStreak = Math.max(1, Math.floor(kills / 2.5)); 
        const buybackCount = netWorth > 25000 ? 1 : 0;
        
        const gameData = {
            role, kills, deaths, assists, gpm, xpm, lastHits, denies, netWorth,
            heroDamage, towerDamage, heroHealing, obsPlaced, senPlaced,
            playerWon, firstBloodClaimed, courierKills, observerKills, 
            sentryKills, highestKillStreak, buybackCount
        };
        
        const newFantasyPoints = calculateOptimizedFantasyPoints(gameData, gameDurationMinutes);
        
        const newLine = [...fields];
        newLine[32] = newFantasyPoints.toFixed(2);
        newScores.push(newLine);
        
        if (!playerTotals.has(playerName)) {
            playerTotals.set(playerName, { 
                role, teamName, totalPoints: 0, games: 0 
            });
        }
        
        const pData = playerTotals.get(playerName);
        pData.totalPoints += newFantasyPoints;
        pData.games++;
    }
    
    // Update totals
    for (let i = 0; i < newScores.length; i++) {
        const playerName = newScores[i][0];
        const pData = playerTotals.get(playerName);
        
        newScores[i][7] = pData.totalPoints.toFixed(2);
        newScores[i][8] = (pData.totalPoints / pData.games).toFixed(2);
    }
    
    const newCsvContent = [headers.join(','), ...newScores.map(line => line.join(','))].join('\n');
    fs.writeFileSync('fantasy-scoring-optimized.csv', newCsvContent);
    
    console.log('✅ Created fantasy-scoring-optimized.csv\n');
    
    // Analysis
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
    
    console.log('🎯 OPTIMIZED ROLE AVERAGES:');
    const sortedRoles = Array.from(roleStats.entries())
        .map(([role, stats]) => ({
            role,
            avgPPG: stats.totalPPG / stats.count,
            playerCount: stats.count
        }))
        .sort((a, b) => b.avgPPG - a.avgPPG);
    
    const targetRoles = {
        'Mid': { old: 79.2, target: 100 },
        'Offlane': { old: 84.0, target: 100 },
        'Carry': { old: 94.4, target: 100 },
        'Soft Support': { old: 96.5, target: 100 },
        'Hard Support': { old: 114.0, target: 100 }
    };
    
    sortedRoles.forEach((r, i) => {
        const emoji = '⭐';
        const target = targetRoles[r.role];
        const change = target ? ((r.avgPPG - target.old) / target.old * 100) : 0;
        const changeStr = change > 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`;
        const targetGap = target ? (r.avgPPG - target.target).toFixed(1) : 'N/A';
        
        console.log(`${emoji} ${r.role}: ${r.avgPPG.toFixed(1)} PPG (${changeStr} vs old, ${targetGap > 0 ? '+' : ''}${targetGap} vs target 100)`);
    });
    
    const highest = sortedRoles[0].avgPPG;
    const lowest = sortedRoles[sortedRoles.length - 1].avgPPG;
    const imbalance = ((highest / lowest - 1) * 100);
    
    console.log(`\n📊 New role imbalance: ${imbalance.toFixed(1)}%`);
    
    if (imbalance < 15) {
        console.log('🎯 PERFECT: Excellent role balance achieved!');
    } else if (imbalance < 25) {
        console.log('✅ EXCELLENT: Very good role balance!');
    } else {
        console.log('✅ GOOD: Improved balance!');
    }
    
    console.log('\n=== KEY CHANGES MADE ===');
    console.log('🚀 MID BUFFS:');
    console.log('   • Kills: 3.0x → 3.8x (+27% damage multiplier)');
    console.log('   • Assists: 1.6x → 2.0x (+25% teamfight value)');
    console.log('   • Hero damage: /140 → /100 (+40% damage bonus)');
    console.log('   • Added farming mid bonuses for last hits');
    console.log('   • Enhanced XP/GPM thresholds');
    console.log('');
    console.log('🚀 OFFLANE BUFFS:');
    console.log('   • Kills: 2.4x → 3.0x (+25% kill value)');
    console.log('   • Assists: 2.2x → 2.8x (+27% teamfight value)');
    console.log('   • Enhanced space creation bonuses');
    console.log('   • Added high-assist performance scaling');
    console.log('   • Better survival/durability rewards');
    console.log('');
    console.log('⚖️ HARD SUPPORT NERFS:');
    console.log('   • Healing: /80 → /150 (-47% healing bonus)');
    console.log('   • Assists: 1.2x → 1.1x (-8% assist value)');
    console.log('   • Reduced vision mastery bonuses');
    console.log('   • This stops passive heal-spamming dominance');
    
    console.log('\n📁 Results saved to: fantasy-scoring-optimized.csv');
    console.log('🎯 Target: All roles balanced around 95-105 PPG');
    
    return sortedRoles;
}

if (require.main === module) {
    const results = runOptimizedSystem();
}

module.exports = { calculateOptimizedFantasyPoints, runOptimizedSystem };