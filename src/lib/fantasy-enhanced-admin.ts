import { getAdminDb, ensureAdminInitialized } from '../server/lib/admin';
import { PlayerRole } from './definitions';
import type { FantasyUserSummary as ClientFantasyUserSummary, FantasyPlayerStats as ClientFantasyPlayerStats, FantasyLeaderboards as ClientFantasyLeaderboards } from './fantasy-types';
import { ROUND_DISPLAY_NAMES as ClientROUND_DISPLAY_NAMES, getNextRoundForLineup as clientGetNextRoundForLineup } from './fantasy-types';

// Round display name mapping
export const ROUND_DISPLAY_NAMES: Record<string, string> = {
    initial: "Pre-Tournament Setup",
    pre_season: "Pre-Season",
    group_stage: "Group Stage", 
    wildcards: "Wildcards",
    playoffs_round1: "Round 1",
    playoffs_round2: "Round 2",
    playoffs_round3: "Round 3", 
    playoffs_round4: "Round 4",
    playoffs_round5: "Round 5",
    playoffs_round6: "Round 6",
    playoffs_round7: "Round 7"
};

export interface FantasyUserSummary {
    userId: string;
    displayName: string;
    totalScore: number;
    gamesPlayed: number;
    averageScore: number;
    rankHistory: Array<{
        round: string;
        rank: number;
        score: number;
        gamesPlayed: number;
    }>;
    lineupHistory: Array<{
        round: string;
        lineup: Record<PlayerRole, any>;
        totalPoints: number;
        gamesPlayed: number;
        averageScore: number;
        playerBreakdown: Array<{
            playerId: string;
            role: PlayerRole;
            nickname: string;
            pointsInRound: number;
            gamesInRound: number;
            avgInRound: number;
        }>;
    }>;
}

export interface FantasyPlayerStats {
    playerId: string;
    nickname: string;
    role: PlayerRole;
    teamName: string;
    totalMatches: number;
    averageScore: number;
    allMatches: Array<{
        matchId: string;
        gameId: string;
        round: string;
        roundDisplayName: string;
        fantasyPoints: number;
        opponentTeam: string;
        gameDate: string;
        gameDuration: number;
        detailedScoring: {
            basePoints: number;
            kills: number;
            deaths: number;
            assists: number;
            killPoints: number;
            deathPoints: number;
            assistPoints: number;
            bonusPoints: number;
            bonusBreakdown: Record<string, number>;
            finalPoints: number;
        };
        // Raw game stats for tooltips
        gameStats: {
            kills: number;
            deaths: number;
            assists: number;
            gpm: number;
            xpm: number;
            lastHits: number;
            heroDamage: number;
            heroHealing: number;
            towerDamage: number;
            obsPlaced: number;
            senPlaced: number;
            netWorth: number;
        };
    }>;
}

export interface FantasyLeaderboards {
    overall: Array<{
        userId: string;
        displayName: string;
        averageScore: number;
        gamesPlayed: number;
        currentLineup: Record<PlayerRole, any>;
        rank: number;
    }>;
    byRole: {
        [K in PlayerRole]: Array<{
            playerId: string;
            nickname: string;
            teamName: string;
            averageScore: number;
            totalMatches: number;
            rank: number;
        }>;
    };
}

/**
 * Enhanced fantasy recalculation that creates optimized collections
 * for fast page loading and detailed player modals
 */
export async function recalculateAllFantasyScoresEnhanced(): Promise<{
    success: boolean;
    message: string;
    usersProcessed: number;
    playersProcessed: number;
    totalGamesAnalyzed: number;
}> {
    try {
        ensureAdminInitialized();
        const db = getAdminDb();
        
        console.log('🚀 Starting ENHANCED fantasy score recalculation...');
        
        // Step 1: Get all matches and build comprehensive game data
        const matchesRef = db.collection('matches');
        const matchesSnap = await matchesRef.get();
        
        // Data structures for processing
        const playerGamePerformances: Map<string, FantasyPlayerStats['allMatches']> = new Map();
        const userRoundData: Map<string, Map<string, any>> = new Map();
        const gamesByRound: Record<string, Array<any>> = {};
        
        console.log('📊 Analyzing all matches and player performances...');
        
        for (const matchDoc of matchesSnap.docs) {
            const matchId = matchDoc.id;
            const matchData = matchDoc.data();
            
            // Determine round
            let matchRound = matchData.group_id || matchData.roundId || matchData.round || 'group_stage';
            if (matchRound.startsWith('grupa-')) {
                matchRound = 'group_stage';
            }
            
            if (!gamesByRound[matchRound]) {
                gamesByRound[matchRound] = [];
            }
            
            // Get all games for this match
            const gamesRef = matchesRef.doc(matchId).collection('games');
            const gamesSnap = await gamesRef.get();
            
            for (const gameDoc of gamesSnap.docs) {
                const gameId = gameDoc.id;
                const gameData = gameDoc.data();
                
                gamesByRound[matchRound].push({
                    matchId,
                    gameId,
                    round: matchRound,
                    gameData,
                    matchData
                });
                
                // Get all performances for this game
                const performancesRef = gamesRef.doc(gameId).collection('performances');
                const performancesSnap = await performancesRef.get();
                
                performancesSnap.docs.forEach(perfDoc => {
                    const playerId = perfDoc.id;
                    const performance = perfDoc.data();
                    
                    // Initialize player performance array if not exists
                    if (!playerGamePerformances.has(playerId)) {
                        playerGamePerformances.set(playerId, []);
                    }
                    
                    // Create detailed performance record
                    const detailedPerformance = {
                        matchId,
                        gameId,
                        round: matchRound,
                        roundDisplayName: ROUND_DISPLAY_NAMES[matchRound] || matchRound,
                        fantasyPoints: performance.fantasyPoints || 0,
                        opponentTeam: 'TBD', // Will be filled later
                        gameDate: gameData.start_time ? new Date(gameData.start_time * 1000).toISOString() : '',
                        gameDuration: gameData.duration || 0,
                        detailedScoring: {
                            basePoints: performance.basePoints || 0,
                            kills: performance.kills || 0,
                            deaths: performance.deaths || 0,
                            assists: performance.assists || 0,
                            killPoints: performance.killPoints || 0,
                            deathPoints: performance.deathPoints || 0,
                            assistPoints: performance.assistPoints || 0,
                            bonusPoints: performance.bonusPoints || 0,
                            bonusBreakdown: performance.bonusBreakdown || {},
                            finalPoints: performance.fantasyPoints || 0
                        },
                        gameStats: {
                            kills: performance.kills || 0,
                            deaths: performance.deaths || 0,
                            assists: performance.assists || 0,
                            gpm: performance.gold_per_min || 0,
                            xpm: performance.xp_per_min || 0,
                            lastHits: performance.last_hits || 0,
                            heroDamage: performance.hero_damage || 0,
                            heroHealing: performance.hero_healing || 0,
                            towerDamage: performance.tower_damage || 0,
                            obsPlaced: performance.obs_placed || 0,
                            senPlaced: performance.sen_placed || 0,
                            netWorth: performance.net_worth || 0
                        }
                    };
                    
                    playerGamePerformances.get(playerId)!.push(detailedPerformance);
                });
            }
        }
        
        console.log('👥 Processing user lineup data...');
        
        // Step 2: Process all user lineups
        const fantasyLineupsRef = db.collection('fantasyLineups');
        const lineupsSnap = await fantasyLineupsRef.get();
        
        const userSummaries: Map<string, FantasyUserSummary> = new Map();
        const overallLeaderboard: Array<any> = [];
        
        for (const userDoc of lineupsSnap.docs) {
            const userId = userDoc.id;
            const userData = userDoc.data();
            
            // Get display name
            let displayName = userData.discordUsername || userData.displayName || "Anonymous";
            
            const userSummary: FantasyUserSummary = {
                userId,
                displayName,
                totalScore: userData.totalFantasyScore || 0,
                gamesPlayed: userData.gamesPlayed || 0,
                averageScore: userData.averageFantasyScore || 0,
                rankHistory: [],
                lineupHistory: []
            };
            
            // Get all rounds for this user
            const userRoundsRef = userDoc.ref.collection('rounds');
            const userRoundsSnap = await userRoundsRef.get();
            
            for (const roundDoc of userRoundsSnap.docs) {
                const roundId = roundDoc.id;
                const roundData = roundDoc.data();
                const lineup = roundData?.lineup || {};
                
                if (!gamesByRound[roundId]) continue;
                
                // Calculate this round's performance
                let roundScore = 0;
                let roundGames = 0;
                const playerBreakdown: any[] = [];
                
                // For each game in this round
                gamesByRound[roundId].forEach(gameInfo => {
                    let gameScore = 0;
                    let playersInGame = 0;
                    
                    // Check each player in lineup
                    Object.entries(lineup).forEach(([role, player]: [string, any]) => {
                        if (player && player.id) {
                            const playerPerfs = playerGamePerformances.get(player.id) || [];
                            const gamePerf = playerPerfs.find(p => p.gameId === gameInfo.gameId);
                            
                            if (gamePerf) {
                                gameScore += gamePerf.fantasyPoints;
                                playersInGame++;
                                
                                // Add to player breakdown
                                let existingPlayer = playerBreakdown.find(p => p.playerId === player.id);
                                if (!existingPlayer) {
                                    existingPlayer = {
                                        playerId: player.id,
                                        role: role as PlayerRole,
                                        nickname: player.nickname || 'Unknown',
                                        pointsInRound: 0,
                                        gamesInRound: 0,
                                        avgInRound: 0
                                    };
                                    playerBreakdown.push(existingPlayer);
                                }
                                existingPlayer.pointsInRound += gamePerf.fantasyPoints;
                                existingPlayer.gamesInRound++;
                                existingPlayer.avgInRound = existingPlayer.pointsInRound / existingPlayer.gamesInRound;
                            }
                        }
                    });
                    
                    if (playersInGame > 0) {
                        roundScore += gameScore;
                        roundGames += playersInGame;
                    }
                });
                
                // Add to lineup history
                userSummary.lineupHistory.push({
                    round: roundId,
                    lineup,
                    totalPoints: roundScore,
                    gamesPlayed: roundGames,
                    averageScore: roundGames > 0 ? roundScore / roundGames : 0,
                    playerBreakdown
                });
            }
            
            userSummaries.set(userId, userSummary);
            
            // Add to overall leaderboard
            if (userSummary.gamesPlayed > 0) {
                overallLeaderboard.push({
                    userId,
                    displayName,
                    averageScore: userSummary.averageScore,
                    gamesPlayed: userSummary.gamesPlayed,
                    currentLineup: userSummary.lineupHistory[userSummary.lineupHistory.length - 1]?.lineup || {},
                    rank: 0 // Will be set after sorting
                });
            }
        }
        
        // Sort and rank overall leaderboard
        overallLeaderboard.sort((a, b) => b.averageScore - a.averageScore);
        overallLeaderboard.forEach((entry, index) => {
            entry.rank = index + 1;
        });
        
        console.log('🏆 Building role-based leaderboards...');
        
        // Step 3: Build role-based leaderboards
        const roleLeaderboards: FantasyLeaderboards['byRole'] = {
            Carry: [],
            Mid: [],
            Offlane: [],
            'Soft Support': [],
            'Hard Support': []
        };
        
        // Get all players and their stats
        const playersRef = db.collection('tournamentPlayers');
        const playersSnap = await playersRef.get();
        
        for (const playerDoc of playersSnap.docs) {
            const playerId = playerDoc.id;
            const playerData = playerDoc.data();
            const role = playerData.role as PlayerRole;
            
            const playerPerfs = playerGamePerformances.get(playerId) || [];
            if (playerPerfs.length === 0) continue;
            
            const totalScore = playerPerfs.reduce((sum, perf) => sum + perf.fantasyPoints, 0);
            const averageScore = totalScore / playerPerfs.length;
            
            roleLeaderboards[role].push({
                playerId,
                nickname: playerData.nickname || 'Unknown',
                teamName: playerData.teamName || 'Unknown Team',
                averageScore,
                totalMatches: playerPerfs.length,
                rank: 0 // Will be set after sorting
            });
        }
        
        // Sort and rank each role leaderboard
        Object.keys(roleLeaderboards).forEach(role => {
            const roleKey = role as PlayerRole;
            roleLeaderboards[roleKey].sort((a, b) => b.averageScore - a.averageScore);
            roleLeaderboards[roleKey].forEach((entry, index) => {
                entry.rank = index + 1;
            });
        });
        
        console.log('💾 Saving optimized data to new collections...');
        
        // Step 4: Save all optimized data to new collections
        const batch = db.batch();
        
        // Save user summaries
        userSummaries.forEach((summary, userId) => {
            const userSummaryRef = db.collection('fantasyUserSummaries').doc(userId);
            batch.set(userSummaryRef, summary);
        });
        
        // Save player stats
        for (const [playerId, performances] of playerGamePerformances.entries()) {
            if (performances.length === 0) continue;
            
            const playerRef = db.collection('tournamentPlayers').doc(playerId);
            const playerSnap = await playerRef.get();
            
            if (playerSnap.exists) {
                const playerData = playerSnap.data()!;
                const totalScore = performances.reduce((sum, perf) => sum + perf.fantasyPoints, 0);
                
                const playerStats: FantasyPlayerStats = {
                    playerId,
                    nickname: playerData.nickname || 'Unknown',
                    role: playerData.role,
                    teamName: playerData.teamName || 'Unknown Team',
                    totalMatches: performances.length,
                    averageScore: totalScore / performances.length,
                    allMatches: performances.sort((a, b) => new Date(b.gameDate).getTime() - new Date(a.gameDate).getTime())
                };
                
                const playerStatsRef = db.collection('fantasyPlayerStats').doc(playerId);
                batch.set(playerStatsRef, playerStats);
            }
        }
        
        // Save leaderboards
        const leaderboards: FantasyLeaderboards = {
            overall: overallLeaderboard,
            byRole: roleLeaderboards
        };
        
        const leaderboardsRef = db.collection('fantasyLeaderboards').doc('data');
        batch.set(leaderboardsRef, leaderboards);
        
        // Commit all changes
        await batch.commit();
        
        console.log('✅ Enhanced fantasy recalculation complete!');
        
        return {
            success: true,
            message: `Enhanced recalculation completed successfully. Processed ${userSummaries.size} users, ${playerGamePerformances.size} players across ${Object.values(gamesByRound).flat().length} games.`,
            usersProcessed: userSummaries.size,
            playersProcessed: playerGamePerformances.size,
            totalGamesAnalyzed: Object.values(gamesByRound).flat().length
        };
        
    } catch (error) {
        console.error('❌ Enhanced fantasy recalculation failed:', error);
        return {
            success: false,
            message: `Enhanced recalculation failed: ${(error as Error).message}`,
            usersProcessed: 0,
            playersProcessed: 0,
            totalGamesAnalyzed: 0
        };
    }
}

/**
 * Get round sequence for determining next round
 */
export function getRoundSequence(): string[] {
    return [
        'initial',
        'pre_season', 
        'group_stage',
        'wildcards',
        'playoffs_round1',
        'playoffs_round2', 
        'playoffs_round3',
        'playoffs_round4',
        'playoffs_round5',
        'playoffs_round6',
        'playoffs_round7'
    ];
}

/**
 * Get the next round for lineup selection
 */
export function getNextRoundForLineup(currentRound: string): string {
    const sequence = getRoundSequence();
    const currentIndex = sequence.indexOf(currentRound);
    
    if (currentIndex === -1 || currentIndex === sequence.length - 1) {
        return currentRound;
    }
    
    return sequence[currentIndex + 1];
}