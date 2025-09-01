#!/usr/bin/env node
/**
 * Export Fantasy League Scoring to CSV
 * 
 * This script generates comprehensive CSV files of all player fantasy scoring
 * across all matches in the tournament, including detailed breakdowns and descriptions
 * of how each metric contributes to the final fantasy points.
 */

require('dotenv').config({ path: __dirname + '/../.env.local' });
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin
if (!process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    console.error('FIREBASE_SERVICE_ACCOUNT_BASE64 is not set in .env.local');
    console.log('Trying alternative authentication methods...');
    
    // Try application default credentials
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

// Role-based fantasy scoring descriptions for documentation
const FANTASY_SCORING_RULES = {
    roles: {
        "Carry": { kills: 2.5, deaths: -2.0, assists: 0.8 },
        "Mid": { kills: 2.3, deaths: -1.8, assists: 1.2 },
        "Offlane": { kills: 2.0, deaths: -1.5, assists: 2.0 },
        "Soft Support": { kills: 1.2, deaths: -1.2, assists: 2.5 },
        "Hard Support": { kills: 1.0, deaths: -1.0, assists: 3.0 }
    }
};

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
    
    // Get all teams and their players
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
        
        // Get team players
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
        
        // Get all games for this match
        const gamesSnapshot = await db.collection('matches').doc(matchId).collection('games').get();
        
        for (const gameDoc of gamesSnapshot.docs) {
            const gameId = gameDoc.id;
            const gameData = gameDoc.data();
            
            // Get all player performances for this game
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

function calculatePlayerStats(allMatchData, playerMap) {
    const playerStats = new Map();
    
    // Initialize player stats
    for (const [playerId, player] of playerMap) {
        playerStats.set(playerId, {
            player,
            totalGames: 0,
            totalFantasyPoints: 0,
            averageFantasyPoints: 0,
            games: []
        });
    }
    
    // Process each game
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

function generateFantasyScoringBreakdown(performance, role) {
    const breakdown = [];
    const scoring = FANTASY_SCORING_RULES.roles[role] || FANTASY_SCORING_RULES.roles["Carry"];
    
    // Basic KDA scoring
    if (performance.kills) {
        breakdown.push({
            metric: "Kills",
            value: performance.kills,
            multiplier: scoring.kills,
            points: performance.kills * scoring.kills,
            description: `Kill points for ${role} role`
        });
    }
    
    if (performance.deaths) {
        breakdown.push({
            metric: "Deaths",
            value: performance.deaths,
            multiplier: scoring.deaths,
            points: performance.deaths * scoring.deaths,
            description: `Death penalty for ${role} role`
        });
    }
    
    if (performance.assists) {
        let points = performance.assists * scoring.assists;
        let capped = false;
        
        // Apply role-specific caps
        if (role === 'Soft Support' && points > 50) {
            points = 50;
            capped = true;
        } else if (role === 'Hard Support' && points > 60) {
            points = 60;
            capped = true;
        }
        
        breakdown.push({
            metric: "Assists",
            value: performance.assists,
            multiplier: scoring.assists,
            points: points,
            description: `Assist bonus for ${role} role${capped ? ' (capped)' : ''}`,
            capped
        });
    }
    
    // Support-specific metrics
    if ((role === 'Soft Support' || role === 'Hard Support') && performance.obsPlaced) {
        const multiplier = role === 'Hard Support' ? 2.0 : 1.5;
        breakdown.push({
            metric: "Observer Wards",
            value: performance.obsPlaced,
            multiplier: multiplier,
            points: performance.obsPlaced * multiplier,
            description: "Observer ward placement bonus"
        });
    }
    
    if ((role === 'Soft Support' || role === 'Hard Support') && performance.senPlaced) {
        const multiplier = role === 'Hard Support' ? 1.8 : 1.2;
        breakdown.push({
            metric: "Sentry Wards",
            value: performance.senPlaced,
            multiplier: multiplier,
            points: performance.senPlaced * multiplier,
            description: "Sentry ward placement bonus"
        });
    }
    
    if (role === 'Hard Support' && performance.heroHealing) {
        const points = performance.heroHealing * 0.01;
        breakdown.push({
            metric: "Hero Healing",
            value: performance.heroHealing,
            multiplier: 0.01,
            points: points,
            description: "Hero healing bonus (1 pt per 100 healing)"
        });
    }
    
    // Universal bonuses
    if (performance.towerDamage) {
        const points = Math.min(performance.towerDamage / 1000, 15);
        breakdown.push({
            metric: "Tower Damage",
            value: performance.towerDamage,
            points: points,
            description: "Tower damage contribution (1 pt per 1000 damage, max 15 pts)",
            capped: points === 15
        });
    }
    
    if (performance.firstBloodClaimed) {
        breakdown.push({
            metric: "First Blood",
            value: 1,
            points: 10,
            description: "First blood bonus"
        });
    }
    
    return breakdown;
}

async function generateCSVFiles() {
    try {
        const { playerMap, teamMap } = await getAllPlayerStats();
        const allMatchData = await getAllMatchData(playerMap, teamMap);
        const playerStats = calculatePlayerStats(allMatchData, playerMap);
        
        console.log('Generating CSV files...');
        
        // 1. Player Summary CSV
        const playerSummaryCsv = generatePlayerSummaryCSV(playerStats, teamMap);
        fs.writeFileSync('fantasy-player-summary.csv', playerSummaryCsv, 'utf8');
        
        // 2. Team Summary CSV
        const teamSummaryCsv = generateTeamSummaryCSV(playerStats, teamMap);
        fs.writeFileSync('fantasy-team-summary.csv', teamSummaryCsv, 'utf8');
        
        // 3. Detailed Game Performances CSV
        const gamePerformancesCsv = generateGamePerformancesCSV(playerStats, teamMap);
        fs.writeFileSync('fantasy-game-performances.csv', gamePerformancesCsv, 'utf8');
        
        // 4. Fantasy Scoring Breakdown CSV
        const scoringBreakdownCsv = generateScoringBreakdownCSV(playerStats, teamMap);
        fs.writeFileSync('fantasy-scoring-breakdown.csv', scoringBreakdownCsv, 'utf8');
        
        // 5. Scoring Rules Documentation CSV
        const rulesDocCsv = generateScoringRulesCSV();
        fs.writeFileSync('fantasy-scoring-rules.csv', rulesDocCsv, 'utf8');
        
        return {
            playerCount: playerStats.size,
            teamCount: teamMap.size,
            gamesCount: allMatchData.length
        };
        
    } catch (error) {
        console.error('Error generating CSV:', error);
        throw error;
    }
}

function generatePlayerSummaryCSV(playerStats, teamMap) {
    let csv = 'Player Name,Role,Team Name,Team Tag,Total Games,Total Fantasy Points,Points Per Game,Steam ID32,OpenDota ID\n';
    
    // Sort players by average fantasy points descending
    const sortedPlayers = Array.from(playerStats.values())
        .filter(p => p.totalGames > 0)
        .sort((a, b) => b.averageFantasyPoints - a.averageFantasyPoints);
    
    for (const playerStat of sortedPlayers) {
        const player = playerStat.player;
        const team = teamMap.get(player.teamId);
        
        csv += [
            escapeCsv(player.nickname),
            escapeCsv(player.role),
            escapeCsv(team?.name || 'Unknown'),
            escapeCsv(team?.tag || 'UNK'),
            playerStat.totalGames,
            playerStat.totalFantasyPoints.toFixed(2),
            playerStat.averageFantasyPoints.toFixed(2),
            escapeCsv(player.steamId32 || ''),
            escapeCsv(player.openDotaAccountId || '')
        ].join(',') + '\n';
    }
    
    return csv;
}

function generateTeamSummaryCSV(playerStats, teamMap) {
    let csv = 'Team Name,Team Tag,Total Games,Total Fantasy Points,Average Points Per Game,Player Count\n';
    
    const teamStatsMap = new Map();
    
    // Calculate team stats
    for (const [playerId, stats] of playerStats) {
        if (stats.totalGames === 0) continue;
        
        const teamId = stats.player.teamId;
        if (!teamStatsMap.has(teamId)) {
            teamStatsMap.set(teamId, {
                totalGames: 0,
                totalPoints: 0,
                playerCount: 0
            });
        }
        
        const teamStats = teamStatsMap.get(teamId);
        teamStats.totalGames += stats.totalGames;
        teamStats.totalPoints += stats.totalFantasyPoints;
        teamStats.playerCount++;
    }
    
    // Sort teams by average points per game
    const sortedTeams = Array.from(teamStatsMap.entries())
        .map(([teamId, stats]) => ({
            teamId,
            team: teamMap.get(teamId),
            ...stats,
            avgPointsPerGame: stats.totalGames > 0 ? stats.totalPoints / stats.totalGames : 0
        }))
        .sort((a, b) => b.avgPointsPerGame - a.avgPointsPerGame);
    
    for (const teamData of sortedTeams) {
        csv += [
            escapeCsv(teamData.team?.name || 'Unknown'),
            escapeCsv(teamData.team?.tag || 'UNK'),
            teamData.totalGames,
            teamData.totalPoints.toFixed(2),
            teamData.avgPointsPerGame.toFixed(2),
            teamData.playerCount
        ].join(',') + '\n';
    }
    
    return csv;
}

function generateGamePerformancesCSV(playerStats, teamMap) {
    let csv = 'Player Name,Role,Team Name,Match ID,Game ID,Hero,Duration (min),Radiant Win,Kills,Deaths,Assists,GPM,XPM,Last Hits,Denies,Net Worth,Hero Damage,Tower Damage,Hero Healing,Obs Placed,Sen Placed,First Blood,Fantasy Points\n';
    
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
            const durationMin = game.gameData?.duration ? (game.gameData.duration / 60).toFixed(1) : '0';
            
            csv += [
                escapeCsv(player.nickname),
                escapeCsv(player.role),
                escapeCsv(team?.name || 'Unknown'),
                escapeCsv(game.matchId),
                escapeCsv(game.gameId),
                escapeCsv(heroName),
                durationMin,
                game.gameData?.radiant_win || false,
                perf.kills || 0,
                perf.deaths || 0,
                perf.assists || 0,
                perf.gpm || 0,
                perf.xpm || 0,
                perf.lastHits || 0,
                perf.denies || 0,
                perf.netWorth || 0,
                perf.heroDamage || 0,
                perf.towerDamage || 0,
                perf.heroHealing || 0,
                perf.obsPlaced || 0,
                perf.senPlaced || 0,
                perf.firstBloodClaimed || false,
                (perf.fantasyPoints || 0).toFixed(2)
            ].join(',') + '\n';
        }
    }
    
    return csv;
}

function generateScoringBreakdownCSV(playerStats, teamMap) {
    let csv = 'Player Name,Role,Team Name,Match ID,Game ID,Hero,Scoring Metric,Value,Multiplier,Points,Description,Capped\n';
    
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
            const breakdown = generateFantasyScoringBreakdown(perf, player.role);
            
            for (const item of breakdown) {
                csv += [
                    escapeCsv(player.nickname),
                    escapeCsv(player.role),
                    escapeCsv(team?.name || 'Unknown'),
                    escapeCsv(game.matchId),
                    escapeCsv(game.gameId),
                    escapeCsv(heroName),
                    escapeCsv(item.metric),
                    item.value,
                    item.multiplier || '',
                    item.points.toFixed(2),
                    escapeCsv(item.description),
                    item.capped || false
                ].join(',') + '\n';
            }
        }
    }
    
    return csv;
}

function generateScoringRulesCSV() {
    let csv = 'Rule Category,Role,Metric,Multiplier,Max Points,Description\n';
    
    // Base scoring rules
    csv += 'Base Scoring,All,Team Win,,15,Bonus for team victory\n';
    csv += 'Base Scoring,All,First Blood,,10,Bonus for claiming first blood\n';
    csv += 'Base Scoring,All,Tower Damage,,15,Tower damage contribution (max 15 pts 1 pt per 1000 damage)\n';
    csv += 'Base Scoring,All,Hero Damage,,10,Hero damage per minute bonus (>400 DPM max 10 pts)\n';
    
    // Role-specific scoring
    for (const [role, scoring] of Object.entries(FANTASY_SCORING_RULES.roles)) {
        csv += `Role Scoring,${role},Kills,${scoring.kills},,Kill points for ${role} role\n`;
        csv += `Role Scoring,${role},Deaths,${scoring.deaths},,Death penalty for ${role} role\n`;
        
        let assistMax = '';
        if (role === 'Soft Support') assistMax = '50';
        if (role === 'Hard Support') assistMax = '60';
        csv += `Role Scoring,${role},Assists,${scoring.assists},${assistMax},Assist bonus for ${role} role${assistMax ? ' (capped)' : ''}\n`;
        
        // Support-specific bonuses
        if (role === 'Soft Support' || role === 'Hard Support') {
            const obsMultiplier = role === 'Hard Support' ? 2.0 : 1.5;
            const senMultiplier = role === 'Hard Support' ? 1.8 : 1.2;
            csv += `Role Scoring,${role},Observer Wards,${obsMultiplier},,Observer ward placement bonus\n`;
            csv += `Role Scoring,${role},Sentry Wards,${senMultiplier},,Sentry ward placement bonus\n`;
            
            if (role === 'Hard Support') {
                csv += `Role Scoring,${role},Hero Healing,0.01,,Hero healing bonus (1 pt per 100 healing)\n`;
            }
        }
    }
    
    // Game adjustments
    csv += 'Adjustments,All,Duration Normalization,,,Score normalized for game duration (40min baseline)\n';
    csv += 'Adjustments,All,Performance Floor,,-10,Minimum fantasy score floor\n';
    csv += 'Adjustments,All,Comeback Bonus,,8,Team wins with >3000 networth deficit\n';
    csv += 'Adjustments,All,Stomp Reduction,0.8,,Team loses with >8000 networth lead\n';
    
    return csv;
}

async function main() {
    try {
        console.log('Starting fantasy league scoring CSV export...');
        
        const stats = await generateCSVFiles();
        
        console.log(`\nFantasy scoring CSV files generated successfully!`);
        console.log(`Files created:`);
        console.log(`  - fantasy-player-summary.csv (${stats.playerCount} players)`);
        console.log(`  - fantasy-team-summary.csv (${stats.teamCount} teams)`);
        console.log(`  - fantasy-game-performances.csv (detailed game data)`);
        console.log(`  - fantasy-scoring-breakdown.csv (point calculations)`);
        console.log(`  - fantasy-scoring-rules.csv (scoring documentation)`);
        console.log(`\nTotal games processed: ${stats.gamesCount}`);
        
        // Calculate file sizes
        const files = [
            'fantasy-player-summary.csv',
            'fantasy-team-summary.csv', 
            'fantasy-game-performances.csv',
            'fantasy-scoring-breakdown.csv',
            'fantasy-scoring-rules.csv'
        ];
        
        let totalSize = 0;
        for (const file of files) {
            if (fs.existsSync(file)) {
                const size = fs.statSync(file).size;
                totalSize += size;
                console.log(`  ${file}: ${(size / 1024).toFixed(1)} KB`);
            }
        }
        console.log(`Total size: ${(totalSize / 1024).toFixed(1)} KB`);
        
    } catch (error) {
        console.error('Failed to generate fantasy scoring CSV:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { generateCSVFiles };