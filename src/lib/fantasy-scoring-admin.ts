import { getAdminDb, ensureAdminInitialized } from '../server/lib/admin';

export interface FantasyScoreUpdate {
    userId: string;
    roundId: string;
    oldScore: number;
    newScore: number;
    oldGamesPlayed: number;
    newGamesPlayed: number;
    playersInvolved: string[];
}

/**
 * Updates fantasy scores for all users after a specific match is completed
 * This should be called after each match import/update
 */
export async function updateFantasyScoresAfterMatch(
    matchId: string, 
    roundId: string, 
    gameId: string
): Promise<{ success: boolean; message: string; updatesCount: number }> {
    try {
        ensureAdminInitialized();
        const db = getAdminDb();
        
        console.log(`Updating fantasy scores for match ${matchId}, round ${roundId}, game ${gameId}`);
        
        // Get all player performances from this game
        const performancesRef = db.collection('matches').doc(matchId).collection('games').doc(gameId).collection('performances');
        const performancesSnap = await performancesRef.get();
        
        if (performancesSnap.empty) {
            return { success: true, message: 'No performances found for this game', updatesCount: 0 };
        }
        
        // Map playerId to fantasy points for this game
        const playerFantasyPoints: Record<string, number> = {};
        performancesSnap.docs.forEach(doc => {
            const perf = doc.data();
            playerFantasyPoints[doc.id] = perf.fantasyPoints || 0;
        });
        
        console.log(`Found ${Object.keys(playerFantasyPoints).length} player performances with fantasy points`);
        
        // Get all users who have lineups for this round
        const fantasyLineupsRef = db.collection('fantasyLineups');
        const lineupsSnap = await fantasyLineupsRef.get();
        
        let updatesCount = 0;
        const batch = db.batch();
        
        for (const userDoc of lineupsSnap.docs) {
            const userId = userDoc.id;
            
            // Get user's lineup for this specific round
            const userRoundRef = fantasyLineupsRef.doc(userId).collection('rounds').doc(roundId);
            const userRoundSnap = await userRoundRef.get();
            
            if (!userRoundSnap.exists) {
                continue; // User has no lineup for this round
            }
            
            const roundData = userRoundSnap.data();
            const lineup = roundData?.lineup || {};
            
            // Calculate fantasy points earned by this user's lineup in this game
            let userGameScore = 0;
            const playersInvolved: string[] = [];
            
            Object.values(lineup).forEach((player: any) => {
                if (player && player.id && playerFantasyPoints[player.id]) {
                    userGameScore += playerFantasyPoints[player.id];
                    playersInvolved.push(player.id);
                }
            });
            
            if (userGameScore > 0) {
                // Update user's fantasy score and games played
                const currentData = userDoc.data();
                const oldTotalScore = currentData.totalFantasyScore || 0;
                const oldGamesPlayed = currentData.gamesPlayed || 0;
                const newTotalScore = oldTotalScore + userGameScore;
                const newGamesPlayed = oldGamesPlayed + playersInvolved.length; // Count each player separately
                const averageScore = newTotalScore / newGamesPlayed;
                
                batch.update(fantasyLineupsRef.doc(userId), {
                    totalFantasyScore: newTotalScore,
                    gamesPlayed: newGamesPlayed,
                    averageFantasyScore: averageScore
                });
                
                console.log(`User ${userId}: +${userGameScore} points, ${newGamesPlayed} games, avg: ${averageScore.toFixed(2)} (${oldTotalScore} -> ${newTotalScore})`);
                updatesCount++;
            }
        }
        
        if (updatesCount > 0) {
            await batch.commit();
        }
        
        return {
            success: true,
            message: `Updated fantasy scores for ${updatesCount} users`,
            updatesCount
        };
        
    } catch (error) {
        console.error('Failed to update fantasy scores after match:', error);
        return {
            success: false,
            message: `Failed to update fantasy scores: ${(error as Error).message}`,
            updatesCount: 0
        };
    }
}

/**
 * Completely recalculates all fantasy scores for all users across all rounds
 * Now calculates average points per game for fair scoring across different game counts
 * This is useful for fixing data inconsistencies or after rule changes
 */
export async function recalculateAllFantasyScores(): Promise<{
    success: boolean;
    message: string;
    usersProcessed: number;
    roundsProcessed: string[];
    totalPointsDistributed: number;
    totalGamesPlayed: number;
}> {
    try {
        ensureAdminInitialized();
        const db = getAdminDb();
        
        console.log('Starting complete fantasy score recalculation...');
        
        // Get all matches and their games with performances
        const matchesRef = db.collection('matches');
        const matchesSnap = await matchesRef.get();
        
        // Build a map of all player fantasy points by round and game
        const fantasyPointsByRound: Record<string, Record<string, Record<string, number>>> = {};
        
        for (const matchDoc of matchesSnap.docs) {
            const matchId = matchDoc.id;
            const matchData = matchDoc.data();
            
            // Determine which round this match belongs to
            // Map all Polish group names to 'group_stage' for fantasy scoring
            let matchRound = matchData.group_id || matchData.roundId || matchData.round || 'group_stage';
            
            // Map all Polish group names to the single fantasy round
            if (matchRound.startsWith('grupa-')) {
                matchRound = 'group_stage';
            }
            
            if (!fantasyPointsByRound[matchRound]) {
                fantasyPointsByRound[matchRound] = {};
            }
            
            // Get all games for this match
            const gamesRef = matchesRef.doc(matchId).collection('games');
            const gamesSnap = await gamesRef.get();
            
            for (const gameDoc of gamesSnap.docs) {
                const gameId = gameDoc.id;
                
                // Get all performances for this game
                const performancesRef = gamesRef.doc(gameId).collection('performances');
                const performancesSnap = await performancesRef.get();
                
                performancesSnap.docs.forEach(perfDoc => {
                    const playerId = perfDoc.id;
                    const performance = perfDoc.data();
                    const fantasyPoints = performance.fantasyPoints || 0;
                    
                    if (!fantasyPointsByRound[matchRound][gameId]) {
                        fantasyPointsByRound[matchRound][gameId] = {};
                    }
                    
                    fantasyPointsByRound[matchRound][gameId][playerId] = fantasyPoints;
                });
            }
        }
        
        console.log(`Found fantasy points for rounds: ${Object.keys(fantasyPointsByRound).join(', ')}`);
        
        // Get all fantasy users
        const fantasyLineupsRef = db.collection('fantasyLineups');
        const lineupsSnap = await fantasyLineupsRef.get();
        
        let usersProcessed = 0;
        let totalPointsDistributed = 0;
        let totalGamesPlayed = 0;
        const roundsProcessed = Object.keys(fantasyPointsByRound);
        
        const batch = db.batch();
        
        for (const userDoc of lineupsSnap.docs) {
            const userId = userDoc.id;
            let userTotalScore = 0;
            let userTotalGames = 0;
            
            console.log(`Recalculating scores for user ${userId}...`);
            
            // Get all rounds for this user
            const userRoundsRef = fantasyLineupsRef.doc(userId).collection('rounds');
            const userRoundsSnap = await userRoundsRef.get();
            
            for (const roundDoc of userRoundsSnap.docs) {
                const roundId = roundDoc.id;
                const roundData = roundDoc.data();
                const lineup = roundData?.lineup || {};
                
                if (!fantasyPointsByRound[roundId]) {
                    console.log(`No fantasy data found for round ${roundId}, skipping`);
                    continue;
                }
                
                // Calculate user's score for this round
                let roundScore = 0;
                let roundGames = 0;
                
                // Go through each game in this round
                Object.entries(fantasyPointsByRound[roundId]).forEach(([gameId, gamePoints]) => {
                    let gameScore = 0;
                    let playersInThisGame = 0;
                    
                    // Check each player in user's lineup
                    Object.values(lineup).forEach((player: any) => {
                        if (player && player.id && gamePoints[player.id] !== undefined) {
                            gameScore += gamePoints[player.id];
                            playersInThisGame++;
                        }
                    });
                    
                    // Count the actual number of player-games, not just tournament games
                    if (playersInThisGame > 0) {
                        roundScore += gameScore;
                        roundGames += playersInThisGame; // Count each player separately
                    }
                });
                
                userTotalScore += roundScore;
                userTotalGames += roundGames;
                console.log(`  Round ${roundId}: ${roundScore} points in ${roundGames} games`);
            }
            
            // Calculate average score
            const averageScore = userTotalGames > 0 ? userTotalScore / userTotalGames : 0;
            
            // Update user's fantasy score data
            batch.update(fantasyLineupsRef.doc(userId), {
                totalFantasyScore: userTotalScore,
                gamesPlayed: userTotalGames,
                averageFantasyScore: averageScore
            });
            
            totalPointsDistributed += userTotalScore;
            totalGamesPlayed += userTotalGames;
            usersProcessed++;
            
            console.log(`User ${userId} total: ${userTotalScore} points in ${userTotalGames} games (avg: ${averageScore.toFixed(2)})`);
        }
        
        await batch.commit();
        
        console.log(`Fantasy score recalculation complete. ${usersProcessed} users processed.`);
        
        return {
            success: true,
            message: `Recalculated fantasy scores for ${usersProcessed} users across ${roundsProcessed.length} rounds (avg scoring enabled)`,
            usersProcessed,
            roundsProcessed,
            totalPointsDistributed,
            totalGamesPlayed
        };
        
    } catch (error) {
        console.error('Failed to recalculate all fantasy scores:', error);
        return {
            success: false,
            message: `Failed to recalculate fantasy scores: ${(error as Error).message}`,
            usersProcessed: 0,
            roundsProcessed: [],
            totalPointsDistributed: 0,
            totalGamesPlayed: 0
        };
    }
}

/**
 * Get fantasy score breakdown for a specific user
 * Useful for debugging and showing users how their score was calculated
 */
export async function getUserFantasyScoreBreakdown(userId: string): Promise<{
    success: boolean;
    breakdown: Record<string, {
        roundScore: number;
        gamesPlayed: number;
        lineup: Record<string, any>;
    }>;
    totalScore: number;
}> {
    try {
        ensureAdminInitialized();
        const db = getAdminDb();
        
        const breakdown: Record<string, {
            roundScore: number;
            gamesPlayed: number;
            lineup: Record<string, any>;
        }> = {};
        
        let totalScore = 0;
        
        // Get user's lineups for all rounds
        const userRoundsRef = db.collection('fantasyLineups').doc(userId).collection('rounds');
        const userRoundsSnap = await userRoundsRef.get();
        
        for (const roundDoc of userRoundsSnap.docs) {
            const roundId = roundDoc.id;
            const roundData = roundDoc.data();
            const lineup = roundData?.lineup || {};
            
            // Calculate score for this round (simplified version)
            // In a full implementation, you'd go through all matches for this round
            
            breakdown[roundId] = {
                roundScore: 0, // Would be calculated from actual games
                gamesPlayed: 0, // Would count actual games
                lineup
            };
        }
        
        return {
            success: true,
            breakdown,
            totalScore
        };
        
    } catch (error) {
        console.error('Failed to get user fantasy score breakdown:', error);
        return {
            success: false,
            breakdown: {},
            totalScore: 0
        };
    }
}