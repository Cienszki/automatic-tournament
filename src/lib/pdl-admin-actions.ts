// src/lib/pdl-admin-actions.ts
// PDL-specific admin actions for tournament-scoped match import

import { getAdminDb, ensureAdminInitialized } from '../server/lib/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { getLeagueId } from './definitions';
import { fetchAllSteamLeagueMatches } from './steam-api';
import { fetchOpenDotaMatch, transformMatchData, isMatchParsed, requestOpenDotaMatchParse } from './opendota';
import { calculatePDLFantasyPoints } from './pdl-fantasy-scoring';

// ============================================================================
// TYPES
// ============================================================================

interface PDLTeam {
    id: string;
    name: string;
    divisionId?: string;
    players?: PDLPlayer[];
    openDotaTeamId?: number;
}

interface PDLPlayer {
    id: string;
    nickname: string;
    steamId32: string;
    role?: string;
}

interface PDLMatch {
    id: string;
    teams: string[];
    teamA?: { id: string; name: string; score: number };
    teamB?: { id: string; name: string; score: number };
    status: 'scheduled' | 'completed' | 'live';
    divisionId?: string;
    game_ids?: number[];
}

interface SyncResult {
    success: boolean;
    message: string;
    importedCount: number;
    skippedCount?: number;
    failedCount?: number;
    unparsedCount?: number;
    error?: string;
}

// ============================================================================
// DATA FETCHERS (Tournament-Scoped)
// ============================================================================

/**
 * Get all teams for a PDL tournament
 */
export async function getPDLTeamsAdmin(tournamentId: string): Promise<PDLTeam[]> {
    ensureAdminInitialized();
    const db = getAdminDb();

    const teamsSnapshot = await db
        .collection('tournaments')
        .doc(tournamentId)
        .collection('teams')
        .get();

    const teams: PDLTeam[] = [];

    for (const teamDoc of teamsSnapshot.docs) {
        const teamData = teamDoc.data();

        // Get players subcollection
        const playersSnapshot = await teamDoc.ref.collection('players').get();
        const players: PDLPlayer[] = playersSnapshot.docs.map(p => ({
            id: p.id,
            ...p.data() as Omit<PDLPlayer, 'id'>
        }));

        teams.push({
            id: teamDoc.id,
            name: teamData.name || teamDoc.id,
            divisionId: teamData.divisionId,
            players,
            openDotaTeamId: teamData.openDotaTeamId,
        });
    }

    return teams;
}

/**
 * Get all players for a PDL tournament (flattened from teams)
 */
export async function getPDLPlayersAdmin(tournamentId: string): Promise<PDLPlayer[]> {
    const teams = await getPDLTeamsAdmin(tournamentId);
    return teams.flatMap(team => team.players || []);
}

/**
 * Get all matches for a PDL tournament
 */
export async function getPDLMatchesAdmin(tournamentId: string): Promise<PDLMatch[]> {
    ensureAdminInitialized();
    const db = getAdminDb();

    const matchesSnapshot = await db
        .collection('tournaments')
        .doc(tournamentId)
        .collection('matches')
        .get();

    return matchesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data() as Omit<PDLMatch, 'id'>
    }));
}

// ============================================================================
// PROCESSED GAMES TRACKING (Tournament-Scoped)
// ============================================================================

/**
 * Get all processed game IDs for a tournament
 */
export async function getPDLProcessedGameIdsAdmin(tournamentId: string): Promise<string[]> {
    ensureAdminInitialized();
    const db = getAdminDb();

    const snapshot = await db
        .collection('tournaments')
        .doc(tournamentId)
        .collection('processedGames')
        .get();

    return snapshot.docs.map(doc => doc.id);
}

/**
 * Mark a game as processed for a tournament
 */
export async function markPDLGameAsProcessedAdmin(
    tournamentId: string,
    gameId: string
): Promise<void> {
    ensureAdminInitialized();
    const db = getAdminDb();

    await db
        .collection('tournaments')
        .doc(tournamentId)
        .collection('processedGames')
        .doc(gameId)
        .set({
            processedAt: FieldValue.serverTimestamp(),
        });
}

/**
 * Clear all processed games for a tournament (for re-import)
 */
export async function clearPDLProcessedGamesAdmin(tournamentId: string): Promise<void> {
    ensureAdminInitialized();
    const db = getAdminDb();

    const snapshot = await db
        .collection('tournaments')
        .doc(tournamentId)
        .collection('processedGames')
        .get();

    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
}

// ============================================================================
// UNPARSED MATCHES TRACKING (Tournament-Scoped)
// ============================================================================

interface UnparsedMatchData {
    openDotaMatchId: string;
    matchId: string;
    radiantTeam: string;
    direTeam: string;
}

/**
 * Add an unparsed match to the retry queue
 */
export async function addPDLUnparsedMatchAdmin(
    tournamentId: string,
    data: UnparsedMatchData
): Promise<void> {
    ensureAdminInitialized();
    const db = getAdminDb();

    await db
        .collection('tournaments')
        .doc(tournamentId)
        .collection('unparsedMatches')
        .doc(data.openDotaMatchId)
        .set({
            ...data,
            attempts: FieldValue.increment(1),
            lastAttempt: FieldValue.serverTimestamp(),
            createdAt: FieldValue.serverTimestamp(),
        }, { merge: true });
}

/**
 * Remove an unparsed match from the queue (after successful parsing)
 */
export async function removePDLUnparsedMatchAdmin(
    tournamentId: string,
    openDotaMatchId: string
): Promise<void> {
    ensureAdminInitialized();
    const db = getAdminDb();

    await db
        .collection('tournaments')
        .doc(tournamentId)
        .collection('unparsedMatches')
        .doc(openDotaMatchId)
        .delete();
}

/**
 * Get all unparsed matches for retry
 */
export async function getPDLUnparsedMatchesAdmin(tournamentId: string): Promise<(UnparsedMatchData & { attempts: number })[]> {
    ensureAdminInitialized();
    const db = getAdminDb();

    const snapshot = await db
        .collection('tournaments')
        .doc(tournamentId)
        .collection('unparsedMatches')
        .get();

    return snapshot.docs.map(doc => ({
        openDotaMatchId: doc.id,
        ...doc.data() as Omit<UnparsedMatchData, 'openDotaMatchId'> & { attempts: number }
    }));
}

// ============================================================================
// GAME SAVING (Tournament-Scoped)
// ============================================================================

/**
 * Save game results to a PDL tournament match
 */
export async function savePDLGameResultsAdmin(
    tournamentId: string,
    matchId: string,
    game: any,
    performances: any[]
): Promise<{ success: boolean; error?: string }> {
    ensureAdminInitialized();
    const db = getAdminDb();

    const matchRef = db
        .collection('tournaments')
        .doc(tournamentId)
        .collection('matches')
        .doc(matchId);

    // Check if match exists
    const matchSnap = await matchRef.get();
    if (!matchSnap.exists) {
        console.log(`[PDL] Match ${matchId} does not exist in tournament ${tournamentId}`);
        return { success: false, error: 'Match not found' };
    }

    const batch = db.batch();
    const gameRef = matchRef.collection('games').doc(game.id);

    // Add game ID to match document
    batch.update(matchRef, {
        game_ids: FieldValue.arrayUnion(parseInt(game.id))
    });

    // Save game data
    batch.set(gameRef, game);

    // Save player performances
    performances.forEach(performance => {
        const perfRef = gameRef.collection('performances').doc(performance.playerId);
        batch.set(perfRef, performance);
    });

    await batch.commit();

    // Update match scores based on games
    await updatePDLMatchScoresAdmin(tournamentId, matchId);

    return { success: true };
}

/**
 * Update match scores based on game results
 */
async function updatePDLMatchScoresAdmin(tournamentId: string, matchId: string): Promise<void> {
    ensureAdminInitialized();
    const db = getAdminDb();

    const matchRef = db
        .collection('tournaments')
        .doc(tournamentId)
        .collection('matches')
        .doc(matchId);

    const matchDoc = await matchRef.get();
    if (!matchDoc.exists) return;

    const matchData = matchDoc.data()!;
    const gamesSnapshot = await matchRef.collection('games').get();
    const games = gamesSnapshot.docs.map(doc => doc.data());

    if (games.length === 0) return;

    const teamAId = matchData.teams?.[0] || matchData.teamA?.id;
    const teamBId = matchData.teams?.[1] || matchData.teamB?.id;

    if (!teamAId || !teamBId) return;

    let teamAWins = 0;
    let teamBWins = 0;

    games.forEach(game => {
        if (game.radiant_win) {
            if (game.radiant_team?.id === teamAId) teamAWins++;
            else if (game.radiant_team?.id === teamBId) teamBWins++;
        } else {
            if (game.dire_team?.id === teamAId) teamAWins++;
            else if (game.dire_team?.id === teamBId) teamBWins++;
        }
    });

    // BO2 format: complete after 2 games
    const isComplete = games.length >= 2;
    let winnerId = null;
    if (teamAWins > teamBWins) winnerId = teamAId;
    else if (teamBWins > teamAWins) winnerId = teamBId;
    // If tied (1-1), winnerId stays null (draw)

    const updateData: any = {
        'teamA.score': teamAWins,
        'teamB.score': teamBWins,
    };

    if (isComplete) {
        updateData.status = 'completed';
        updateData.winnerId = winnerId;
        updateData.completedAt = FieldValue.serverTimestamp();
    }

    await matchRef.update(updateData);

    // Update division standings if match is complete
    if (isComplete && matchData.divisionId) {
        await updatePDLDivisionStandingsAdmin(tournamentId, matchData.divisionId);
    }

    console.log(`[PDL] Match ${matchId} updated: ${teamAWins}-${teamBWins}, complete: ${isComplete}`);
}

/**
 * Update division standings after a match completes
 */
async function updatePDLDivisionStandingsAdmin(tournamentId: string, divisionId: string): Promise<void> {
    // TODO: Implement division standings recalculation
    // This would iterate through all completed matches in the division
    // and recalculate points, wins, draws, losses for each team
    console.log(`[PDL] Division standings update for ${divisionId} pending implementation`);
}

// ============================================================================
// MAIN SYNC FUNCTION
// ============================================================================

/**
 * Sync all new matches from Steam/OpenDota for a PDL tournament
 */
export async function syncPDLMatchesAdmin(tournamentId: string = 'pdl-s1'): Promise<SyncResult> {
    try {
        console.log(`[PDL] Starting match sync for tournament: ${tournamentId}`);

        // Get league ID for this tournament
        const leagueId = getLeagueId(tournamentId);
        console.log(`[PDL] Using league ID: ${leagueId}`);

        // Fetch all match IDs from Steam API
        const steamMatches = await fetchAllSteamLeagueMatches(leagueId);
        const steamMatchIds = steamMatches.map(m => m.match_id);
        console.log(`[PDL] Found ${steamMatchIds.length} matches in Steam league ${leagueId}`);

        if (steamMatchIds.length === 0) {
            return {
                success: true,
                message: 'No matches found in Steam league yet.',
                importedCount: 0,
            };
        }

        // Get processed game IDs
        const processedGameIds = new Set(await getPDLProcessedGameIdsAdmin(tournamentId));

        // Filter for new matches
        const newMatchIds = steamMatchIds.filter(id => !processedGameIds.has(String(id)));

        // Also get unparsed matches for retry
        const unparsedMatches = await getPDLUnparsedMatchesAdmin(tournamentId);
        const unparsedMatchIds = unparsedMatches.map(um => parseInt(um.openDotaMatchId));

        const allMatchIdsToProcess = [...new Set([...newMatchIds, ...unparsedMatchIds])];

        console.log(`[PDL] Processing: ${newMatchIds.length} new + ${unparsedMatchIds.length} unparsed retries = ${allMatchIdsToProcess.length} total`);

        if (allMatchIdsToProcess.length === 0) {
            return {
                success: true,
                message: 'Database is already up to date.',
                importedCount: 0,
            };
        }

        // Fetch teams and players
        const teams = await getPDLTeamsAdmin(tournamentId);
        const players = await getPDLPlayersAdmin(tournamentId);
        const allMatches = await getPDLMatchesAdmin(tournamentId);

        console.log(`[PDL] Loaded ${teams.length} teams, ${players.length} players, ${allMatches.length} scheduled matches`);

        // Process each match
        let importedCount = 0;
        let skippedCount = 0;
        let failedCount = 0;
        let unparsedCount = 0;

        for (const matchId of allMatchIdsToProcess) {
            const isRetry = unparsedMatchIds.includes(matchId);

            try {
                console.log(`[PDL] Processing match ${matchId}${isRetry ? ' (retry)' : ''}`);

                // Fetch from OpenDota
                const openDotaMatch = await fetchOpenDotaMatch(matchId);
                const isParsed = isMatchParsed(openDotaMatch);

                if (!isParsed) {
                    console.log(`[PDL] Match ${matchId} unparsed, requesting parse...`);
                    await requestOpenDotaMatchParse(matchId);

                    // Find matching teams for tracking
                    const radiantName = openDotaMatch.radiant_name || 'Unknown';
                    const direName = openDotaMatch.dire_name || 'Unknown';

                    await addPDLUnparsedMatchAdmin(tournamentId, {
                        openDotaMatchId: String(matchId),
                        matchId: 'pending',
                        radiantTeam: radiantName,
                        direTeam: direName,
                    });

                    unparsedCount++;
                    continue; // Skip save for now, will retry later
                }

                // Match teams by name
                const radiantTeam = teams.find(t =>
                    t.name.trim().toLowerCase() === openDotaMatch.radiant_name?.trim().toLowerCase()
                );
                const direTeam = teams.find(t =>
                    t.name.trim().toLowerCase() === openDotaMatch.dire_name?.trim().toLowerCase()
                );

                if (!radiantTeam || !direTeam) {
                    console.log(`[PDL] Teams not found: ${openDotaMatch.radiant_name} vs ${openDotaMatch.dire_name} - likely scrim`);
                    await markPDLGameAsProcessedAdmin(tournamentId, String(matchId));
                    skippedCount++;
                    continue;
                }

                // Find the scheduled match between these teams
                const existingMatch = allMatches.find(m =>
                    m.teams?.includes(radiantTeam.id) && m.teams?.includes(direTeam.id)
                );

                if (!existingMatch) {
                    console.log(`[PDL] No scheduled match found for ${radiantTeam.name} vs ${direTeam.name}`);
                    await markPDLGameAsProcessedAdmin(tournamentId, String(matchId));
                    skippedCount++;
                    continue;
                }

                // Transform match data with PDL fantasy scoring
                const { game, performances } = transformMatchData(
                    openDotaMatch,
                    teams as any[],
                    players as any[],
                    false
                );

                // Recalculate fantasy points using PDL scoring
                const updatedPerformances = performances.map((perf: any) => ({
                    ...perf,
                    fantasyPoints: calculatePDLFantasyPoints(perf,
                        (perf.teamId === radiantTeam.id && openDotaMatch.radiant_win) ||
                        (perf.teamId === direTeam.id && !openDotaMatch.radiant_win)
                    ),
                }));

                // Save to tournament-scoped collections
                const saveResult = await savePDLGameResultsAdmin(
                    tournamentId,
                    existingMatch.id,
                    game,
                    updatedPerformances
                );

                if (saveResult.success) {
                    await markPDLGameAsProcessedAdmin(tournamentId, String(matchId));

                    // Remove from unparsed queue if it was a retry
                    if (isRetry) {
                        await removePDLUnparsedMatchAdmin(tournamentId, String(matchId));
                    }

                    importedCount++;
                    console.log(`[PDL] ✅ Imported match ${matchId} to ${existingMatch.id}`);
                } else {
                    failedCount++;
                    console.log(`[PDL] ❌ Failed to save match ${matchId}: ${saveResult.error}`);
                }

            } catch (error) {
                console.error(`[PDL] Error processing match ${matchId}:`, error);
                failedCount++;
            }

            // Small delay to respect API rate limits
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        const message = `Sync complete. Imported: ${importedCount}, Skipped: ${skippedCount}, Unparsed (queued): ${unparsedCount}, Failed: ${failedCount}`;
        console.log(`[PDL] ${message}`);

        return {
            success: true,
            message,
            importedCount,
            skippedCount,
            failedCount,
            unparsedCount,
        };

    } catch (error) {
        console.error('[PDL] Sync failed:', error);
        return {
            success: false,
            message: 'Sync failed',
            error: (error as Error).message,
            importedCount: 0,
        };
    }
}

/**
 * Manually import specific match IDs for PDL
 */
export async function importPDLManualMatchesAdmin(
    tournamentId: string,
    matchIds: number[]
): Promise<SyncResult> {
    console.log(`[PDL] Manual import of ${matchIds.length} matches for ${tournamentId}`);

    // Filter out already processed matches
    const processedGameIds = new Set(await getPDLProcessedGameIdsAdmin(tournamentId));
    const newMatchIds = matchIds.filter(id => !processedGameIds.has(String(id)));

    if (newMatchIds.length === 0) {
        return {
            success: true,
            message: 'All provided matches have already been processed.',
            importedCount: 0,
        };
    }

    // Use the same sync logic but with specific match IDs
    // For simplicity, we'll just call the sync with a modified approach
    // In practice, this reuses the processing logic from syncPDLMatchesAdmin

    const teams = await getPDLTeamsAdmin(tournamentId);
    const players = await getPDLPlayersAdmin(tournamentId);
    const allMatches = await getPDLMatchesAdmin(tournamentId);

    let importedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const matchId of newMatchIds) {
        try {
            const openDotaMatch = await fetchOpenDotaMatch(matchId);
            const isParsed = isMatchParsed(openDotaMatch);

            if (!isParsed) {
                console.log(`[PDL] Match ${matchId} not parsed, requesting...`);
                await requestOpenDotaMatchParse(matchId);
                await addPDLUnparsedMatchAdmin(tournamentId, {
                    openDotaMatchId: String(matchId),
                    matchId: 'pending',
                    radiantTeam: openDotaMatch.radiant_name || 'Unknown',
                    direTeam: openDotaMatch.dire_name || 'Unknown',
                });
                skippedCount++;
                continue;
            }

            const radiantTeam = teams.find(t =>
                t.name.trim().toLowerCase() === openDotaMatch.radiant_name?.trim().toLowerCase()
            );
            const direTeam = teams.find(t =>
                t.name.trim().toLowerCase() === openDotaMatch.dire_name?.trim().toLowerCase()
            );

            if (!radiantTeam || !direTeam) {
                await markPDLGameAsProcessedAdmin(tournamentId, String(matchId));
                skippedCount++;
                continue;
            }

            const existingMatch = allMatches.find(m =>
                m.teams?.includes(radiantTeam.id) && m.teams?.includes(direTeam.id)
            );

            if (!existingMatch) {
                await markPDLGameAsProcessedAdmin(tournamentId, String(matchId));
                skippedCount++;
                continue;
            }

            const { game, performances } = transformMatchData(
                openDotaMatch,
                teams as any[],
                players as any[],
                false
            );

            const updatedPerformances = performances.map((perf: any) => ({
                ...perf,
                fantasyPoints: calculatePDLFantasyPoints(perf,
                    (perf.teamId === radiantTeam.id && openDotaMatch.radiant_win) ||
                    (perf.teamId === direTeam.id && !openDotaMatch.radiant_win)
                ),
            }));

            const saveResult = await savePDLGameResultsAdmin(
                tournamentId,
                existingMatch.id,
                game,
                updatedPerformances
            );

            if (saveResult.success) {
                await markPDLGameAsProcessedAdmin(tournamentId, String(matchId));
                importedCount++;
            } else {
                failedCount++;
            }

        } catch (error) {
            console.error(`[PDL] Error importing match ${matchId}:`, error);
            failedCount++;
        }

        await new Promise(resolve => setTimeout(resolve, 500));
    }

    return {
        success: true,
        message: `Manual import complete. Imported: ${importedCount}, Skipped: ${skippedCount}, Failed: ${failedCount}`,
        importedCount,
        skippedCount,
        failedCount,
    };
}
