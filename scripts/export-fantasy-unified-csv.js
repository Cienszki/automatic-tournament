#!/usr/bin/env node
/**
 * Export Unified Fantasy League Scoring to Single CSV
 * 
 * This script generates one comprehensive CSV file with all player fantasy scoring
 * data, including detailed breakdowns for each game with proper numeric formatting
 * for sorting capabilities.
 */

require('dotenv').config({ path: __dirname + '/../.env.local' });
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin
if (!process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    console.error('FIREBASE_SERVICE_ACCOUNT_BASE64 is not set in .env.local');
    console.log('Trying alternative authentication methods...');
    
    try {
        admin.initializeApp({
            credential: admin.credential.applicationDefault(),
            projectId: 'tournament-tracker-f35tb'
        });
        console.log('Using application default credentials');
    } catch (error) {
        console.error('Failed to initialize Firebase Admin:', error.message);
        process.exit(1);
    }
} else {
    const serviceAccount = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf-8'));
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log('Using service account from environment variable');
}

const db = admin.firestore();

// Hero ID to name mapping
const heroIdToName = {
  "1": "Anti-Mage", "2": "Axe", "3": "Bane", "4": "Bloodseeker", "5": "Crystal Maiden",
  "6": "Drow Ranger", "7": "Earthshaker", "8": "Juggernaut", "9": "Mirana", "10": "Morphling",
  "11": "Shadow Fiend", "12": "Phantom Lancer", "13": "Puck", "14": "Pudge", "15": "Razor",
  "16": "Sand King", "17": "Storm Spirit", "18": "Sven", "19": "Tiny", "20": "Vengeful Spirit",
  "21": "Windranger", "22": "Zeus", "23": "Kunkka", "25": "Lina", "26": "Lion",
  "27": "Shadow Shaman", "28": "Slardar", "29": "Tidehunter", "30": "Witch Doctor", "31": "Lich",
  "32": "Riki", "33": "Enigma", "34": "Tinker", "35": "Sniper", "36": "Necrophos",
  "37": "Warlock", "38": "Beastmaster", "39": "Queen of Pain", "40": "Venomancer", "41": "Faceless Void",
  "42": "Wraith King", "43": "Death Prophet", "44": "Phantom Assassin", "45": "Pugna", "46": "Templar Assassin",
  "47": "Viper", "48": "Luna", "49": "Dragon Knight", "50": "Dazzle", "51": "Clockwerk",
  "52": "Leshrac", "53": "Nature's Prophet", "54": "Lifestealer", "55": "Dark Seer", "56": "Clinkz",
  "57": "Omniknight", "58": "Enchantress", "59": "Huskar", "60": "Night Stalker", "61": "Broodmother",
  "62": "Bounty Hunter", "63": "Weaver", "64": "Jakiro", "65": "Batrider", "66": "Chen",
  "67": "Spectre", "68": "Ancient Apparition", "69": "Doom", "70": "Ursa", "71": "Spirit Breaker",
  "72": "Gyrocopter", "73": "Alchemist", "74": "Invoker", "75": "Silencer", "76": "Outworld Destroyer",
  "77": "Lycan", "78": "Brewmaster", "79": "Shadow Demon", "80": "Lone Druid", "81": "Chaos Knight",
  "82": "Meepo", "83": "Treant Protector", "84": "Ogre Magi", "85": "Undying", "86": "Rubick",
  "87": "Disruptor", "88": "Nyx Assassin", "89": "Naga Siren", "90": "Keeper of the Light", "91": "Io",
  "92": "Visage", "93": "Slark", "94": "Medusa", "95": "Troll Warlord", "96": "Centaur Warrunner",
  "97": "Magnus", "98": "Timbersaw", "99": "Bristleback", "100": "Tusk", "101": "Skywrath Mage",
  "102": "Abaddon", "103": "Elder Titan", "104": "Legion Commander", "105": "Techies", "106": "Ember Spirit",
  "107": "Earth Spirit", "108": "Underlord", "109": "Terrorblade", "110": "Phoenix", "111": "Oracle",
  "112": "Winter Wyvern", "113": "Arc Warden", "114": "Monkey King", "115": "Dark Willow", "116": "Pangolier",
  "117": "Grimstroke", "118": "Hoodwink", "119": "Void Spirit", "120": "Snapfire", "121": "Mars", 
  "122": "Dawnbreaker", "123": "Marci", "124": "Primal Beast", "125": "Muerta", "126": "Kez", "127": "Ringmaster"
};

// Role-based fantasy scoring for calculations
const FANTASY_SCORING_RULES = {
    roles: {
        "Carry": { kills: 2.5, deaths: -2.0, assists: 0.8 },
        "Mid": { kills: 2.3, deaths: -1.8, assists: 1.2 },
        "Offlane": { kills: 2.0, deaths: -1.5, assists: 2.0 },
        "Soft Support": { kills: 1.2, deaths: -1.2, assists: 2.5 },
        "Hard Support": { kills: 1.0, deaths: -1.0, assists: 3.0 }
    }
};

function formatNumber(num) {
    if (num == null || num === '') return '0';
    // Ensure it's treated as a number for proper sorting
    return Number(num).toString();
}

function formatDecimal(num, decimals = 2) {
    if (num == null || num === '') return '0.00';
    return Number(num).toFixed(decimals);
}

function escapeCsv(str) {
    if (str == null) return '';
    const s = String(str);
    if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
        return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
}

async function getAllPlayerStats() {
    console.log('Fetching all player and team data...');
    
    const teamsSnapshot = await db.collection('teams').get();
    const playerMap = new Map();
    const teamMap = new Map();
    
    for (const teamDoc of teamsSnapshot.docs) {
        const teamData = teamDoc.data();
        const teamId = teamDoc.id;
        
        teamMap.set(teamId, {
            id: teamId,
            name: teamData.name || 'Unknown Team',
            tag: teamData.tag || teamData.name?.substring(0, 4) || 'UNK'
        });
        
        const playersSnapshot = await db.collection('teams').doc(teamId).collection('players').get();
        for (const playerDoc of playersSnapshot.docs) {
            const playerData = playerDoc.data();
            playerMap.set(playerDoc.id, {
                id: playerDoc.id,
                nickname: playerData.nickname || 'Unknown Player',
                role: playerData.role || 'Unknown',
                teamId: teamId,
                steamId32: playerData.steamId32,
                openDotaAccountId: playerData.openDotaAccountId
            });
        }
    }
    
    console.log(`Found ${teamMap.size} teams and ${playerMap.size} players`);
    return { playerMap, teamMap };
}

async function getAllMatchData(playerMap, teamMap) {
    console.log('Fetching all match and game data...');
    
    const matchesSnapshot = await db.collection('matches').get();
    const allMatchData = [];
    
    for (const matchDoc of matchesSnapshot.docs) {
        const matchId = matchDoc.id;
        const matchData = matchDoc.data();
        
        console.log(`Processing match ${matchId}...`);
        
        const gamesSnapshot = await db.collection('matches').doc(matchId).collection('games').get();
        
        for (const gameDoc of gamesSnapshot.docs) {
            const gameId = gameDoc.id;
            const gameData = gameDoc.data();
            
            const performancesSnapshot = await db.collection('matches').doc(matchId)
                .collection('games').doc(gameId)
                .collection('performances').get();
            
            const gamePerformances = [];
            for (const perfDoc of performancesSnapshot.docs) {
                const playerId = perfDoc.id;
                const perfData = perfDoc.data();
                
                const player = playerMap.get(playerId);
                const team = player ? teamMap.get(player.teamId) : null;
                
                gamePerformances.push({
                    playerId,
                    player,
                    team,
                    performance: perfData
                });
            }
            
            if (gamePerformances.length > 0) {
                allMatchData.push({
                    matchId,
                    matchData,
                    gameId,
                    gameData,
                    performances: gamePerformances
                });
            }
        }
    }
    
    console.log(`Found ${allMatchData.length} games with performance data`);
    return allMatchData;
}

function calculateFantasyBreakdown(performance, role) {
    const scoring = FANTASY_SCORING_RULES.roles[role] || FANTASY_SCORING_RULES.roles["Carry"];
    const breakdown = {};
    
    // Basic KDA
    breakdown.killPoints = (performance.kills || 0) * scoring.kills;
    breakdown.deathPoints = (performance.deaths || 0) * scoring.deaths;
    
    let assistPoints = (performance.assists || 0) * scoring.assists;
    breakdown.assistsUncapped = assistPoints;
    
    // Apply caps
    breakdown.assistsCapped = false;
    if (role === 'Soft Support' && assistPoints > 50) {
        assistPoints = 50;
        breakdown.assistsCapped = true;
    } else if (role === 'Hard Support' && assistPoints > 60) {
        assistPoints = 60;
        breakdown.assistsCapped = true;
    }
    breakdown.assistPoints = assistPoints;
    
    // Support-specific bonuses
    if (role === 'Soft Support' || role === 'Hard Support') {
        const obsMultiplier = role === 'Hard Support' ? 2.0 : 1.5;
        const senMultiplier = role === 'Hard Support' ? 1.8 : 1.2;
        
        breakdown.obsPoints = (performance.obsPlaced || 0) * obsMultiplier;
        breakdown.senPoints = (performance.senPlaced || 0) * senMultiplier;
        
        if (role === 'Hard Support') {
            breakdown.healingPoints = (performance.heroHealing || 0) * 0.01;
        } else {
            breakdown.healingPoints = 0;
        }
    } else {
        breakdown.obsPoints = 0;
        breakdown.senPoints = 0;
        breakdown.healingPoints = 0;
    }
    
    // Universal bonuses
    breakdown.towerDamagePoints = Math.min((performance.towerDamage || 0) / 1000, 15);
    breakdown.towerDamageCapped = breakdown.towerDamagePoints === 15;
    
    breakdown.firstBloodPoints = (performance.firstBloodClaimed || false) ? 10 : 0;
    
    // Calculate estimated basic points (this is a simplified version of the actual algorithm)
    breakdown.estimatedBasicPoints = breakdown.killPoints + breakdown.deathPoints + breakdown.assistPoints;
    breakdown.estimatedSupportPoints = breakdown.obsPoints + breakdown.senPoints + breakdown.healingPoints;
    breakdown.estimatedUniversalPoints = breakdown.towerDamagePoints + breakdown.firstBloodPoints;
    breakdown.estimatedTotalPoints = breakdown.estimatedBasicPoints + breakdown.estimatedSupportPoints + breakdown.estimatedUniversalPoints;
    
    return breakdown;
}

function calculatePlayerSummary(allMatchData, playerMap) {
    const playerStats = new Map();
    
    // Initialize
    for (const [playerId, player] of playerMap) {
        playerStats.set(playerId, {
            player,
            totalGames: 0,
            totalFantasyPoints: 0,
            averageFantasyPoints: 0,
            games: []
        });
    }
    
    // Process games
    for (const gameData of allMatchData) {
        for (const { playerId, player, team, performance } of gameData.performances) {
            if (!playerStats.has(playerId)) continue;
            
            const stats = playerStats.get(playerId);
            stats.totalGames++;
            stats.totalFantasyPoints += performance.fantasyPoints || 0;
            
            stats.games.push({
                matchId: gameData.matchId,
                gameId: gameData.gameId,
                matchData: gameData.matchData,
                gameData: gameData.gameData,
                performance,
                team
            });
        }
    }
    
    // Calculate averages
    for (const [playerId, stats] of playerStats) {
        if (stats.totalGames > 0) {
            stats.averageFantasyPoints = stats.totalFantasyPoints / stats.totalGames;
        }
    }
    
    return playerStats;
}

async function generateUnifiedCSV() {
    try {
        const { playerMap, teamMap } = await getAllPlayerStats();
        const allMatchData = await getAllMatchData(playerMap, teamMap);
        const playerStats = calculatePlayerSummary(allMatchData, playerMap);
        
        console.log('Generating unified CSV file...');
        
        // Create comprehensive header
        let csv = [
            // Player info
            'Player Name', 'Role', 'Team Name', 'Team Tag', 'Steam ID32', 'OpenDota ID',
            
            // Player summary stats
            'Total Games', 'Total Fantasy Points', 'Points Per Game',
            
            // Game specific info
            'Match ID', 'Game ID', 'Hero Name', 'Game Duration Minutes', 'Radiant Win', 'Player Won',
            
            // Raw game stats
            'Kills', 'Deaths', 'Assists', 'KDA Ratio',
            'GPM', 'XPM', 'Last Hits', 'Denies', 'Net Worth',
            'Hero Damage', 'Tower Damage', 'Hero Healing',
            'Observer Wards Placed', 'Sentry Wards Placed',
            'First Blood Claimed', 'Courier Kills', 'Observer Ward Kills', 'Sentry Ward Kills',
            
            // Fantasy scoring breakdown
            'Total Fantasy Points Game', 'Fantasy Points Per Minute',
            
            // Detailed point calculations
            'Kill Points', 'Death Points', 
            'Assist Points', 'Assists Capped', 'Assists Uncapped Points',
            'Observer Ward Points', 'Sentry Ward Points', 'Healing Points',
            'Tower Damage Points', 'Tower Damage Capped',
            'First Blood Points',
            
            // Estimated breakdowns (simplified calculation)
            'Est Basic KDA Points', 'Est Support Points', 'Est Universal Points', 'Est Total Points'
        ].join(',') + '\n';
        
        // Sort players by average fantasy points descending
        const sortedPlayers = Array.from(playerStats.values())
            .filter(p => p.totalGames > 0)
            .sort((a, b) => b.averageFantasyPoints - a.averageFantasyPoints);
        
        for (const playerStat of sortedPlayers) {
            const player = playerStat.player;
            const team = teamMap.get(player.teamId);
            
            for (const game of playerStat.games) {
                const perf = game.performance;
                const heroName = heroIdToName[String(perf.heroId)] || `Hero${perf.heroId}`;
                const durationMin = game.gameData?.duration ? game.gameData.duration / 60 : 0;
                const fantasyBreakdown = calculateFantasyBreakdown(perf, player.role);
                
                // Determine if player won
                const isRadiant = perf.playerId ? true : false; // This would need actual slot data
                const playerWon = game.gameData?.radiant_win === isRadiant;
                
                // Calculate KDA ratio
                const kdaRatio = perf.deaths > 0 ? ((perf.kills || 0) + (perf.assists || 0)) / perf.deaths : (perf.kills || 0) + (perf.assists || 0);
                
                // Fantasy points per minute
                const fantasyPointsPerMin = durationMin > 0 ? (perf.fantasyPoints || 0) / durationMin : 0;
                
                csv += [
                    // Player info
                    escapeCsv(player.nickname),
                    escapeCsv(player.role),
                    escapeCsv(team?.name || 'Unknown'),
                    escapeCsv(team?.tag || 'UNK'),
                    escapeCsv(player.steamId32 || ''),
                    escapeCsv(player.openDotaAccountId || ''),
                    
                    // Player summary
                    formatNumber(playerStat.totalGames),
                    formatDecimal(playerStat.totalFantasyPoints),
                    formatDecimal(playerStat.averageFantasyPoints),
                    
                    // Game info
                    escapeCsv(game.matchId),
                    escapeCsv(game.gameId),
                    escapeCsv(heroName),
                    formatDecimal(durationMin, 1),
                    game.gameData?.radiant_win || false,
                    playerWon,
                    
                    // Raw stats
                    formatNumber(perf.kills || 0),
                    formatNumber(perf.deaths || 0),
                    formatNumber(perf.assists || 0),
                    formatDecimal(kdaRatio),
                    formatNumber(perf.gpm || 0),
                    formatNumber(perf.xpm || 0),
                    formatNumber(perf.lastHits || 0),
                    formatNumber(perf.denies || 0),
                    formatNumber(perf.netWorth || 0),
                    formatNumber(perf.heroDamage || 0),
                    formatNumber(perf.towerDamage || 0),
                    formatNumber(perf.heroHealing || 0),
                    formatNumber(perf.obsPlaced || 0),
                    formatNumber(perf.senPlaced || 0),
                    perf.firstBloodClaimed || false,
                    formatNumber(perf.courierKills || 0),
                    formatNumber(perf.observerKills || 0),
                    formatNumber(perf.sentryKills || 0),
                    
                    // Fantasy points
                    formatDecimal(perf.fantasyPoints || 0),
                    formatDecimal(fantasyPointsPerMin),
                    
                    // Detailed breakdown
                    formatDecimal(fantasyBreakdown.killPoints),
                    formatDecimal(fantasyBreakdown.deathPoints),
                    formatDecimal(fantasyBreakdown.assistPoints),
                    fantasyBreakdown.assistsCapped,
                    formatDecimal(fantasyBreakdown.assistsUncapped),
                    formatDecimal(fantasyBreakdown.obsPoints),
                    formatDecimal(fantasyBreakdown.senPoints),
                    formatDecimal(fantasyBreakdown.healingPoints),
                    formatDecimal(fantasyBreakdown.towerDamagePoints),
                    fantasyBreakdown.towerDamageCapped,
                    formatDecimal(fantasyBreakdown.firstBloodPoints),
                    
                    // Estimated totals
                    formatDecimal(fantasyBreakdown.estimatedBasicPoints),
                    formatDecimal(fantasyBreakdown.estimatedSupportPoints),
                    formatDecimal(fantasyBreakdown.estimatedUniversalPoints),
                    formatDecimal(fantasyBreakdown.estimatedTotalPoints)
                ].join(',') + '\n';
            }
        }
        
        return csv;
        
    } catch (error) {
        console.error('Error generating unified CSV:', error);
        throw error;
    }
}

async function main() {
    try {
        console.log('Starting unified fantasy scoring CSV export...');
        
        const csv = await generateUnifiedCSV();
        const outputFile = 'fantasy-scoring-unified.csv';
        
        fs.writeFileSync(outputFile, csv, 'utf8');
        
        const fileSize = fs.statSync(outputFile).size;
        console.log(`\nUnified fantasy scoring CSV generated successfully!`);
        console.log(`Output saved to: ${outputFile}`);
        console.log(`File size: ${(fileSize / 1024).toFixed(1)} KB`);
        
        // Count lines for summary
        const lines = csv.split('\n').length - 2; // -2 for header and last empty line
        console.log(`Total rows: ${lines} game performances`);
        
        console.log('\nFile contains:');
        console.log('- Complete player and game statistics');
        console.log('- Detailed fantasy point breakdowns');
        console.log('- All stats formatted for proper numeric sorting');
        console.log('- You can now easily filter/sort by last hits, fantasy points, etc.');
        
    } catch (error) {
        console.error('Failed to generate unified fantasy scoring CSV:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { generateUnifiedCSV };