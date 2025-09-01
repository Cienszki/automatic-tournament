#!/usr/bin/env node
const fs = require('fs');

/**
 * EQUALIZED FANTASY SCORING SYSTEM V2
 * 
 * DESIGN GOALS:
 * 1. All roles should have similar average PPG (target: ~75 PPG)
 * 2. Remove unnecessary caps that limit high-skill performances
 * 3. Add stat-based bonuses for each role using available database fields
 * 4. Reward individual excellence across all statistical categories
 * 5. Maintain skill-based differentiation while equalizing role averages
 */

function calculateEqualizedFantasyPoints(gameData, gameDurationMinutes) {
    let points = 0;
    
    const { 
        role, kills, deaths, assists, gpm, xpm, lastHits, denies, netWorth,
        heroDamage, towerDamage, heroHealing, obsPlaced, senPlaced, 
        playerWon, firstBloodClaimed, courierKills, observerKills, 
        sentryKills, highestKillStreak, buybackCount
    } = gameData;
    
    // === UNIVERSAL BASE SCORING (All Roles) ===
    
    // Win bonus (reduced further to minimize same-team advantage)
    if (playerWon) points += 6; // Reduced from 8
    
    // Individual skill bonuses
    if (firstBloodClaimed) points += 15; // Increased from 12 - pure skill
    
    // Objective contributions (uncapped for elite performances)
    points += towerDamage / 800; // Removed cap, slightly more generous
    points += (observerKills || 0) * 3; // Increased from 2.5
    points += (courierKills || 0) * 12; // Increased from 10
    points += (sentryKills || 0) * 2.5; // New bonus for dewarding
    
    // Kill streak bonuses (reward exceptional plays)
    if (highestKillStreak >= 3) {
        points += Math.pow(highestKillStreak - 2, 1.3) * 3; // Exponential scaling, no cap
    }
    
    // Death penalty (less harsh, consistent across roles)
    const deathPenalty = deaths * -0.8; // Reduced from -1.0
    points += deathPenalty;
    
    // Net Worth efficiency (rewards smart itemization across all roles)
    const netWorthPerMin = netWorth / gameDurationMinutes;
    if (netWorthPerMin > 300) {
        points += Math.sqrt(netWorthPerMin - 300) / 8; // Diminishing returns, no cap
    }
    
    // === ROLE-SPECIFIC SCORING (EQUALIZED TO ~75 PPG TARGET) ===
    
    if (role === 'Carry') {
        // TARGET: Boost from ~75 to ~75 (already good with previous changes)
        points += kills * 2.8;
        points += assists * 1.4; // Increased from 1.2
        
        // Enhanced farming bonuses (Carries should excel here)
        const farmEfficiency = (gpm - 300) / 35; // More generous scaling
        points += Math.max(farmEfficiency, 0); // No cap - reward exceptional farming
        
        // Last hit mastery (uncapped for pros)
        const lastHitBonus = lastHits / gameDurationMinutes / 5; // More generous
        points += lastHitBonus; // No cap
        
        // Deny efficiency (new bonus)
        points += (denies || 0) / 3; // Reward lane dominance
        
        // Net worth leadership bonus
        if (netWorth > 15000) {
            points += Math.sqrt(netWorth - 15000) / 100; // Scale with net worth
        }
        
        // Late game impact
        if (gameDurationMinutes > 35) {
            const lateGameMultiplier = 1 + (gameDurationMinutes - 35) / 100; // Up to 1.25x for 60min games
            points *= lateGameMultiplier;
        }
        
    } else if (role === 'Mid') {
        // TARGET: Boost from ~65 to ~75 PPG
        points += kills * 3.2; // Increased from 2.8 - Mids need more kill value
        points += assists * 1.8; // Increased from 1.5
        
        // Enhanced XP advantage (Mid's signature stat)
        const xpmBonus = Math.max(xpm - 400, 0) / 40; // More generous, no cap
        points += xpmBonus;
        
        // Hero damage excellence (uncapped)
        const heroDamagePerMin = heroDamage / gameDurationMinutes;
        points += heroDamagePerMin / 120; // More generous than before, no cap
        
        // GPM bonus for farming mids
        if (gpm > 500) {
            points += (gpm - 500) / 45; // Reward efficient mids
        }
        
        // Solo kill bonus (new)
        if (kills >= 8 && assists < kills) {
            points += 12; // Reward solo-carry performances
        }
        
        // Experience leadership bonus
        if (xpm > 600) {
            points += Math.sqrt(xpm - 600) / 15;
        }
        
    } else if (role === 'Offlane') {
        // TARGET: Boost from ~66 to ~75 PPG  
        points += kills * 2.8; // Increased from 2.5
        points += assists * 2.6; // Increased from 2.2
        
        // Enhanced teamfight participation
        const participationRate = (kills + assists) / Math.max((kills + assists + deaths), 1);
        points += participationRate * 18; // Increased from 12, no cap
        
        // Space creation efficiency (new comprehensive bonus)
        const spaceCreationScore = (kills + assists) * 2 - deaths; // KDA-based space metric
        if (spaceCreationScore > 10) {
            points += Math.sqrt(spaceCreationScore - 10) * 2;
        }
        
        // Durability bonus (enhanced)
        if (deaths <= 5 && (kills + assists) >= 8) {
            points += 12; // Increased from 8
        }
        
        // Hero damage efficiency for tanky offlaners
        points += heroDamage / gameDurationMinutes / 200; // Damage per minute bonus
        
        // Initiation bonus (proxy: high assists relative to kills)
        if (assists > kills && assists >= 12) {
            points += assists * 0.5; // Bonus for initiating offlaners
        }
        
    } else if (role === 'Soft Support') {
        // TARGET: Boost from ~55 to ~75 PPG (needs major boost +36%)
        points += kills * 2.2; // Increased from 1.4 - supports need more kill value
        points += assists * 2.8; // Increased from 2.0, removed cap of 35
        
        // Enhanced vision game
        points += (obsPlaced || 0) * 2.5; // Increased from 1.8
        points += (senPlaced || 0) * 2.2; // Increased from 1.4
        
        // Teamfight impact bonus (new)
        const teamfightImpact = kills + assists;
        if (teamfightImpact >= 15) {
            points += Math.sqrt(teamfightImpact - 15) * 3; // No cap, scaling bonus
        }
        
        // Support efficiency bonus (GPM-independent impact)
        const supportEfficiency = (kills + assists) / Math.max(gpm / 100, 1);
        points += Math.min(supportEfficiency * 2, 15); // Reward high impact with low economy
        
        // Ward efficiency bonus (new)
        const wardEfficiency = (obsPlaced + senPlaced) / Math.max(gameDurationMinutes / 10, 1);
        if (wardEfficiency > 2) {
            points += (wardEfficiency - 2) * 8; // Reward exceptional warding
        }
        
        // Roaming/ganking bonus
        if (kills >= 5 && gpm < 350) {
            points += kills * 2; // Extra reward for aggressive supports
        }
        
    } else if (role === 'Hard Support') {
        // TARGET: Reduce from ~109 to ~75 PPG (needs -31% reduction)
        points += kills * 1.8; // Increased from 1.2 but role gets less overall
        points += assists * 1.8; // REDUCED from 2.2, removed cap (was too high)
        
        // Vision mastery (enhanced but not overpowered)
        points += (obsPlaced || 0) * 2.8; // Increased from 2.2
        points += (senPlaced || 0) * 2.5; // Increased from 2.0
        points += (heroHealing || 0) / 60; // Increased from /80
        
        // Enhanced support impact
        if (deaths >= 8 && assists >= 20) {
            points += 10; // Increased from 6 - reward sacrifice
        }
        
        // Vision control mastery
        if ((obsPlaced + senPlaced) >= 15) {
            points += 15; // Increased from 8
        }
        
        // Support excellence bonus (new)
        const supportExcellence = assists + obsPlaced + senPlaced + (heroHealing / 1000);
        if (supportExcellence > 30) {
            points += Math.sqrt(supportExcellence - 30) * 2; // No cap
        }
        
        // Buyback efficiency (new - shows game impact)
        if (buybackCount && buybackCount > 0) {
            points += buybackCount * 8; // Reward strategic buybacks
        }
        
        // Hero healing excellence
        if (heroHealing > 5000) {
            points += Math.sqrt(heroHealing - 5000) / 50; // Scale with healing output
        }
        
    } else {
        // Unknown role - balanced defaults
        points += kills * 2.2;
        points += assists * 2.0;
    }
    
    // === GAME DURATION NORMALIZATION ===
    const durationMultiplier = Math.min(gameDurationMinutes / 40, 1.3);
    points = points / durationMultiplier;
    
    // === PERFORMANCE FLOOR ===
    points = Math.max(points, -5); // Less harsh than before
    
    // === MULTI-STAT EXCELLENCE BONUSES (UNCAPPED) ===
    
    // KDA excellence (enhanced)
    const kda = deaths > 0 ? (kills + assists) / deaths : (kills + assists);
    if (kda >= 6) {
        points += Math.pow(kda - 6, 0.8) * 3; // Exponential scaling, no cap
    }
    
    // Statistical excellence across categories
    let excellenceCount = 0;
    let excellenceBonus = 0;
    
    // Role-agnostic excellence thresholds
    if (kills >= 10) { excellenceCount++; excellenceBonus += kills - 10; }
    if (assists >= 15) { excellenceCount++; excellenceBonus += (assists - 15) * 0.5; }
    if (gpm >= 550) { excellenceCount++; excellenceBonus += (gpm - 550) / 50; }
    if (heroDamage >= gameDurationMinutes * 400) { excellenceCount++; excellenceBonus += 5; }
    if (lastHits >= gameDurationMinutes * 6) { excellenceCount++; excellenceBonus += 3; }
    if ((obsPlaced + senPlaced) >= 12) { excellenceCount++; excellenceBonus += 4; }
    
    // Multi-dimensional excellence multiplier
    if (excellenceCount >= 3) {
        points += excellenceBonus + (excellenceCount * 5); // Scale with number of excellent stats
    }
    
    // Perfect game bonus (very rare)
    if (deaths === 0 && kills >= 5 && assists >= 8) {
        points += 25; // Substantial reward for perfect games
    }
    
    return Math.round(points * 100) / 100;
}

function recalculateEqualizedScores() {
    console.log('=== EQUALIZED FANTASY SCORING SYSTEM V2 ===\n');
    
    const csvData = fs.readFileSync('fantasy-scoring-unified.csv', 'utf8');
    const lines = csvData.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',');
    
    console.log('Processing with enhanced stat bonuses and removed caps...');
    
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
        
        // Estimate missing stats (not in CSV but in database)
        const highestKillStreak = Math.max(1, Math.floor(kills / 3)); // Rough estimate
        const buybackCount = netWorth > 20000 ? Math.floor(Math.random() * 2) : 0; // Rough estimate
        
        const gameData = {
            role, kills, deaths, assists, gpm, xpm, lastHits, denies, netWorth,
            heroDamage, towerDamage, heroHealing, obsPlaced, senPlaced,
            playerWon, firstBloodClaimed, courierKills, observerKills, 
            sentryKills, highestKillStreak, buybackCount
        };
        
        const newFantasyPoints = calculateEqualizedFantasyPoints(gameData, gameDurationMinutes);
        
        // Build new CSV line
        const newLine = [...fields];
        newLine[32] = newFantasyPoints.toFixed(2); // Replace game fantasy points
        newScores.push(newLine);
        
        // Track player totals
        if (!playerTotals.has(playerName)) {
            playerTotals.set(playerName, { 
                role, teamName, totalPoints: 0, games: 0 
            });
        }
        
        const pData = playerTotals.get(playerName);
        pData.totalPoints += newFantasyPoints;
        pData.games++;
    }
    
    // Update total points and PPG
    for (let i = 0; i < newScores.length; i++) {
        const playerName = newScores[i][0];
        const pData = playerTotals.get(playerName);
        
        newScores[i][7] = pData.totalPoints.toFixed(2);
        newScores[i][8] = (pData.totalPoints / pData.games).toFixed(2);
    }
    
    // Write new CSV
    const newCsvContent = [headers.join(','), ...newScores.map(line => line.join(','))].join('\n');
    fs.writeFileSync('fantasy-scoring-equalized.csv', newCsvContent);
    
    console.log('✅ Created fantasy-scoring-equalized.csv\n');
    
    // Analysis
    console.log('=== EQUALIZED SYSTEM ANALYSIS ===');
    
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
    
    console.log('EQUALIZED ROLE AVERAGES:');
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
    
    // Role balance measurement
    const highest = sortedRoles[0].avgPPG;
    const lowest = sortedRoles[sortedRoles.length - 1].avgPPG;
    const imbalance = ((highest / lowest - 1) * 100);
    
    console.log(`\nRole imbalance: ${imbalance.toFixed(1)}%`);
    
    if (imbalance < 15) {
        console.log('🎯 EXCELLENT: All roles are well-balanced!');
    } else if (imbalance < 25) {
        console.log('✅ GOOD: Role balance is very acceptable');
    } else {
        console.log('⚠️  Could be improved further');
    }
    
    // Compare to previous systems
    console.log('\n=== SYSTEM EVOLUTION ===');
    console.log('Original → Balanced → Equalized:');
    
    const comparisons = {
        'Hard Support': { old: 110.08, balanced: 103.02 },
        'Carry': { old: 43.59, balanced: 70.83 },
        'Mid': { old: 42.49, balanced: 64.66 },
        'Offlane': { old: 45.23, balanced: 62.55 },
        'Soft Support': { old: 59.82, balanced: 53.57 }
    };
    
    sortedRoles.forEach(r => {
        const comp = comparisons[r.role];
        if (comp) {
            console.log(`${r.role}: ${comp.old.toFixed(1)} → ${comp.balanced.toFixed(1)} → ${r.avgPPG.toFixed(1)}`);
        }
    });
    
    console.log('\n=== KEY IMPROVEMENTS ===');
    console.log('✅ Removed scoring caps - elite performances rewarded');
    console.log('✅ Added comprehensive stat bonuses for each role');
    console.log('✅ Multi-dimensional excellence bonuses');
    console.log('✅ Enhanced individual skill recognition');
    console.log('✅ Uncapped scaling for exceptional plays');
    
    console.log('\n📁 Results saved to: fantasy-scoring-equalized.csv');
}

if (require.main === module) {
    recalculateEqualizedScores();
}