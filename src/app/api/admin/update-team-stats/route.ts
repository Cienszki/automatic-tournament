// API endpoint to update team statistics using Admin SDK
import { NextRequest, NextResponse } from 'next/server';
import { ensureAdminInitialized, getAdminDb } from '../../../../../server/lib/admin';

// Hero ID to name mapping
const heroIdToName: { [key: string]: string } = {
  "1": "Anti-Mage", "2": "Axe", "3": "Bane", "4": "Bloodseeker", "5": "Crystal Maiden",
  "6": "Drow Ranger", "7": "Earthshaker", "8": "Juggernaut", "9": "Mirana", "10": "Morphling",
  "11": "Shadow Fiend", "12": "Phantom Lancer", "13": "Puck", "14": "Pudge", "15": "Razor",
  "16": "Sand King", "17": "Storm Spirit", "18": "Sven", "19": "Tiny", "20": "Vengeful Spirit",
  "21": "Windranger", "22": "Zeus", "23": "Kunkka", "24": "Lina", "25": "Lion",
  "26": "Shadow Demon", "27": "Shadow Shaman", "28": "Slardar", "29": "Tidehunter", "30": "Witch Doctor",
  "31": "Lich", "32": "Riki", "33": "Enigma", "34": "Tinker", "35": "Sniper",
  "36": "Necrophos", "37": "Warlock", "38": "Beastmaster", "39": "Queen of Pain", "40": "Venomancer",
  "41": "Faceless Void", "42": "Wraith King", "43": "Death Prophet", "44": "Phantom Assassin", "45": "Pugna",
  "46": "Templar Assassin", "47": "Viper", "48": "Luna", "49": "Dragon Knight", "50": "Dazzle",
  "51": "Clockwerk", "52": "Leshrac", "53": "Nature's Prophet", "54": "Lifestealer", "55": "Dark Seer",
  "56": "Clinkz", "57": "Omniknight", "58": "Enchantress", "59": "Huskar", "60": "Night Stalker",
  "61": "Broodmother", "62": "Bounty Hunter", "63": "Weaver", "64": "Jakiro", "65": "Batrider",
  "66": "Chen", "67": "Spectre", "68": "Ancient Apparition", "69": "Doom", "70": "Ursa",
  "71": "Spirit Breaker", "72": "Gyrocopter", "73": "Alchemist", "74": "Invoker", "75": "Silencer",
  "76": "Outworld Destroyer", "77": "Lycan", "78": "Brewmaster", "79": "Shadow Fiend", "80": "Lone Druid",
  "81": "Chaos Knight", "82": "Meepo", "83": "Treant Protector", "84": "Ogre Magi", "85": "Undying",
  "86": "Rubick", "87": "Disruptor", "88": "Nyx Assassin", "89": "Naga Siren", "90": "Keeper of the Light",
  "91": "Io", "92": "Visage", "93": "Slark", "94": "Medusa", "95": "Troll Warlord",
  "96": "Centaur Warrunner", "97": "Magnus", "98": "Timbersaw", "99": "Bristleback", "100": "Tusk",
  "101": "Skywrath Mage", "102": "Abaddon", "103": "Elder Titan", "104": "Legion Commander", "105": "Techies",
  "106": "Ember Spirit", "107": "Earth Spirit", "108": "Underlord", "109": "Terrorblade", "110": "Phoenix",
  "111": "Oracle", "112": "Winter Wyvern", "113": "Arc Warden", "114": "Monkey King", "115": "Dark Willow",
  "116": "Pangolier", "117": "Grimstroke", "118": "Hoodwink", "119": "Void Spirit", "120": "Snapfire",
  "121": "Mars", "122": "Dawnbreaker", "123": "Marci", "124": "Primal Beast", "125": "Muerta",
  "126": "Kez", "127": "Ringmaster"
};

// Calculate fantasy points based on performance
function calculateFantasyPoints(perf: any): number {
    // Standard fantasy scoring: kills=0.3, deaths=-0.3, assists=0.15, lastHits=0.003, gpm=0.002, etc.
    const killPoints = (perf.kills || 0) * 0.3;
    const deathPoints = (perf.deaths || 0) * -0.3;
    const assistPoints = (perf.assists || 0) * 0.15;
    const lastHitPoints = (perf.lastHits || 0) * 0.003;
    const gpmPoints = (perf.gpm || 0) * 0.002;
    
    return killPoints + deathPoints + assistPoints + lastHitPoints + gpmPoints;
}

export async function POST(request: NextRequest) {
    try {
        console.log('Starting team statistics update via API using Admin SDK...');
        
        // Initialize admin SDK
        ensureAdminInitialized();
        const db = getAdminDb();

        // Get all teams
        const teamsSnapshot = await db.collection('teams').get();
        console.log(`Found ${teamsSnapshot.docs.length} teams`);

        // Get all matches
        const matchesSnapshot = await db.collection('matches').get();
        const allMatches = matchesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
        console.log(`Found ${allMatches.length} total matches`);

        // Update statistics for each team
        for (const teamDoc of teamsSnapshot.docs) {
            const teamId = teamDoc.id;
            const teamData = teamDoc.data();
            
            console.log(`Updating statistics for team ${teamId} (${teamData.name})...`);

            // Filter matches for this team that are completed
            const teamMatches = allMatches.filter(m => 
                m.teams && m.teams.includes(teamId) && m.status === 'completed'
            );
            console.log(`Found ${teamMatches.length} completed matches for team ${teamId}`);

            if (teamMatches.length === 0) {
                console.log(`No completed matches found for team ${teamId}, setting stats to 0`);
                await db.collection('teams').doc(teamId).update({
                    matchesPlayed: 0,
                    wins: 0,
                    draws: 0,
                    losses: 0,
                    averageKillsPerGame: 0,
                    averageDeathsPerGame: 0,
                    averageAssistsPerGame: 0,
                    averageFantasyPoints: 0,
                    averageMatchDurationMinutes: 0,
                    mostPlayedHeroes: [],
                    lastStatsUpdate: new Date().toISOString()
                });
                continue;
            }

            let wins = 0;
            let draws = 0;
            let losses = 0;
            let totalKills = 0;
            let totalDeaths = 0;
            let totalAssists = 0;
            let totalFantasyPoints = 0;
            let totalMatchDurationSeconds = 0;
            let totalGames = 0;
            let totalGpm = 0;
            let totalXpm = 0;
            let totalLastHits = 0;
            let totalNetWorth = 0;
            let totalHeroDamage = 0;
            let totalTowerDamage = 0;
            let totalHeroHealing = 0;
            const heroStats: { [heroName: string]: number } = {};
            const matchesPlayed = teamMatches.length;

            for (const match of teamMatches) {
                console.log(`Processing match ${match.id}: ${match.teamA?.name} vs ${match.teamB?.name}`);
                
                // Calculate win/draw/loss
                const teamAScore = match.teamA?.score ?? 0;
                const teamBScore = match.teamB?.score ?? 0;
                
                if (match.teamA?.id === teamId) {
                    if (teamAScore > teamBScore) wins++;
                    else if (teamAScore === teamBScore) draws++;
                    else losses++;
                    console.log(`  Team A result: score ${teamAScore}-${teamBScore}, W:${wins} D:${draws} L:${losses}`);
                } else {
                    if (teamBScore > teamAScore) wins++;
                    else if (teamBScore === teamAScore) draws++;
                    else losses++;
                    console.log(`  Team B result: score ${teamBScore}-${teamAScore}, W:${wins} D:${draws} L:${losses}`);
                }

                // Calculate performance statistics from game subcollections
                if (match.game_ids && match.game_ids.length > 0) {
                    console.log(`  Found ${match.game_ids.length} games for this match`);
                    
                    for (const gameId of match.game_ids) {
                        try {
                            // Get game data for duration
                            const gameDoc = await db
                                .collection('matches')
                                .doc(match.id)
                                .collection('games')
                                .doc(String(gameId))
                                .get();
                            
                            const gameData = gameDoc.data();
                            if (gameData && gameData.duration) {
                                totalMatchDurationSeconds += gameData.duration;
                                totalGames++;
                                console.log(`    Game ${gameId}: Duration ${gameData.duration} seconds`);
                            }
                            
                            // Get all performances for this game
                            const gamePerformancesSnapshot = await db
                                .collection('matches')
                                .doc(match.id)
                                .collection('games')
                                .doc(String(gameId))
                                .collection('performances')
                                .get();
                            
                            const gamePerformances = gamePerformancesSnapshot.docs.map(doc => doc.data());
                            const teamPerformances = gamePerformances.filter((p: any) => p.teamId === teamId);
                            
                            console.log(`    Game ${gameId}: Found ${teamPerformances.length} player performances for this team`);
                            
                            // Log sample performance data to understand structure
                            if (teamPerformances.length > 0) {
                                console.log(`    Sample performance data:`, JSON.stringify(teamPerformances[0], null, 2));
                            }
                            
                            for (const perf of teamPerformances) {
                                totalKills += perf.kills || 0;
                                totalDeaths += perf.deaths || 0;
                                totalAssists += perf.assists || 0;
                                totalGpm += perf.gpm || 0;
                                totalXpm += perf.xpm || 0;
                                totalLastHits += perf.lastHits || 0;
                                totalNetWorth += perf.netWorth || 0;
                                totalHeroDamage += perf.heroDamage || 0;
                                totalTowerDamage += perf.towerDamage || 0;
                                totalHeroHealing += perf.heroHealing || 0;
                                
                                // Calculate fantasy points properly
                                const fantasyPts = calculateFantasyPoints(perf);
                                totalFantasyPoints += fantasyPts;
                                
                                // Track hero usage - convert heroId to name
                                const heroName = heroIdToName[String(perf.heroId)] || `Hero${perf.heroId}`;
                                if (heroName) {
                                    heroStats[heroName] = (heroStats[heroName] || 0) + 1;
                                }
                            }
                        } catch (gameError) {
                            console.log(`    Error reading game ${gameId} performances:`, gameError);
                        }
                    }
                    console.log(`  Match totals so far: K:${totalKills} D:${totalDeaths} A:${totalAssists} F:${totalFantasyPoints}`);
                } else if (match.playerPerformances) {
                    // Fallback: Check main document for legacy data
                    const teamPerformances = match.playerPerformances.filter((p: any) => p.teamId === teamId);
                    console.log(`  Found ${teamPerformances.length} player performances in main document (legacy)`);
                    
                    for (const perf of teamPerformances) {
                        totalKills += perf.kills || 0;
                        totalDeaths += perf.deaths || 0;
                        totalAssists += perf.assists || 0;
                        totalGpm += perf.gpm || 0;
                        totalXpm += perf.xpm || 0;
                        totalLastHits += perf.lastHits || 0;
                        totalNetWorth += perf.netWorth || 0;
                        totalHeroDamage += perf.heroDamage || 0;
                        totalTowerDamage += perf.towerDamage || 0;
                        totalHeroHealing += perf.heroHealing || 0;
                        totalFantasyPoints += perf.fantasyPoints || 0;
                        
                        // Track hero usage
                        if (perf.hero) {
                            heroStats[perf.hero] = (heroStats[perf.hero] || 0) + 1;
                        }
                    }
                    console.log(`  Match totals so far: K:${totalKills} D:${totalDeaths} A:${totalAssists} F:${totalFantasyPoints}`);
                } else {
                    console.log(`  No player performances found for match ${match.id}`);
                }
            }

            const round1 = (v: number) => Math.round(v * 10) / 10;
            const averageKillsPerGame = round1(totalGames > 0 ? totalKills / totalGames : 0);
            const averageDeathsPerGame = round1(totalGames > 0 ? totalDeaths / totalGames : 0);
            const averageAssistsPerGame = round1(totalGames > 0 ? totalAssists / totalGames : 0);
            const averageFantasyPoints = round1(totalGames > 0 ? totalFantasyPoints / totalGames : 0);
            const averageGpm = round1(totalGames > 0 ? totalGpm / totalGames : 0);
            const averageXpm = round1(totalGames > 0 ? totalXpm / totalGames : 0);
            const averageLastHits = round1(totalGames > 0 ? totalLastHits / totalGames : 0);
            const averageNetWorth = round1(totalGames > 0 ? totalNetWorth / totalGames : 0);
            const averageHeroDamage = round1(totalGames > 0 ? totalHeroDamage / totalGames : 0);
            const averageTowerDamage = round1(totalGames > 0 ? totalTowerDamage / totalGames : 0);
            const averageHeroHealing = round1(totalGames > 0 ? totalHeroHealing / totalGames : 0);
            const averageMatchDurationMinutes = round1(totalGames > 0 ? (totalMatchDurationSeconds / 60) / totalGames : 0);

            // Get top 3 most played heroes
            const mostPlayedHeroes = Object.entries(heroStats)
                .map(([name, gamesPlayed]) => ({ name, gamesPlayed }))
                .sort((a, b) => b.gamesPlayed - a.gamesPlayed)
                .slice(0, 3);

            console.log(`Final stats for team ${teamId}:`, {
                matchesPlayed,
                wins,
                draws,
                losses,
                averageKillsPerGame: averageKillsPerGame.toFixed(2),
                averageDeathsPerGame: averageDeathsPerGame.toFixed(2),
                averageAssistsPerGame: averageAssistsPerGame.toFixed(2),
                averageFantasyPoints: averageFantasyPoints.toFixed(2),
                averageMatchDurationMinutes,
                averageGpm: averageGpm.toFixed(0),
                averageXpm: averageXpm.toFixed(0),
                averageLastHits: averageLastHits.toFixed(0),
                averageNetWorth: averageNetWorth.toFixed(0),
                averageHeroDamage: averageHeroDamage.toFixed(0),
                averageTowerDamage: averageTowerDamage.toFixed(0),
                averageHeroHealing: averageHeroHealing.toFixed(0),
                mostPlayedHeroes
            });

            // Update team document with calculated statistics using Admin SDK
            await db.collection('teams').doc(teamId).update({
                matchesPlayed,
                wins,
                draws,
                losses,
                averageKillsPerGame,
                averageDeathsPerGame,
                averageAssistsPerGame,
                averageFantasyPoints,
                averageMatchDurationMinutes,
                averageGpm,
                averageXpm,
                averageLastHits,
                averageNetWorth,
                averageHeroDamage,
                averageTowerDamage,
                averageHeroHealing,
                mostPlayedHeroes,
                lastStatsUpdate: new Date().toISOString()
            });

            console.log(`Successfully updated statistics for team ${teamId}: ${matchesPlayed} matches, ${wins}W/${draws}D/${losses}L`);
        }

        console.log('Team statistics update completed successfully!');
        return NextResponse.json({ 
            success: true, 
            message: 'All team statistics updated successfully.' 
        });
    } catch (error) {
        console.error('Error updating team statistics:', error);
        return NextResponse.json({ 
            success: false, 
            message: 'Failed to update team statistics.',
            error: (error as Error).message 
        }, { status: 500 });
    }
}
