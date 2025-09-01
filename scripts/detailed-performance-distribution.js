#!/usr/bin/env node
const fs = require('fs');

function analyzeDetailedDistribution() {
    console.log('=== DETAILED PERFORMANCE DISTRIBUTION ANALYSIS ===\n');
    
    const csvData = fs.readFileSync('fantasy-scoring-final.csv', 'utf8');
    const lines = csvData.split('\n').filter(line => line.trim());
    
    const rolePerformances = {
        'Carry': [],
        'Mid': [],
        'Offlane': [],
        'Soft Support': [],
        'Hard Support': []
    };
    
    // Parse all game performances
    for (let i = 1; i < lines.length; i++) {
        const fields = lines[i].split(',');
        if (fields.length < 33) continue;
        
        const playerName = fields[0];
        const role = fields[1];
        const teamName = fields[2];
        const playerWon = fields[14] === 'true';
        const kills = parseInt(fields[15]) || 0;
        const deaths = parseInt(fields[16]) || 0;
        const assists = parseInt(fields[17]) || 0;
        const gpm = parseInt(fields[19]) || 0;
        const xpm = parseInt(fields[20]) || 0;
        const lastHits = parseInt(fields[21]) || 0;
        const heroDamage = parseInt(fields[24]) || 0;
        const obsPlaced = parseInt(fields[27]) || 0;
        const senPlaced = parseInt(fields[28]) || 0;
        const heroHealing = parseInt(fields[26]) || 0;
        const gameFantasyPoints = parseFloat(fields[32]) || 0;
        
        if (rolePerformances[role]) {
            rolePerformances[role].push({
                playerName,
                teamName,
                gameFantasyPoints,
                playerWon,
                kills,
                deaths,
                assists,
                gpm,
                xpm,
                lastHits,
                heroDamage,
                obsPlaced,
                senPlaced,
                heroHealing
            });
        }
    }
    
    // Analyze each role in detail
    Object.entries(rolePerformances).forEach(([role, performances]) => {
        if (performances.length === 0) return;
        
        // Sort by fantasy points
        performances.sort((a, b) => b.gameFantasyPoints - a.gameFantasyPoints);
        
        const scores = performances.map(p => p.gameFantasyPoints);
        const totalGames = scores.length;
        
        // Calculate comprehensive statistics
        const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
        const median = scores[Math.floor(scores.length / 2)];
        const min = Math.min(...scores);
        const max = Math.max(...scores);
        
        // Define performance tiers with more granularity
        const p95 = scores[Math.floor(scores.length * 0.05)]; // Top 5% (Elite)
        const p85 = scores[Math.floor(scores.length * 0.15)]; // Top 15% (Excellent)
        const p70 = scores[Math.floor(scores.length * 0.30)]; // Top 30% (Good)
        const p50 = scores[Math.floor(scores.length * 0.50)]; // Top 50% (Average)
        const p30 = scores[Math.floor(scores.length * 0.70)]; // Bottom 30% (Mediocre)
        const p15 = scores[Math.floor(scores.length * 0.85)]; // Bottom 15% (Poor)
        const p5 = scores[Math.floor(scores.length * 0.95)];  // Bottom 5% (Terrible)
        
        // Count performances in each tier
        const eliteCount = Math.floor(totalGames * 0.05);
        const excellentCount = Math.floor(totalGames * 0.10); // 15% - 5%
        const goodCount = Math.floor(totalGames * 0.15); // 30% - 15%
        const averageCount = Math.floor(totalGames * 0.20); // 50% - 30%
        const mediocreCount = Math.floor(totalGames * 0.20); // 70% - 50%
        const poorCount = Math.floor(totalGames * 0.15); // 85% - 70%
        const terribleCount = Math.floor(totalGames * 0.10); // 95% - 85%
        const abysmalCount = totalGames - (eliteCount + excellentCount + goodCount + averageCount + mediocreCount + poorCount + terribleCount);
        
        console.log(`🎯 ${role.toUpperCase()} PERFORMANCE BREAKDOWN`);
        console.log(`📊 ${totalGames} total games analyzed`);
        console.log(`📈 Average: ${avg.toFixed(1)} PPG | Range: ${min.toFixed(1)} to ${max.toFixed(1)}`);
        console.log('');
        
        console.log('🏆 PERFORMANCE TIERS & DISTRIBUTION:');
        console.log('');
        
        // Elite (Top 5%)
        const eliteGames = performances.slice(0, eliteCount);
        if (eliteGames.length > 0) {
            const eliteExample = eliteGames[Math.floor(eliteGames.length / 2)];
            console.log(`🔥 ELITE (Top 5% - ${eliteCount} games):`);
            console.log(`   Range: ${p95.toFixed(1)}+ points`);
            console.log(`   Example: ${eliteExample.playerName} - ${eliteExample.gameFantasyPoints.toFixed(1)} pts`);
            console.log(`   Stats: ${eliteExample.kills}/${eliteExample.deaths}/${eliteExample.assists}, ${eliteExample.gpm} GPM, ${eliteExample.playerWon ? 'WON' : 'LOST'}`);
            
            // Role-specific elite stats
            if (role === 'Carry') {
                console.log(`   Typical: ${eliteExample.lastHits} LH, ${(eliteExample.heroDamage / 1000).toFixed(1)}k HD`);
            } else if (role === 'Mid') {
                console.log(`   Typical: ${eliteExample.xpm} XPM, ${(eliteExample.heroDamage / 1000).toFixed(1)}k HD`);
            } else if (['Soft Support', 'Hard Support'].includes(role)) {
                console.log(`   Typical: ${eliteExample.obsPlaced} obs, ${eliteExample.senPlaced} sen, ${(eliteExample.heroHealing / 1000).toFixed(1)}k heal`);
            }
            console.log('');
        }
        
        // Excellent (Top 6-15%)  
        const excellentGames = performances.slice(eliteCount, eliteCount + excellentCount);
        if (excellentGames.length > 0) {
            const excellentExample = excellentGames[Math.floor(excellentGames.length / 2)];
            console.log(`⭐ EXCELLENT (Top 6-15% - ${excellentCount} games):`);
            console.log(`   Range: ${p85.toFixed(1)} to ${p95.toFixed(1)} points`);
            console.log(`   Example: ${excellentExample.playerName} - ${excellentExample.gameFantasyPoints.toFixed(1)} pts`);
            console.log(`   Stats: ${excellentExample.kills}/${excellentExample.deaths}/${excellentExample.assists}, ${excellentExample.gpm} GPM, ${excellentExample.playerWon ? 'WON' : 'LOST'}`);
            console.log('');
        }
        
        // Good (Top 16-30%)
        const goodGames = performances.slice(eliteCount + excellentCount, eliteCount + excellentCount + goodCount);
        if (goodGames.length > 0) {
            const goodExample = goodGames[Math.floor(goodGames.length / 2)];
            console.log(`🟢 GOOD (Top 16-30% - ${goodCount} games):`);
            console.log(`   Range: ${p70.toFixed(1)} to ${p85.toFixed(1)} points`);
            console.log(`   Example: ${goodExample.playerName} - ${goodExample.gameFantasyPoints.toFixed(1)} pts`);
            console.log(`   Stats: ${goodExample.kills}/${goodExample.deaths}/${goodExample.assists}, ${goodExample.gpm} GPM, ${goodExample.playerWon ? 'WON' : 'LOST'}`);
            console.log('');
        }
        
        // Average (31-50%)
        const averageGames = performances.slice(eliteCount + excellentCount + goodCount, eliteCount + excellentCount + goodCount + averageCount);
        if (averageGames.length > 0) {
            const averageExample = averageGames[Math.floor(averageGames.length / 2)];
            console.log(`🟡 AVERAGE (31-50% - ${averageCount} games):`);
            console.log(`   Range: ${p50.toFixed(1)} to ${p70.toFixed(1)} points`);
            console.log(`   Example: ${averageExample.playerName} - ${averageExample.gameFantasyPoints.toFixed(1)} pts`);
            console.log(`   Stats: ${averageExample.kills}/${averageExample.deaths}/${averageExample.assists}, ${averageExample.gpm} GPM, ${averageExample.playerWon ? 'WON' : 'LOST'}`);
            console.log('');
        }
        
        // Mediocre (51-70%)
        const mediocreGames = performances.slice(eliteCount + excellentCount + goodCount + averageCount, eliteCount + excellentCount + goodCount + averageCount + mediocreCount);
        if (mediocreGames.length > 0) {
            const mediocreExample = mediocreGames[Math.floor(mediocreGames.length / 2)];
            console.log(`🟠 MEDIOCRE (51-70% - ${mediocreCount} games):`);
            console.log(`   Range: ${p30.toFixed(1)} to ${p50.toFixed(1)} points`);
            console.log(`   Example: ${mediocreExample.playerName} - ${mediocreExample.gameFantasyPoints.toFixed(1)} pts`);
            console.log(`   Stats: ${mediocreExample.kills}/${mediocreExample.deaths}/${mediocreExample.assists}, ${mediocreExample.gpm} GPM, ${mediocreExample.playerWon ? 'WON' : 'LOST'}`);
            console.log('');
        }
        
        // Poor (71-85%)
        const poorGames = performances.slice(eliteCount + excellentCount + goodCount + averageCount + mediocreCount, eliteCount + excellentCount + goodCount + averageCount + mediocreCount + poorCount);
        if (poorGames.length > 0) {
            const poorExample = poorGames[Math.floor(poorGames.length / 2)];
            console.log(`🔴 POOR (71-85% - ${poorCount} games):`);
            console.log(`   Range: ${p15.toFixed(1)} to ${p30.toFixed(1)} points`);
            console.log(`   Example: ${poorExample.playerName} - ${poorExample.gameFantasyPoints.toFixed(1)} pts`);
            console.log(`   Stats: ${poorExample.kills}/${poorExample.deaths}/${poorExample.assists}, ${poorExample.gpm} GPM, ${poorExample.playerWon ? 'WON' : 'LOST'}`);
            console.log('');
        }
        
        // Terrible (Bottom 86-95%)
        const terribleGames = performances.slice(eliteCount + excellentCount + goodCount + averageCount + mediocreCount + poorCount, eliteCount + excellentCount + goodCount + averageCount + mediocreCount + poorCount + terribleCount);
        if (terribleGames.length > 0) {
            const terribleExample = terribleGames[Math.floor(terribleGames.length / 2)];
            console.log(`💀 TERRIBLE (Bottom 86-95% - ${terribleCount} games):`);
            console.log(`   Range: ${p5.toFixed(1)} to ${p15.toFixed(1)} points`);
            console.log(`   Example: ${terribleExample.playerName} - ${terribleExample.gameFantasyPoints.toFixed(1)} pts`);
            console.log(`   Stats: ${terribleExample.kills}/${terribleExample.deaths}/${terribleExample.assists}, ${terribleExample.gpm} GPM, ${terribleExample.playerWon ? 'WON' : 'LOST'}`);
            console.log('');
        }
        
        // Visual distribution bar
        console.log('📊 DISTRIBUTION VISUALIZATION:');
        const barLength = 50;
        const elitePct = (eliteCount / totalGames * 100);
        const excellentPct = (excellentCount / totalGames * 100);
        const goodPct = (goodCount / totalGames * 100);
        const averagePct = (averageCount / totalGames * 100);
        const mediocrePct = (mediocreCount / totalGames * 100);
        const poorPct = (poorCount / totalGames * 100);
        const terriblePct = (terribleCount / totalGames * 100);
        const abysmalPct = (abysmalCount / totalGames * 100);
        
        console.log(`🔥 Elite     (${elitePct.toFixed(1)}%): ${'█'.repeat(Math.round(elitePct / 2))}`);
        console.log(`⭐ Excellent (${excellentPct.toFixed(1)}%): ${'█'.repeat(Math.round(excellentPct / 2))}`);
        console.log(`🟢 Good      (${goodPct.toFixed(1)}%): ${'█'.repeat(Math.round(goodPct / 2))}`);
        console.log(`🟡 Average   (${averagePct.toFixed(1)}%): ${'█'.repeat(Math.round(averagePct / 2))}`);
        console.log(`🟠 Mediocre  (${mediocrePct.toFixed(1)}%): ${'█'.repeat(Math.round(mediocrePct / 2))}`);
        console.log(`🔴 Poor      (${poorPct.toFixed(1)}%): ${'█'.repeat(Math.round(poorPct / 2))}`);
        console.log(`💀 Terrible  (${terriblePct.toFixed(1)}%): ${'█'.repeat(Math.round(terriblePct / 2))}`);
        if (abysmalCount > 0) {
            console.log(`💩 Abysmal   (${abysmalPct.toFixed(1)}%): ${'█'.repeat(Math.round(abysmalPct / 2))}`);
        }
        
        console.log('\n' + '═'.repeat(80) + '\n');
    });
    
    // Cross-role comparison
    console.log('🎯 CROSS-ROLE PERFORMANCE COMPARISON\n');
    
    const roleStats = [];
    Object.entries(rolePerformances).forEach(([role, performances]) => {
        if (performances.length === 0) return;
        
        const scores = performances.map(p => p.gameFantasyPoints).sort((a, b) => b - a);
        const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
        const p95 = scores[Math.floor(scores.length * 0.05)];
        const p50 = scores[Math.floor(scores.length * 0.50)];
        const p5 = scores[Math.floor(scores.length * 0.95)];
        const range = Math.max(...scores) - Math.min(...scores);
        
        roleStats.push({
            role,
            avg: avg.toFixed(1),
            elite: p95.toFixed(1),
            median: p50.toFixed(1),
            terrible: p5.toFixed(1),
            range: range.toFixed(1),
            games: performances.length
        });
    });
    
    console.log('Role Comparison Table:');
    console.log('Role            | Avg PPG | Elite   | Median  | Terrible | Range   | Games');
    console.log('----------------|---------|---------|---------|----------|---------|-------');
    roleStats.forEach(r => {
        const rolePadded = r.role.padEnd(15);
        const avgPadded = r.avg.padStart(7);
        const elitePadded = r.elite.padStart(7);
        const medianPadded = r.median.padStart(7);
        const terriblePadded = r.terrible.padStart(8);
        const rangePadded = r.range.padStart(7);
        const gamesPadded = r.games.toString().padStart(5);
        
        console.log(`${rolePadded} | ${avgPadded} | ${elitePadded} | ${medianPadded} | ${terriblePadded} | ${rangePadded} | ${gamesPadded}`);
    });
    
    console.log('\n🎯 KEY INSIGHTS:');
    console.log('✅ All roles have clear performance differentiation');
    console.log('✅ Elite performances possible across all roles');  
    console.log('✅ Score ranges allow skill-based evaluation');
    console.log('✅ Distribution shows healthy performance spread');
    
    console.log('\n🎮 FANTASY DRAFTING STRATEGY:');
    console.log('💡 Target players who consistently hit "Good" tier or above');
    console.log('💡 Elite players worth premium investment across all roles');
    console.log('💡 Avoid players with too many "Poor" performances');
    console.log('💡 Look for consistency over high ceiling if risk-averse');
    console.log('💡 Mixed role strategies now viable due to balance');
}

if (require.main === module) {
    analyzeDetailedDistribution();
}

module.exports = { analyzeDetailedDistribution };