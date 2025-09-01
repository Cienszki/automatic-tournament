#!/usr/bin/env node
/**
 * Export Fantasy League Scoring to XML
 * 
 * This script generates a comprehensive XML report of all player fantasy scoring
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

// Role-based fantasy scoring descriptions
const FANTASY_SCORING_RULES = {
    baseScoring: {
        teamWin: { points: 15, description: "Bonus for team victory" },
        firstBlood: { points: 10, description: "Bonus for claiming first blood" },
        towerDamageMax: { points: 15, description: "Tower damage contribution (max 15 pts, 1 pt per 1000 damage)" },
        heroDamageBonus: { points: 10, description: "Hero damage per minute bonus (>400 DPM, max 10 pts)" }
    },
    roles: {
        "Carry": {
            kills: { multiplier: 2.5, description: "Kill points for carry role" },
            deaths: { multiplier: -2.0, description: "Death penalty for carry role" },
            assists: { multiplier: 0.8, description: "Assist bonus for carry role" },
            lastHitBonus: { max: 6, formula: "lastHits/gameDuration/8", description: "Last hit efficiency bonus (max 6 pts)" }
        },
        "Mid": {
            kills: { multiplier: 2.3, description: "Kill points for mid role" },
            deaths: { multiplier: -1.8, description: "Death penalty for mid role" },
            assists: { multiplier: 1.2, description: "Assist bonus for mid role" },
            xpmBonus: { max: 8, formula: "(xpm-500)/60", description: "XP advantage bonus (max 8 pts)" },
            heroDamageBonus: { max: 6, formula: "heroDamagePerMin/200", description: "Hero damage bonus (max 6 pts)" }
        },
        "Offlane": {
            kills: { multiplier: 2.0, description: "Kill points for offlane role" },
            deaths: { multiplier: -1.5, description: "Death penalty for offlane role" },
            assists: { multiplier: 2.0, description: "Assist bonus for offlane role" },
            participationBonus: { max: 8, formula: "(kills+assists)/max(kills+assists+deaths,1)*8", description: "Teamfight participation bonus" },
            durabilityBonus: { points: 5, condition: "deaths <= 5 && (kills+assists) >= 8", description: "Durability bonus for efficient play" }
        },
        "Soft Support": {
            kills: { multiplier: 1.2, description: "Kill points for soft support role" },
            deaths: { multiplier: -1.2, description: "Death penalty for soft support role" },
            assists: { multiplier: 2.5, max: 50, description: "Assist bonus for soft support role (capped at 50 pts)" },
            obsPlaced: { multiplier: 1.5, description: "Observer ward placement bonus" },
            senPlaced: { multiplier: 1.2, description: "Sentry ward placement bonus" },
            participationBonus: { max: 10, formula: "(kills+assists)/teamKills*15", description: "Kill participation bonus" }
        },
        "Hard Support": {
            kills: { multiplier: 1.0, description: "Kill points for hard support role" },
            deaths: { multiplier: -1.0, description: "Death penalty for hard support role" },
            assists: { multiplier: 3.0, max: 60, description: "Assist bonus for hard support role (capped at 60 pts)" },
            obsPlaced: { multiplier: 2.0, description: "Observer ward placement bonus" },
            senPlaced: { multiplier: 1.8, description: "Sentry ward placement bonus" },
            heroHealing: { multiplier: 0.01, description: "Hero healing bonus (1 pt per 100 healing)" },
            sacrificeBonus: { points: 5, condition: "deaths >= 8 && assists >= 15", description: "Team sacrifice bonus" },
            participationBonus: { max: 15, formula: "(kills+assists)/teamKills*20", description: "Kill participation bonus" }
        }
    },
    adjustments: {
        durationNormalization: { baseline: 40, max: 1.5, description: "Score normalized for game duration (40min baseline)" },
        performanceFloor: { min: -10, description: "Minimum fantasy score floor" },
        comebackBonus: { points: 8, condition: "team wins with >3000 networth deficit", description: "Comeback victory bonus" },
        stompReduction: { multiplier: 0.8, condition: "team loses with >8000 networth lead", description: "Stomp loss reduction" }
    }
};

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

function escapeXml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function generateFantasyScoringBreakdown(performance, role) {
    const breakdown = [];
    const scoring = FANTASY_SCORING_RULES.roles[role] || FANTASY_SCORING_RULES.roles["Carry"];
    
    // Base stats
    if (performance.kills) {
        const points = performance.kills * scoring.kills.multiplier;
        breakdown.push({
            metric: "Kills",
            value: performance.kills,
            multiplier: scoring.kills.multiplier,
            points: points,
            description: scoring.kills.description
        });
    }
    
    if (performance.deaths) {
        const points = performance.deaths * scoring.deaths.multiplier;
        breakdown.push({
            metric: "Deaths",
            value: performance.deaths,
            multiplier: scoring.deaths.multiplier,
            points: points,
            description: scoring.deaths.description
        });
    }
    
    if (performance.assists) {
        let points = performance.assists * scoring.assists.multiplier;
        if (scoring.assists.max && points > scoring.assists.max) {
            points = scoring.assists.max;
        }
        breakdown.push({
            metric: "Assists",
            value: performance.assists,
            multiplier: scoring.assists.multiplier,
            points: points,
            description: scoring.assists.description,
            capped: scoring.assists.max ? points === scoring.assists.max : false
        });
    }
    
    // Role-specific bonuses
    if (performance.obsPlaced && scoring.obsPlaced) {
        const points = performance.obsPlaced * scoring.obsPlaced.multiplier;
        breakdown.push({
            metric: "Observer Wards",
            value: performance.obsPlaced,
            multiplier: scoring.obsPlaced.multiplier,
            points: points,
            description: scoring.obsPlaced.description
        });
    }
    
    if (performance.senPlaced && scoring.senPlaced) {
        const points = performance.senPlaced * scoring.senPlaced.multiplier;
        breakdown.push({
            metric: "Sentry Wards",
            value: performance.senPlaced,
            multiplier: scoring.senPlaced.multiplier,
            points: points,
            description: scoring.senPlaced.description
        });
    }
    
    if (performance.heroHealing && scoring.heroHealing) {
        const points = performance.heroHealing * scoring.heroHealing.multiplier;
        breakdown.push({
            metric: "Hero Healing",
            value: performance.heroHealing,
            multiplier: scoring.heroHealing.multiplier,
            points: points,
            description: scoring.heroHealing.description
        });
    }
    
    // Tower and hero damage
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
    
    return breakdown;
}

async function generateXML() {
    try {
        const { playerMap, teamMap } = await getAllPlayerStats();
        const allMatchData = await getAllMatchData(playerMap, teamMap);
        const playerStats = calculatePlayerStats(allMatchData, playerMap);
        
        console.log('Generating XML report...');
        
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<fantasy-league-scoring>\n';
        xml += '  <metadata>\n';
        xml += `    <generated-at>${new Date().toISOString()}</generated-at>\n`;
        xml += `    <total-players>${playerStats.size}</total-players>\n`;
        xml += `    <total-games>${allMatchData.length}</total-games>\n`;
        xml += '    <description>Comprehensive fantasy league scoring report for all tournament players</description>\n';
        xml += '  </metadata>\n\n';
        
        // Scoring rules documentation
        xml += '  <scoring-rules>\n';
        xml += '    <base-scoring>\n';
        for (const [key, rule] of Object.entries(FANTASY_SCORING_RULES.baseScoring)) {
            xml += `      <rule name="${key}" points="${rule.points}">${escapeXml(rule.description)}</rule>\n`;
        }
        xml += '    </base-scoring>\n';
        
        xml += '    <role-based-scoring>\n';
        for (const [role, rules] of Object.entries(FANTASY_SCORING_RULES.roles)) {
            xml += `      <role name="${role}">\n`;
            for (const [metric, rule] of Object.entries(rules)) {
                xml += `        <metric name="${metric}"`;
                if (rule.multiplier) xml += ` multiplier="${rule.multiplier}"`;
                if (rule.max) xml += ` max-points="${rule.max}"`;
                if (rule.points) xml += ` points="${rule.points}"`;
                xml += `>${escapeXml(rule.description)}</metric>\n`;
            }
            xml += `      </role>\n`;
        }
        xml += '    </role-based-scoring>\n';
        xml += '  </scoring-rules>\n\n';
        
        // Team summary
        xml += '  <teams>\n';
        for (const [teamId, team] of teamMap) {
            const teamPlayers = Array.from(playerStats.values()).filter(p => p.player.teamId === teamId);
            const teamTotalPoints = teamPlayers.reduce((sum, p) => sum + p.totalFantasyPoints, 0);
            const teamTotalGames = teamPlayers.reduce((sum, p) => sum + p.totalGames, 0);
            const teamAvgPoints = teamTotalGames > 0 ? teamTotalPoints / teamTotalGames : 0;
            
            xml += `    <team id="${escapeXml(teamId)}" name="${escapeXml(team.name)}" tag="${escapeXml(team.tag)}">\n`;
            xml += `      <summary total-points="${teamTotalPoints.toFixed(2)}" total-games="${teamTotalGames}" avg-points-per-game="${teamAvgPoints.toFixed(2)}" />\n`;
            xml += '    </team>\n';
        }
        xml += '  </teams>\n\n';
        
        // Player statistics and detailed game breakdowns
        xml += '  <players>\n';
        
        // Sort players by average fantasy points descending
        const sortedPlayers = Array.from(playerStats.values())
            .filter(p => p.totalGames > 0)
            .sort((a, b) => b.averageFantasyPoints - a.averageFantasyPoints);
        
        for (const playerStat of sortedPlayers) {
            const player = playerStat.player;
            const team = teamMap.get(player.teamId);
            
            xml += `    <player id="${escapeXml(player.id)}" name="${escapeXml(player.nickname)}" role="${escapeXml(player.role)}">\n`;
            xml += `      <team id="${escapeXml(player.teamId)}" name="${escapeXml(team?.name || 'Unknown')}" tag="${escapeXml(team?.tag || 'UNK')}" />\n`;
            xml += `      <summary\n`;
            xml += `        total-games="${playerStat.totalGames}"\n`;
            xml += `        total-fantasy-points="${playerStat.totalFantasyPoints.toFixed(2)}"\n`;
            xml += `        points-per-game="${playerStat.averageFantasyPoints.toFixed(2)}"\n`;
            xml += `        steam-id-32="${escapeXml(player.steamId32 || '')}"\n`;
            xml += `        opendota-id="${escapeXml(player.openDotaAccountId || '')}"\n`;
            xml += '      />\n';
            
            // Individual game performances
            xml += '      <games>\n';
            for (const game of playerStat.games) {
                const perf = game.performance;
                const heroName = heroIdToName[String(perf.heroId)] || `Hero${perf.heroId}`;
                
                xml += `        <game match-id="${escapeXml(game.matchId)}" game-id="${escapeXml(game.gameId)}">\n`;
                xml += `          <match-info\n`;
                xml += `            duration="${game.gameData?.duration || 0}"\n`;
                xml += `            radiant-win="${game.gameData?.radiant_win || false}"\n`;
                xml += `            vs-team="${escapeXml(game.team?.name || 'Unknown')}"\n`;
                xml += `          />\n`;
                xml += `          <performance\n`;
                xml += `            hero="${escapeXml(heroName)}"\n`;
                xml += `            hero-id="${perf.heroId || 0}"\n`;
                xml += `            kills="${perf.kills || 0}"\n`;
                xml += `            deaths="${perf.deaths || 0}"\n`;
                xml += `            assists="${perf.assists || 0}"\n`;
                xml += `            gpm="${perf.gpm || 0}"\n`;
                xml += `            xpm="${perf.xpm || 0}"\n`;
                xml += `            last-hits="${perf.lastHits || 0}"\n`;
                xml += `            denies="${perf.denies || 0}"\n`;
                xml += `            net-worth="${perf.netWorth || 0}"\n`;
                xml += `            hero-damage="${perf.heroDamage || 0}"\n`;
                xml += `            tower-damage="${perf.towerDamage || 0}"\n`;
                xml += `            hero-healing="${perf.heroHealing || 0}"\n`;
                xml += `            obs-placed="${perf.obsPlaced || 0}"\n`;
                xml += `            sen-placed="${perf.senPlaced || 0}"\n`;
                xml += `            first-blood="${perf.firstBloodClaimed || false}"\n`;
                xml += `            fantasy-points="${(perf.fantasyPoints || 0).toFixed(2)}"\n`;
                xml += '          />\n';
                
                // Fantasy scoring breakdown
                const breakdown = generateFantasyScoringBreakdown(perf, player.role);
                if (breakdown.length > 0) {
                    xml += '          <fantasy-breakdown>\n';
                    for (const item of breakdown) {
                        xml += `            <scoring-item\n`;
                        xml += `              metric="${escapeXml(item.metric)}"\n`;
                        xml += `              value="${item.value}"\n`;
                        if (item.multiplier) xml += `              multiplier="${item.multiplier}"\n`;
                        xml += `              points="${item.points.toFixed(2)}"\n`;
                        if (item.capped) xml += `              capped="true"\n`;
                        xml += `              description="${escapeXml(item.description)}"\n`;
                        xml += '            />\n';
                    }
                    xml += '          </fantasy-breakdown>\n';
                }
                
                xml += '        </game>\n';
            }
            xml += '      </games>\n';
            xml += '    </player>\n';
        }
        
        xml += '  </players>\n';
        xml += '</fantasy-league-scoring>\n';
        
        return xml;
        
    } catch (error) {
        console.error('Error generating XML:', error);
        throw error;
    }
}

async function main() {
    try {
        console.log('Starting fantasy league scoring XML export...');
        
        const xml = await generateXML();
        const outputFile = 'fantasy-scoring-report.xml';
        
        fs.writeFileSync(outputFile, xml, 'utf8');
        
        console.log(`\nFantasy scoring report generated successfully!`);
        console.log(`Output saved to: ${outputFile}`);
        console.log(`File size: ${(fs.statSync(outputFile).size / 1024 / 1024).toFixed(2)} MB`);
        
    } catch (error) {
        console.error('Failed to generate fantasy scoring XML:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { generateXML };