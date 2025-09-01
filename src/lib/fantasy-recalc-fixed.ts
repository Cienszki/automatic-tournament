import { getAdminDb, ensureAdminInitialized } from '../server/lib/admin';

export interface PlayerRoundStats {
    playerId: string;
    roundId: string;
    totalFantasyPoints: number;
    gamesPlayed: number;
    averageFantasyScore: number;
    gameBreakdown: Array<{
        gameId: string;
        matchId: string;
        fantasyPoints: number;
        gameDate: string;
    }>;
}

export interface UserRoundScore {
    userId: string;
    roundId: string;
    totalPoints: number;
    totalPlayerGames: number;
    averageScore: number;
    lineupBreakdown: Array<{
        playerId: string;
        playerNickname: string;
        role: string;
        playerPoints: number;
        playerGames: number;
    }>;
    calculatedAt: string;
}

export interface UserTotalScore {
    userId: string;
    displayName: string;
    totalFantasyScore: number;
    totalPlayerGames: number;
    averageFantasyScore: number;
    roundScores: Record<string, UserRoundScore>;
    lastCalculatedAt: string;
}

/**
 * Phase 1: Calculate player round statistics
 * Pre-computes each player's total points and games per round
 */
export async function calculatePlayerRoundStats(): Promise<{
    success: boolean;
    message: string;
    playersProcessed: number;
    roundsProcessed: string[];
}> {
    try {
        ensureAdminInitialized();
        const db = getAdminDb();
        
        console.log('🔄 Starting Phase 1: Player Round Stats Calculation...');
        
        // Get all matches and build round-game mapping
        const matchesRef = db.collection('matches');
        const matchesSnap = await matchesRef.get();
        
        const playerRoundStats = new Map<string, Map<string, PlayerRoundStats>>();
        const roundsFound = new Set<string>();
        
        for (const matchDoc of matchesSnap.docs) {
            const matchId = matchDoc.id;
            const matchData = matchDoc.data();
            
            // Normalize round ID (map Polish groups to group_stage)
            let roundId = matchData.group_id || matchData.roundId || matchData.round || 'group_stage';
            if (roundId.startsWith('grupa-')) {
                roundId = 'group_stage';
            }
            
            roundsFound.add(roundId);
            
            // Get all games for this match
            const gamesRef = matchesRef.doc(matchId).collection('games');
            const gamesSnap = await gamesRef.get();
            
            for (const gameDoc of gamesSnap.docs) {
                const gameId = gameDoc.id;
                const gameData = gameDoc.data();
                const gameDate = gameData.start_time ? 
                    new Date(gameData.start_time * 1000).toISOString() : 
                    new Date().toISOString();
                
                // Get all performances for this game
                const performancesRef = gamesRef.doc(gameId).collection('performances');
                const performancesSnap = await performancesRef.get();
                
                for (const perfDoc of performancesSnap.docs) {
                    const playerId = perfDoc.id;
                    const performance = perfDoc.data();
                    const fantasyPoints = performance.fantasyPoints || 0;
                    
                    // Initialize player structure if needed
                    if (!playerRoundStats.has(playerId)) {
                        playerRoundStats.set(playerId, new Map());
                    }
                    
                    if (!playerRoundStats.get(playerId)!.has(roundId)) {
                        playerRoundStats.get(playerId)!.set(roundId, {
                            playerId,
                            roundId,
                            totalFantasyPoints: 0,
                            gamesPlayed: 0,
                            averageFantasyScore: 0,
                            gameBreakdown: []
                        });
                    }
                    
                    const playerRound = playerRoundStats.get(playerId)!.get(roundId)!;
                    
                    // Add this game's data
                    playerRound.totalFantasyPoints += fantasyPoints;
                    playerRound.gamesPlayed += 1;
                    playerRound.gameBreakdown.push({
                        gameId,
                        matchId,
                        fantasyPoints,
                        gameDate
                    });
                    
                    // Calculate average
                    playerRound.averageFantasyScore = playerRound.totalFantasyPoints / playerRound.gamesPlayed;
                }
            }
        }
        
        console.log(`📊 Found ${playerRoundStats.size} players across ${roundsFound.size} rounds`);
        
        // Save all player round stats to database
        const batch = db.batch();
        let batchCount = 0;
        const maxBatchSize = 400;
        
        for (const [playerId, playerRounds] of playerRoundStats.entries()) {
            for (const [roundId, stats] of playerRounds.entries()) {
                const docRef = db.collection('playerRoundStats').doc(`${playerId}_${roundId}`);
                batch.set(docRef, stats);
                batchCount++;
                
                // Commit batch if approaching limit
                if (batchCount >= maxBatchSize) {
                    await batch.commit();
                    console.log(`💾 Committed batch of ${batchCount} player round stats`);
                    batchCount = 0;
                    // Start new batch
                    const newBatch = db.batch();
                    Object.setPrototypeOf(batch, Object.getPrototypeOf(newBatch));
                    Object.assign(batch, newBatch);
                }
            }
        }
        
        // Commit remaining items
        if (batchCount > 0) {
            await batch.commit();
            console.log(`💾 Committed final batch of ${batchCount} player round stats`);
        }
        
        return {
            success: true,
            message: `Player round stats calculated for ${playerRoundStats.size} players`,
            playersProcessed: playerRoundStats.size,
            roundsProcessed: Array.from(roundsFound)
        };
        
    } catch (error) {
        console.error('❌ Failed to calculate player round stats:', error);
        return {
            success: false,
            message: `Failed: ${(error as Error).message}`,
            playersProcessed: 0,
            roundsProcessed: []
        };
    }
}

/**
 * Phase 2: Calculate user round scores based on pre-computed player stats
 */
export async function calculateUserRoundScores(): Promise<{
    success: boolean;
    message: string;
    usersProcessed: number;
    roundsProcessed: string[];
}> {
    try {
        ensureAdminInitialized();
        const db = getAdminDb();
        
        console.log('🔄 Starting Phase 2: User Round Scores Calculation...');
        
        // Get all fantasy lineups
        const fantasyLineupsRef = db.collection('fantasyLineups');
        const lineupsSnap = await fantasyLineupsRef.get();
        
        const userTotalScores = new Map<string, UserTotalScore>();
        const roundsProcessed = new Set<string>();
        
        for (const userDoc of lineupsSnap.docs) {
            const userId = userDoc.id;
            const userData = userDoc.data();
            const displayName = userData.discordUsername || userData.displayName || "Anonymous";
            
            console.log(`👤 Processing user: ${displayName} (${userId})`);
            
            const userTotal: UserTotalScore = {
                userId,
                displayName,
                totalFantasyScore: 0,
                totalPlayerGames: 0,
                averageFantasyScore: 0,
                roundScores: {},
                lastCalculatedAt: new Date().toISOString()
            };
            
            // Get all rounds for this user
            const userRoundsRef = userDoc.ref.collection('rounds');
            const userRoundsSnap = await userRoundsRef.get();
            
            for (const roundDoc of userRoundsSnap.docs) {
                const roundId = roundDoc.id;
                const roundData = roundDoc.data();
                const lineup = roundData?.lineup || {};
                
                roundsProcessed.add(roundId);
                
                console.log(`  📅 Processing round: ${roundId}`);
                
                const userRoundScore: UserRoundScore = {
                    userId,
                    roundId,
                    totalPoints: 0,
                    totalPlayerGames: 0,
                    averageScore: 0,
                    lineupBreakdown: [],
                    calculatedAt: new Date().toISOString()
                };
                
                // Process each player in the lineup
                for (const [role, player] of Object.entries(lineup)) {
                    if (!player || typeof player !== 'object' || !(player as any).id) {
                        continue;
                    }
                    
                    const playerId = (player as any).id;
                    const playerNickname = (player as any).nickname || 'Unknown';
                    
                    // Get pre-calculated player stats for this round
                    const playerStatsRef = db.collection('playerRoundStats').doc(`${playerId}_${roundId}`);
                    const playerStatsSnap = await playerStatsRef.get();
                    
                    if (playerStatsSnap.exists) {
                        const playerStats = playerStatsSnap.data() as PlayerRoundStats;
                        
                        userRoundScore.totalPoints += playerStats.totalFantasyPoints;
                        userRoundScore.totalPlayerGames += playerStats.gamesPlayed;
                        
                        userRoundScore.lineupBreakdown.push({
                            playerId,
                            playerNickname,
                            role,
                            playerPoints: playerStats.totalFantasyPoints,
                            playerGames: playerStats.gamesPlayed
                        });
                        
                        console.log(`    🎮 ${playerNickname} (${role}): ${playerStats.totalFantasyPoints} pts in ${playerStats.gamesPlayed} games`);
                    } else {
                        console.log(`    ⚠️ No stats found for ${playerNickname} in ${roundId}`);
                        userRoundScore.lineupBreakdown.push({
                            playerId,
                            playerNickname,
                            role,
                            playerPoints: 0,
                            playerGames: 0
                        });
                    }
                }
                
                // Calculate round average
                userRoundScore.averageScore = userRoundScore.totalPlayerGames > 0 ? 
                    userRoundScore.totalPoints / userRoundScore.totalPlayerGames : 0;
                
                // Add to user totals
                userTotal.totalFantasyScore += userRoundScore.totalPoints;
                userTotal.totalPlayerGames += userRoundScore.totalPlayerGames;
                userTotal.roundScores[roundId] = userRoundScore;
                
                console.log(`  📊 Round ${roundId} total: ${userRoundScore.totalPoints} pts in ${userRoundScore.totalPlayerGames} player-games (avg: ${userRoundScore.averageScore.toFixed(2)})`);
            }
            
            // Calculate overall average
            userTotal.averageFantasyScore = userTotal.totalPlayerGames > 0 ? 
                userTotal.totalFantasyScore / userTotal.totalPlayerGames : 0;
            
            userTotalScores.set(userId, userTotal);
            
            console.log(`✅ ${displayName} total: ${userTotal.totalFantasyScore} pts in ${userTotal.totalPlayerGames} player-games (avg: ${userTotal.averageFantasyScore.toFixed(2)})`);
        }
        
        console.log('💾 Saving user round scores to database...');
        
        // Save all user data to database
        const batch = db.batch();
        let batchCount = 0;
        const maxBatchSize = 400;
        
        for (const [userId, userTotal] of userTotalScores.entries()) {
            // Save user total score
            const userTotalRef = db.collection('fantasyUserTotals').doc(userId);
            batch.set(userTotalRef, userTotal);
            batchCount++;
            
            // Save each round score separately for easy querying
            for (const [roundId, roundScore] of Object.entries(userTotal.roundScores)) {
                const roundScoreRef = db.collection('fantasyUserRoundScores').doc(`${userId}_${roundId}`);
                batch.set(roundScoreRef, roundScore);
                batchCount++;
            }
            
            // Update the original fantasyLineups document with corrected totals
            const fantasyLineupRef = db.collection('fantasyLineups').doc(userId);
            batch.update(fantasyLineupRef, {
                totalFantasyScore: userTotal.totalFantasyScore,
                gamesPlayed: userTotal.totalPlayerGames,
                averageFantasyScore: userTotal.averageFantasyScore,
                lastRecalculatedAt: userTotal.lastCalculatedAt
            });
            batchCount++;
            
            // Commit batch if approaching limit
            if (batchCount >= maxBatchSize) {
                await batch.commit();
                console.log(`💾 Committed batch of ${batchCount} user scores`);
                batchCount = 0;
                // Start new batch
                const newBatch = db.batch();
                Object.setPrototypeOf(batch, Object.getPrototypeOf(newBatch));
                Object.assign(batch, newBatch);
            }
        }
        
        // Commit remaining items
        if (batchCount > 0) {
            await batch.commit();
            console.log(`💾 Committed final batch of ${batchCount} user scores`);
        }
        
        return {
            success: true,
            message: `User scores calculated for ${userTotalScores.size} users across ${roundsProcessed.size} rounds`,
            usersProcessed: userTotalScores.size,
            roundsProcessed: Array.from(roundsProcessed)
        };
        
    } catch (error) {
        console.error('❌ Failed to calculate user round scores:', error);
        return {
            success: false,
            message: `Failed: ${(error as Error).message}`,
            usersProcessed: 0,
            roundsProcessed: []
        };
    }
}

/**
 * Phase 3: Generate leaderboards from stored user data
 */
export async function generateLeaderboards(): Promise<{
    success: boolean;
    message: string;
    leaderboards: any;
}> {
    try {
        ensureAdminInitialized();
        const db = getAdminDb();
        
        console.log('🏆 Generating leaderboards from stored data...');
        
        // Get all user totals
        const userTotalsRef = db.collection('fantasyUserTotals');
        const userTotalsSnap = await userTotalsRef.get();
        
        const overallLeaderboard = [];
        
        for (const userDoc of userTotalsSnap.docs) {
            const userTotal = userDoc.data() as UserTotalScore;
            
            if (userTotal.totalPlayerGames > 0) {
                overallLeaderboard.push({
                    userId: userTotal.userId,
                    displayName: userTotal.displayName,
                    totalScore: userTotal.totalFantasyScore,
                    playerGames: userTotal.totalPlayerGames,
                    averageScore: userTotal.averageFantasyScore,
                    rank: 0 // Will be set after sorting
                });
            }
        }
        
        // Sort by average score descending
        overallLeaderboard.sort((a, b) => b.averageScore - a.averageScore);
        
        // Assign ranks
        overallLeaderboard.forEach((entry, index) => {
            entry.rank = index + 1;
        });
        
        // Generate role-based leaderboards from player stats
        const playerStatsRef = db.collection('playerRoundStats');
        const playerStatsSnap = await playerStatsRef.get();
        
        const playerRoleStats = new Map<string, Map<string, {
            totalPoints: number;
            totalGames: number;
            averageScore: number;
            nickname: string;
            role: string;
            teamName: string;
        }>>();
        
        // Aggregate player stats across all rounds
        for (const statsDoc of playerStatsSnap.docs) {
            const stats = statsDoc.data() as PlayerRoundStats;
            const playerId = stats.playerId;
            
            if (!playerRoleStats.has(playerId)) {
                // Get player info
                const playerRef = db.collection('tournamentPlayers').doc(playerId);
                const playerSnap = await playerRef.get();
                
                if (playerSnap.exists) {
                    const playerData = playerSnap.data()!;
                    playerRoleStats.set(playerId, new Map([
                        ['total', {
                            totalPoints: 0,
                            totalGames: 0,
                            averageScore: 0,
                            nickname: playerData.nickname || 'Unknown',
                            role: playerData.role || 'Unknown',
                            teamName: playerData.teamName || 'Unknown'
                        }]
                    ]));
                }
            }
            
            if (playerRoleStats.has(playerId)) {
                const playerTotal = playerRoleStats.get(playerId)!.get('total')!;
                playerTotal.totalPoints += stats.totalFantasyPoints;
                playerTotal.totalGames += stats.gamesPlayed;
                playerTotal.averageScore = playerTotal.totalPoints / playerTotal.totalGames;
            }
        }
        
        // Build role leaderboards
        const roleLeaderboards: Record<string, any[]> = {
            'Carry': [],
            'Mid': [],
            'Offlane': [],
            'Soft Support': [],
            'Hard Support': []
        };
        
        for (const [playerId, playerMap] of playerRoleStats.entries()) {
            const playerTotal = playerMap.get('total')!;
            
            if (playerTotal.totalGames > 0 && roleLeaderboards[playerTotal.role]) {
                roleLeaderboards[playerTotal.role].push({
                    playerId,
                    nickname: playerTotal.nickname,
                    teamName: playerTotal.teamName,
                    averageScore: playerTotal.averageScore,
                    totalMatches: playerTotal.totalGames,
                    rank: 0
                });
            }
        }
        
        // Sort and rank each role
        Object.keys(roleLeaderboards).forEach(role => {
            roleLeaderboards[role].sort((a, b) => b.averageScore - a.averageScore);
            roleLeaderboards[role].forEach((entry, index) => {
                entry.rank = index + 1;
            });
        });
        
        const leaderboards = {
            overall: overallLeaderboard,
            byRole: roleLeaderboards,
            generatedAt: new Date().toISOString()
        };
        
        // Save leaderboards
        const leaderboardRef = db.collection('fantasyLeaderboards').doc('current');
        await leaderboardRef.set(leaderboards);
        
        console.log(`🏆 Generated leaderboards: ${overallLeaderboard.length} overall, ${Object.values(roleLeaderboards).flat().length} role entries`);
        
        return {
            success: true,
            message: `Leaderboards generated successfully`,
            leaderboards
        };
        
    } catch (error) {
        console.error('❌ Failed to generate leaderboards:', error);
        return {
            success: false,
            message: `Failed: ${(error as Error).message}`,
            leaderboards: null
        };
    }
}

/**
 * Complete recalculation: Run all phases in sequence
 */
export async function completeFantasyRecalculation(): Promise<{
    success: boolean;
    message: string;
    phases: {
        playerStats: any;
        userScores: any;
        leaderboards: any;
    };
}> {
    try {
        console.log('🚀 Starting COMPLETE fantasy recalculation (fixed algorithm)...');
        
        // Phase 1: Player round stats
        const playerStatsResult = await calculatePlayerRoundStats();
        if (!playerStatsResult.success) {
            throw new Error(`Phase 1 failed: ${playerStatsResult.message}`);
        }
        
        // Phase 2: User round scores  
        const userScoresResult = await calculateUserRoundScores();
        if (!userScoresResult.success) {
            throw new Error(`Phase 2 failed: ${userScoresResult.message}`);
        }
        
        // Phase 3: Generate leaderboards
        const leaderboardsResult = await generateLeaderboards();
        if (!leaderboardsResult.success) {
            throw new Error(`Phase 3 failed: ${leaderboardsResult.message}`);
        }
        
        console.log('✅ Complete fantasy recalculation finished successfully!');
        
        return {
            success: true,
            message: `Complete recalculation successful: ${playerStatsResult.playersProcessed} players, ${userScoresResult.usersProcessed} users processed`,
            phases: {
                playerStats: playerStatsResult,
                userScores: userScoresResult,
                leaderboards: leaderboardsResult
            }
        };
        
    } catch (error) {
        console.error('❌ Complete fantasy recalculation failed:', error);
        return {
            success: false,
            message: `Complete recalculation failed: ${(error as Error).message}`,
            phases: {
                playerStats: null,
                userScores: null,
                leaderboards: null
            }
        };
    }
}