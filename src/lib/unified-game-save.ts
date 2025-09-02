// src/lib/unified-game-save.ts
/**
 * Unified Game Save Functions
 * 
 * This module provides consistent game saving functionality across all import methods.
 * All match import processes should use these functions to ensure data consistency.
 */

import type { Game, PlayerPerformanceInGame } from './definitions';

/**
 * Server-side unified game save function using Admin SDK
 * This is the authoritative implementation that all server-side imports should use
 */
export async function saveGameResultsUnifiedAdmin(
    matchId: string, 
    game: Game, 
    performances: PlayerPerformanceInGame[],
    options?: {
        skipPostProcessing?: boolean;
        skipFantasyUpdates?: boolean;
        logPrefix?: string;
    }
): Promise<void> {
    const logPrefix = options?.logPrefix || '[UnifiedGameSave]';
    console.log(`${logPrefix} Starting unified save for game ${game.id} in match ${matchId}`);
    
    // Dynamic imports to avoid circular dependencies and ensure server-side compatibility
    const { getAdminDb, ensureAdminInitialized } = await import('../../server/lib/admin');
    const { FieldValue } = await import('firebase-admin/firestore');
    
    ensureAdminInitialized();
    const db = getAdminDb();

    const matchRef = db.collection("matches").doc(matchId);
    
    // Check if the match document exists
    const matchSnap = await matchRef.get();
    if (!matchSnap.exists) {
        console.log(`${logPrefix} Match document ${matchId} does not exist. This might be a scrim or practice game - skipping save.`);
        return;
    }

    console.log(`${logPrefix} Match document exists, proceeding with save...`);
    
    const batch = db.batch();
    const gameRef = matchRef.collection("games").doc(game.id);

    // 1. Add the new game ID to the main match document
    batch.update(matchRef, {
        game_ids: FieldValue.arrayUnion(parseInt(game.id))
    });
    console.log(`${logPrefix} Added game ID ${game.id} to match document`);

    // 2. Set the data for the new game document
    batch.set(gameRef, game);
    console.log(`${logPrefix} Set game document with keys: ${Object.keys(game).join(', ')}`);

    // 3. Set the performance data for each player in a subcollection
    performances.forEach(performance => {
        const performanceRef = gameRef.collection("performances").doc(performance.playerId);
        batch.set(performanceRef, performance);
    });
    console.log(`${logPrefix} Added ${performances.length} player performances`);

    // Commit the batch
    await batch.commit();
    console.log(`${logPrefix} Successfully committed game data to Firestore`);

    // 4. Run post-processing steps (unless explicitly skipped)
    if (!options?.skipPostProcessing) {
        console.log(`${logPrefix} Running post-processing steps...`);
        
        try {
            // Update match scores and standings
            const { recalculateMatchScoresAdmin } = await import('./admin-match-actions-server');
            await recalculateMatchScoresAdmin(matchId);
            console.log(`${logPrefix} Recalculated match scores and standings`);
        } catch (recalcError) {
            console.error(`${logPrefix} Failed to recalculate scores:`, recalcError);
            // Don't fail the entire operation
        }

        // Update fantasy scores (unless explicitly skipped)
        if (!options?.skipFantasyUpdates) {
            try {
                const { updateFantasyScoresAfterMatch } = await import('./fantasy-scoring-admin');
                const matchData = matchSnap.data();
                const roundId = matchData?.group_id || matchData?.roundId || 'group_stage';
                
                const result = await updateFantasyScoresAfterMatch(matchId, roundId, game.id);
                if (result.success) {
                    console.log(`${logPrefix} Updated fantasy scores: ${result.message}`);
                } else {
                    console.warn(`${logPrefix} Fantasy score update had issues: ${result.message}`);
                }
            } catch (fantasyError) {
                console.error(`${logPrefix} Failed to update fantasy scores:`, fantasyError);
                // Don't fail the entire operation
            }
        }

        // Run comprehensive post-sync recalculations
        try {
            const { runAllPostSyncRecalculations } = await import('./post-sync-recalculations');
            const recalcResult = await runAllPostSyncRecalculations();
            
            if (recalcResult.success) {
                console.log(`${logPrefix} Post-sync recalculations completed: ${recalcResult.message}`);
            } else {
                console.warn(`${logPrefix} Post-sync recalculations had issues: ${recalcResult.message}`);
            }
        } catch (postSyncError) {
            console.error(`${logPrefix} Failed to run post-sync recalculations:`, postSyncError);
            // Don't fail the entire operation
        }
    }

    console.log(`${logPrefix} Unified game save completed successfully`);
}

/**
 * Client-side unified game save function
 * This wraps the existing client-side implementation for consistency
 */
export async function saveGameResultsUnifiedClient(
    matchId: string, 
    game: Game, 
    performances: PlayerPerformanceInGame[]
): Promise<void> {
    console.log('[UnifiedGameSave-Client] Starting client-side save for game', game.id);
    
    // Use existing client-side implementation
    const { saveGameResults } = await import('./firestore');
    await saveGameResults(matchId, game, performances);
    
    console.log('[UnifiedGameSave-Client] Client-side save completed');
}

/**
 * Universal wrapper that detects environment and uses appropriate function
 */
export async function saveGameResultsUnified(
    matchId: string, 
    game: Game, 
    performances: PlayerPerformanceInGame[],
    options?: {
        skipPostProcessing?: boolean;
        skipFantasyUpdates?: boolean;
        logPrefix?: string;
        forceServerSide?: boolean;
    }
): Promise<void> {
    // Detect if we're in a server-side environment
    const isServerSide = typeof window === 'undefined' || options?.forceServerSide;
    
    if (isServerSide) {
        await saveGameResultsUnifiedAdmin(matchId, game, performances, options);
    } else {
        await saveGameResultsUnifiedClient(matchId, game, performances);
    }
}

/**
 * Validation function to ensure data integrity before saving
 */
export function validateGameData(game: Game, performances: PlayerPerformanceInGame[]): {
    isValid: boolean;
    errors: string[];
} {
    const errors: string[] = [];

    // Validate game object
    if (!game.id) errors.push('Game ID is required');
    if (!game.duration || game.duration <= 0) errors.push('Game duration must be positive');
    if (typeof game.radiant_win !== 'boolean') errors.push('radiant_win must be boolean');

    // Validate performances
    if (!Array.isArray(performances) || performances.length === 0) {
        errors.push('Performances array is required and must not be empty');
    } else {
        performances.forEach((perf, index) => {
            if (!perf.playerId) errors.push(`Performance ${index}: playerId is required`);
            if (!perf.teamId) errors.push(`Performance ${index}: teamId is required`);
            if (typeof perf.fantasyPoints !== 'number') errors.push(`Performance ${index}: fantasyPoints must be a number`);
            if (typeof perf.kills !== 'number' || perf.kills < 0) errors.push(`Performance ${index}: kills must be non-negative number`);
            if (typeof perf.deaths !== 'number' || perf.deaths < 0) errors.push(`Performance ${index}: deaths must be non-negative number`);
            if (typeof perf.assists !== 'number' || perf.assists < 0) errors.push(`Performance ${index}: assists must be non-negative number`);
        });
    }

    // Check if this appears to be a practice/scrim game that shouldn't be saved
    const practiceGameCheck = isPracticeGame(game, performances);
    if (!practiceGameCheck.isValid) {
        errors.push(...practiceGameCheck.errors);
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Detects practice/scrim games that should not be saved to avoid cluttering tournament data.
 * Based on analysis of problematic matches like game 8437261734.
 */
export function isPracticeGame(game: Game, performances: PlayerPerformanceInGame[]): {
    isValid: boolean;
    errors: string[];
} {
    const errors: string[] = [];
    
    // Get total stats across all players
    const totalKills = performances.reduce((sum, p) => sum + (p.kills || 0), 0);
    const totalDeaths = performances.reduce((sum, p) => sum + (p.deaths || 0), 0);
    const totalAssists = performances.reduce((sum, p) => sum + (p.assists || 0), 0);
    const totalLastHits = performances.reduce((sum, p) => sum + ((p as any).last_hits || 0), 0);
    const totalHeroDamage = performances.reduce((sum, p) => sum + ((p as any).hero_damage || 0), 0);
    
    // Check for extremely low engagement (likely practice/AFK game)
    if (totalKills === 0 && totalDeaths === 0 && totalAssists === 0) {
        errors.push('Match appears to be a practice game: No kills, deaths, or assists recorded');
    }
    
    // Check for abnormally low activity relative to game duration
    const gameDurationMinutes = game.duration / 60;
    const killsPerMinute = totalKills / gameDurationMinutes;
    
    // For games longer than 15 minutes, expect at least some engagement
    if (gameDurationMinutes > 15 && killsPerMinute < 0.1) {
        errors.push(`Match appears to be a practice game: Very low activity (${killsPerMinute.toFixed(2)} kills/min) for ${Math.round(gameDurationMinutes)}min game`);
    }
    
    // Check if all players have identical or extremely low stats (bot/practice scenario)
    if (performances.length >= 8) { // At least 8 players for meaningful check
        const uniqueKills = new Set(performances.map(p => p.kills || 0));
        const uniqueDeaths = new Set(performances.map(p => p.deaths || 0));
        const uniqueAssists = new Set(performances.map(p => p.assists || 0));
        
        // If all players have identical low stats, likely a practice game
        if (uniqueKills.size <= 2 && uniqueDeaths.size <= 2 && uniqueAssists.size <= 2 && totalKills <= 3) {
            errors.push('Match appears to be a practice game: All players have nearly identical low stats');
        }
    }
    
    // Check for extremely low hero damage in longer games
    if (gameDurationMinutes > 20 && totalHeroDamage < 10000) {
        errors.push(`Match appears to be a practice game: Very low total hero damage (${totalHeroDamage}) for ${Math.round(gameDurationMinutes)}min game`);
    }
    
    // Check for very short games that might be connection tests
    if (gameDurationMinutes < 5 && totalKills + totalDeaths + totalAssists < 5) {
        errors.push('Match appears to be a practice game: Very short duration with minimal activity');
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Safe wrapper that validates data before saving
 */
export async function saveGameResultsUnifiedSafe(
    matchId: string, 
    game: Game, 
    performances: PlayerPerformanceInGame[],
    options?: {
        skipPostProcessing?: boolean;
        skipFantasyUpdates?: boolean;
        logPrefix?: string;
        forceServerSide?: boolean;
    }
): Promise<{ success: boolean; errors?: string[] }> {
    const logPrefix = options?.logPrefix || '[UnifiedGameSave-Safe]';
    
    try {
        // Validate data first
        const validation = validateGameData(game, performances);
        if (!validation.isValid) {
            console.error(`${logPrefix} Data validation failed:`, validation.errors);
            return { success: false, errors: validation.errors };
        }

        // Save the data
        await saveGameResultsUnified(matchId, game, performances, options);
        
        console.log(`${logPrefix} Game save completed successfully`);
        return { success: true };
        
    } catch (error) {
        console.error(`${logPrefix} Game save failed:`, error);
        return { 
            success: false, 
            errors: [`Save failed: ${(error as Error).message}`] 
        };
    }
}