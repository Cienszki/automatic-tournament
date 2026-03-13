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
    /** steamId64 — present on new-architecture pointer-only subcollection docs */
    steamId?: string;
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
/**
 * Derive a Steam32 string from a Steam64 string.
 * Returns the input unchanged if it is already ≤10 digits (already Steam32).
 * Returns null if conversion fails.
 */
function deriveSteam32FromSteam64(steam64: string): string | null {
    if (!steam64) return null;
    // Already looks like a Steam32 ID (≤10 digits) — keep as-is
    if (steam64.length <= 10 && /^\d+$/.test(steam64)) return steam64;
    try {
        const result = String(BigInt(steam64) - 76561197960265728n);
        return result.length > 0 ? result : null;
    } catch {
        return null;
    }
}

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

        // Prefer the embedded roster map (new architecture) — it has nickname + steamId32.
        // Fall back to reading the player subcollection for legacy teams without a roster map.
        const rosterMap = teamData.roster as Record<string, { nickname: string; role?: string; steamId32: string; steamId?: string }> | undefined;

        let players: PDLPlayer[];
        if (rosterMap && Object.keys(rosterMap).length > 0) {
            // Build PDLPlayer array from roster map keyed by steamId64.
            // Derive steamId32 from the map key (steamId64) when the stored value is
            // missing or accidentally contains a Steam64 ID (>10 digits) — a data-entry
            // mistake that would silently break the player-based team-identification fallback.
            players = Object.entries(rosterMap).map(([steamId64, info]) => {
                let steamId32 = info.steamId32 || '';
                if (!steamId32 || steamId32.length > 10) {
                    const derived = deriveSteam32FromSteam64(steamId32 || steamId64);
                    if (derived) {
                        if (steamId32.length > 10) {
                            console.warn(`[getPDLTeamsAdmin] roster entry for ${steamId64} had steamId32="${steamId32}" (looks like Steam64) — derived correct value "${derived}"`);
                        }
                        steamId32 = derived;
                    }
                }
                return {
                    id: steamId64,
                    nickname: info.nickname || '',
                    steamId32,
                    steamId: steamId64,
                    role: info.role,
                };
            });
        } else {
            // Legacy fallback: read player subcollection.
            // For new pointer-only docs, `p.data()` has { steamId, steamId32, role }.
            // If steamId32 is missing or wrong, derive it from the doc ID (= steamId64)
            // or the steamId field so the player-based team-identification fallback works.
            const playersSnapshot = await teamDoc.ref.collection('players').get();
            players = playersSnapshot.docs.map(p => {
                const data = p.data();
                let steamId32: string = data.steamId32 || '';
                if (!steamId32 || steamId32.length > 10) {
                    // Try steamId field first (stored as Steam64), then fall back to doc ID
                    const steam64Source = data.steamId || data.steamId64 || (p.id.length >= 17 ? p.id : '');
                    const derived = deriveSteam32FromSteam64(steamId32 || steam64Source);
                    if (derived) {
                        if (steamId32.length > 10) {
                            console.warn(`[getPDLTeamsAdmin] player doc ${p.id} had steamId32="${steamId32}" (looks like Steam64) — derived correct value "${derived}"`);
                        }
                        steamId32 = derived;
                    }
                }
                return {
                    id: p.id,
                    nickname: '',  // Not stored in pointer-only docs; resolved later via global profiles
                    ...data as Omit<PDLPlayer, 'id' | 'nickname'>,
                    steamId32,  // Override with the normalised value
                };
            });
        }

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

// ============================================================================
// SKIPPED GAMES
// ============================================================================

export interface SkippedGame {
    gameId: string;
    reason: string;
    skippedAt: string; // ISO timestamp
    skippedBy: string; // 'system' or admin UID
}

/**
 * Mark a game as skipped (writes to both skippedGames and processedGames so
 * the sync won't try to re-import it).
 *
 * If the game was already imported into a match, it will also be removed from
 * that match (game doc + performances deleted, game_ids updated, scores
 * recalculated).
 */
export async function markPDLGameAsSkippedAdmin(
    tournamentId: string,
    gameId: string,
    reason: string,
    skippedBy: string = 'system'
): Promise<void> {
    ensureAdminInitialized();
    const db = getAdminDb();

    const tournamentRef = db.collection('tournaments').doc(tournamentId);
    const batch = db.batch();

    batch.set(
        tournamentRef.collection('skippedGames').doc(gameId),
        {
            gameId,
            reason,
            skippedAt: FieldValue.serverTimestamp(),
            skippedBy,
        }
    );

    batch.set(
        tournamentRef.collection('processedGames').doc(gameId),
        { processedAt: FieldValue.serverTimestamp() },
        { merge: true }
    );

    // Also remove from the unparsed queue so the game isn't retried
    batch.delete(tournamentRef.collection('unparsedMatches').doc(gameId));

    await batch.commit();

    // If the game was already imported into a match, remove it.
    // Search all matches for this game ID in their game_ids array.
    const numericGameId = Number(gameId);
    const matchesSnap = await tournamentRef
        .collection('matches')
        .where('game_ids', 'array-contains', numericGameId)
        .get();

    for (const matchDoc of matchesSnap.docs) {
        console.log(`[PDL] Skipped game ${gameId} was already imported in match ${matchDoc.id} — removing it`);

        const matchRef = matchDoc.ref;
        const gameRef = matchRef.collection('games').doc(gameId);

        // Delete game document and its performances subcollection
        const gameSnap = await gameRef.get();
        if (gameSnap.exists) {
            const perfsSnap = await gameRef.collection('performances').get();
            const deleteBatch = db.batch();
            perfsSnap.docs.forEach(d => deleteBatch.delete(d.ref));
            deleteBatch.delete(gameRef);
            await deleteBatch.commit();
        }

        // Remove gameId from match.game_ids array
        await matchRef.update({
            game_ids: FieldValue.arrayRemove(numericGameId),
        });

        // Recalculate scores — or reset if no games remain
        const remainingGames = await matchRef.collection('games').get();
        if (remainingGames.empty) {
            await matchRef.update({
                'teamA.score': 0,
                'teamB.score': 0,
                status: 'scheduled',
                winnerId: null,
                completedAt: null,
            });
        } else {
            await updatePDLMatchScoresAdmin(tournamentId, matchDoc.id);
        }

        console.log(`[PDL] ✅ Game ${gameId} removed from match ${matchDoc.id}`);
    }
}

/**
 * Get all skipped games for a tournament, newest first.
 */
export async function getPDLSkippedGamesAdmin(tournamentId: string): Promise<SkippedGame[]> {
    ensureAdminInitialized();
    const db = getAdminDb();

    const snapshot = await db
        .collection('tournaments')
        .doc(tournamentId)
        .collection('skippedGames')
        .orderBy('skippedAt', 'desc')
        .get();

    return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            gameId: doc.id,
            reason: data.reason ?? '',
            skippedAt: data.skippedAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
            skippedBy: data.skippedBy ?? 'system',
        };
    });
}

/**
 * Remove a game from the skipped list and also clear it from processedGames
 * so the next auto-sync will re-import it automatically.
 */
export async function removePDLSkippedGameAdmin(tournamentId: string, gameId: string): Promise<void> {
    ensureAdminInitialized();
    const db = getAdminDb();

    const tournamentRef = db.collection('tournaments').doc(tournamentId);
    const batch = db.batch();

    batch.delete(tournamentRef.collection('skippedGames').doc(gameId));
    batch.delete(tournamentRef.collection('processedGames').doc(gameId));

    await batch.commit();
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
 * Update division standings after a match completes.
 * Recalculates all team stats from scratch based on every completed match in the division.
 * This is idempotent – safe to call multiple times.
 */
async function updatePDLDivisionStandingsAdmin(tournamentId: string, divisionId: string): Promise<void> {
    ensureAdminInitialized();
    const db = getAdminDb();

    console.log(`[PDL] Recalculating standings for division ${divisionId} in tournament ${tournamentId}`);

    const tournamentRef = db.collection('tournaments').doc(tournamentId);

    // Fetch all teams in this division
    const teamsSnapshot = await tournamentRef
        .collection('teams')
        .where('divisionId', '==', divisionId)
        .get();

    if (teamsSnapshot.empty) {
        console.log(`[PDL] No teams found in division ${divisionId}`);
        return;
    }

    // Fetch all completed matches in this division
    const matchesSnapshot = await tournamentRef
        .collection('matches')
        .where('divisionId', '==', divisionId)
        .where('status', '==', 'completed')
        .get();

    // Initialise stats counters for every team in the division
    const statsMap = new Map<string, {
        played: number;
        wins: number;
        draws: number;
        losses: number;
        gamesWon: number;
        gamesLost: number;
    }>();

    for (const teamDoc of teamsSnapshot.docs) {
        statsMap.set(teamDoc.id, {
            played: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            gamesWon: 0,
            gamesLost: 0,
        });
    }

    // Process each completed match
    for (const matchDoc of matchesSnapshot.docs) {
        const match = matchDoc.data();

        const teamAId: string = match.teamA?.id || match.teams?.[0];
        const teamBId: string = match.teamB?.id || match.teams?.[1];
        const teamAScore: number = match.teamA?.score ?? 0;
        const teamBScore: number = match.teamB?.score ?? 0;

        if (!teamAId || !teamBId) continue;

        // Only count stats for teams that belong to this division
        const statsA = statsMap.get(teamAId);
        const statsB = statsMap.get(teamBId);

        if (!statsA || !statsB) continue;

        statsA.played += 1;
        statsB.played += 1;
        statsA.gamesWon += teamAScore;
        statsA.gamesLost += teamBScore;
        statsB.gamesWon += teamBScore;
        statsB.gamesLost += teamAScore;

        if (teamAScore > teamBScore) {
            statsA.wins += 1;
            statsB.losses += 1;
        } else if (teamBScore > teamAScore) {
            statsB.wins += 1;
            statsA.losses += 1;
        } else {
            // Equal score (e.g. 1-1 in BO2) → draw
            statsA.draws += 1;
            statsB.draws += 1;
        }
    }

    // Compute recent form (last 5 results) per team — sort matches chronologically
    const sortedMatches = matchesSnapshot.docs
        .map(d => d.data())
        .sort((a, b) => {
            const tA = a.completedAt?.toMillis?.() ?? (typeof a.completedAt === 'number' ? a.completedAt : 0);
            const tB = b.completedAt?.toMillis?.() ?? (typeof b.completedAt === 'number' ? b.completedAt : 0);
            // Fall back to updatedAt if completedAt is missing
            const fallbackA = a.updatedAt?.toMillis?.() ?? (typeof a.updatedAt === 'number' ? a.updatedAt : 0);
            const fallbackB = b.updatedAt?.toMillis?.() ?? (typeof b.updatedAt === 'number' ? b.updatedAt : 0);
            return (tA || fallbackA) - (tB || fallbackB);
        });

    // Accumulate form results oldest-first so TeamCard's .reverse() shows newest first
    const formMap = new Map<string, ('W' | 'D' | 'L')[]>();
    for (const teamDoc of teamsSnapshot.docs) {
        formMap.set(teamDoc.id, []);
    }

    for (const match of sortedMatches) {
        const tAId: string = match.teamA?.id || match.teams?.[0];
        const tBId: string = match.teamB?.id || match.teams?.[1];
        const tAScore: number = match.teamA?.score ?? 0;
        const tBScore: number = match.teamB?.score ?? 0;

        if (!tAId || !tBId) continue;

        if (formMap.has(tAId)) {
            formMap.get(tAId)!.push(tAScore > tBScore ? 'W' : tAScore < tBScore ? 'L' : 'D');
        }
        if (formMap.has(tBId)) {
            formMap.get(tBId)!.push(tBScore > tAScore ? 'W' : tBScore < tAScore ? 'L' : 'D');
        }
    }

    // Write updated stats and recentForm back to team documents in a single batch
    const batch = db.batch();

    for (const teamDoc of teamsSnapshot.docs) {
        const teamStats = statsMap.get(teamDoc.id);
        if (!teamStats) continue;

        const allResults = formMap.get(teamDoc.id) ?? [];
        const recentForm = allResults.slice(-5); // keep only the last 5 results

        // Compute PDL points: 2 per win, 1 per draw
        const points = teamStats.wins * 2 + teamStats.draws;

        batch.update(teamDoc.ref, {
            stats: teamStats,
            recentForm,
            // Also write flat fields so they match the Team interface used by the UI
            wins: teamStats.wins,
            draws: teamStats.draws,
            losses: teamStats.losses,
            matchesPlayed: teamStats.played,
            points,
            seasonPoints: points, // For PDL S1, season points = round points (single round-robin)
        });
    }

    await batch.commit();

    console.log(`[PDL] ✅ Standings updated for division ${divisionId}: ${teamsSnapshot.size} teams, ${matchesSnapshot.size} completed matches`);
}

// ============================================================================
// TEAM IDENTIFICATION FALLBACK (by player Steam IDs)
// ============================================================================

/**
 * When name-based matching fails (e.g. team used a different in-game name),
 * try to identify teams by cross-referencing player Steam32 account IDs
 * from the OpenDota match with the registered PDL team rosters.
 *
 * Requires at least MIN_MATCHES players from a side to match a team.
 */
function identifyPDLTeamsByPlayerIds(
    openDotaMatch: any,
    teams: PDLTeam[]
): { radiantTeam: PDLTeam; direTeam: PDLTeam } | null {
    const MIN_MATCHES = 3;

    const radiantAccountIds = new Set<string>(
        (openDotaMatch.players ?? [])
            .filter((p: any) => p.player_slot < 128 && p.account_id != null)
            .map((p: any) => String(p.account_id))
    );
    const direAccountIds = new Set<string>(
        (openDotaMatch.players ?? [])
            .filter((p: any) => p.player_slot >= 128 && p.account_id != null)
            .map((p: any) => String(p.account_id))
    );

    if (radiantAccountIds.size === 0 && direAccountIds.size === 0) {
        console.log('[PDL-TeamIdentify] No player account IDs in match data — cannot use player fallback');
        return null;
    }

    // Build steamId32 → teamId lookup
    const playerToTeam = new Map<string, string>();
    for (const team of teams) {
        for (const player of (team.players ?? [])) {
            if (player.steamId32 != null && player.steamId32 !== '') {
                playerToTeam.set(String(player.steamId32), team.id);
            }
        }
    }

    const scoreTeam = (teamId: string, accountIds: Set<string>): number => {
        let score = 0;
        for (const accountId of accountIds) {
            if (playerToTeam.get(accountId) === teamId) score++;
        }
        return score;
    };

    let bestRadiantTeam: PDLTeam | null = null;
    let bestRadiantScore = 0;
    let bestDireTeam: PDLTeam | null = null;
    let bestDireScore = 0;

    for (const team of teams) {
        const rScore = scoreTeam(team.id, radiantAccountIds);
        if (rScore > bestRadiantScore) { bestRadiantScore = rScore; bestRadiantTeam = team; }
        const dScore = scoreTeam(team.id, direAccountIds);
        if (dScore > bestDireScore) { bestDireScore = dScore; bestDireTeam = team; }
    }

    if (!bestRadiantTeam || bestRadiantScore < MIN_MATCHES) {
        console.log(`[PDL-TeamIdentify] Could not identify radiant — best: ${bestRadiantScore}/${radiantAccountIds.size}`);
        return null;
    }
    if (!bestDireTeam || bestDireScore < MIN_MATCHES) {
        console.log(`[PDL-TeamIdentify] Could not identify dire — best: ${bestDireScore}/${direAccountIds.size}`);
        return null;
    }
    if (bestRadiantTeam.id === bestDireTeam.id) {
        console.log(`[PDL-TeamIdentify] Both sides resolved to the same team (${bestRadiantTeam.name}) — invalid`);
        return null;
    }

    console.log(`[PDL-TeamIdentify] ✅ Radiant=${bestRadiantTeam.name} (${bestRadiantScore}/5), Dire=${bestDireTeam.name} (${bestDireScore}/5)`);
    return { radiantTeam: bestRadiantTeam, direTeam: bestDireTeam };
}

// ============================================================================
// MATCH SELECTION HELPER
// ============================================================================

/**
 * Among all scheduled matches between two teams, pick the one that most
 * needs a new game:
 *  1. Prefer status === 'scheduled' over 'completed'
 *  2. Among candidates with the same status, prefer fewest game_ids (least
 *     filled), so games always land in the current round instead of a
 *     previous (already-full) round.
 */
function findBestAvailableMatch(
    allMatches: PDLMatch[],
    radiantTeamId: string,
    direTeamId: string,
): PDLMatch | null {
    const candidates = allMatches.filter(
        m => m.teams?.includes(radiantTeamId) && m.teams?.includes(direTeamId)
    );

    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];

    // Prefer scheduled matches
    const scheduled = candidates.filter(m => m.status === 'scheduled');
    const pool = scheduled.length > 0 ? scheduled : candidates;

    // Among the pool, prefer fewest existing game_ids (least filled match)
    pool.sort((a, b) => (a.game_ids?.length ?? 0) - (b.game_ids?.length ?? 0));
    const best = pool[0];

    if (candidates.length > 1) {
        console.log(
            `[PDL-MatchSelect] ${candidates.length} candidate matches for ` +
            `${radiantTeamId} vs ${direTeamId}. Chose ${best.id} ` +
            `(status=${best.status}, games=${best.game_ids?.length ?? 0})`
        );
    }

    return best;
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

        // Also get unparsed matches for retry — but only those that haven't
        // since been manually skipped / processed (e.g. admin added to ignored list
        // while the game was still in the unparsed queue).
        const unparsedMatches = await getPDLUnparsedMatchesAdmin(tournamentId);
        const unparsedMatchIds = unparsedMatches
            .map(um => parseInt(um.openDotaMatchId))
            .filter(id => !processedGameIds.has(String(id)));

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

                // Reject remakes: games shorter than 5 minutes or with 0 total kills
                const gameDuration: number = openDotaMatch.duration ?? 0;
                const totalKills: number = (openDotaMatch.radiant_score ?? 0) + (openDotaMatch.dire_score ?? 0);
                if (gameDuration < 300 || totalKills === 0) {
                    console.log(`[PDL] Skipping match ${matchId} — detected as remake (duration: ${gameDuration}s, kills: ${totalKills})`);
                    await markPDLGameAsSkippedAdmin(tournamentId, String(matchId), `Remake (${gameDuration}s, ${totalKills} kills)`);
                    skippedCount++;
                    continue;
                }

                // Match teams by name
                const radiantTeam = teams.find(t =>
                    t.name.trim().toLowerCase() === openDotaMatch.radiant_name?.trim().toLowerCase()
                );
                const direTeam = teams.find(t =>
                    t.name.trim().toLowerCase() === openDotaMatch.dire_name?.trim().toLowerCase()
                );

                let resolvedRadiantTeam = radiantTeam;
                let resolvedDireTeam = direTeam;

                if (!resolvedRadiantTeam || !resolvedDireTeam) {
                    // Name-based matching failed (e.g. team used a different in-game name like "Poland" instead of "Team Poland").
                    // Try to identify teams by cross-referencing player Steam32 IDs.
                    console.log(`[PDL] Name lookup failed for "${openDotaMatch.radiant_name}" vs "${openDotaMatch.dire_name}". Trying player-based identification...`);
                    const playerIdentified = identifyPDLTeamsByPlayerIds(openDotaMatch, teams);
                    if (playerIdentified) {
                        resolvedRadiantTeam = playerIdentified.radiantTeam;
                        resolvedDireTeam = playerIdentified.direTeam;
                        console.log(`[PDL] Player-based ID succeeded: ${resolvedRadiantTeam.name} vs ${resolvedDireTeam.name}`);
                    } else {
                        console.log(`[PDL] Player-based identification also failed for ${openDotaMatch.radiant_name} vs ${openDotaMatch.dire_name} — likely a scrim`);
                        const radiantLabel = openDotaMatch.radiant_name || 'Unknown';
                        const direLabel = openDotaMatch.dire_name || 'Unknown';
                        await markPDLGameAsSkippedAdmin(tournamentId, String(matchId), `Team not identified: ${radiantLabel} vs ${direLabel} (likely scrim)`);
                        skippedCount++;
                        continue;
                    }
                }

                // Find the best available match between these teams
                const existingMatch = findBestAvailableMatch(
                    allMatches,
                    resolvedRadiantTeam!.id,
                    resolvedDireTeam!.id,
                );

                if (!existingMatch) {
                    console.log(`[PDL] No scheduled match found for ${resolvedRadiantTeam.name} vs ${resolvedDireTeam.name}`);
                    await markPDLGameAsSkippedAdmin(tournamentId, String(matchId), `No scheduled match: ${resolvedRadiantTeam.name} vs ${resolvedDireTeam.name}`);
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
                        (perf.teamId === resolvedRadiantTeam!.id && openDotaMatch.radiant_win) ||
                        (perf.teamId === resolvedDireTeam!.id && !openDotaMatch.radiant_win)
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

                    // Update in-memory match data so findBestAvailableMatch
                    // picks the correct match for subsequent games from the
                    // same team pair (e.g. different rounds).
                    const memMatch = allMatches.find(m => m.id === existingMatch.id);
                    if (memMatch) {
                        const numericId = parseInt(game.id);
                        if (!memMatch.game_ids) memMatch.game_ids = [];
                        if (!memMatch.game_ids.includes(numericId)) {
                            memMatch.game_ids.push(numericId);
                        }
                        // Mark as completed when match reaches 2 games (BO2)
                        if (memMatch.game_ids.length >= 2) {
                            memMatch.status = 'completed';
                        }
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

        // After processing all games, do a full standings recalculation so the
        // division tables are always up to date – even when the per-match update
        // was skipped (e.g. the match was only at 1 game, or a retry parsed an
        // older game that was already counted).
        if (importedCount > 0) {
            try {
                await recalculateAllPDLDivisionStandingsAdmin(tournamentId);
                console.log('[PDL] ✅ Division standings recalculated after sync');
            } catch (err) {
                console.error('[PDL] Warning: failed to recalculate standings after sync:', err);
                // Non-fatal – the per-match updates already ran for newly completed matches
            }
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

// ============================================================================
// FORCE IMPORT (Manual team override for mismatched lobby names)
// ============================================================================

export interface GamePreview {
    matchId: number;
    startTime: number;
    duration: number;
    radiantLobbyName: string | null;
    direLobbyName: string | null;
    radiantScore: number;
    direScore: number;
    isParsed: boolean;
    alreadyProcessed: boolean;
}

/**
 * Preview an OpenDota game without importing it.
 * Returns the lobby names so admin can verify before force-importing.
 */
export async function previewOpenDotaGameAdmin(
    tournamentId: string,
    openDotaGameId: number
): Promise<{ success: boolean; preview?: GamePreview; error?: string }> {
    try {
        const openDotaMatch = await fetchOpenDotaMatch(openDotaGameId);

        const processedIds = await getPDLProcessedGameIdsAdmin(tournamentId);
        const alreadyProcessed = processedIds.includes(String(openDotaGameId));

        return {
            success: true,
            preview: {
                matchId: openDotaMatch.match_id,
                startTime: openDotaMatch.start_time,
                duration: openDotaMatch.duration,
                radiantLobbyName: openDotaMatch.radiant_name || null,
                direLobbyName: openDotaMatch.dire_name || null,
                radiantScore: openDotaMatch.radiant_score ?? 0,
                direScore: openDotaMatch.dire_score ?? 0,
                isParsed: isMatchParsed(openDotaMatch),
                alreadyProcessed,
            },
        };
    } catch (error: any) {
        return { success: false, error: error?.message || 'Failed to fetch game from OpenDota' };
    }
}

/**
 * Force-import a game into a specific tournament match, bypassing team name matching.
 * Used when a captain set the wrong lobby name.
 */
export async function forceImportGameAdmin(
    tournamentId: string,
    openDotaGameId: number,
    tournamentMatchId: string,
    radiantTeamId: string,
    direTeamId: string
): Promise<{ success: boolean; message: string; error?: string }> {
    ensureAdminInitialized();
    const db = getAdminDb();

    try {
        // 1. Fetch OpenDota match
        const openDotaMatch = await fetchOpenDotaMatch(openDotaGameId);

        if (!isMatchParsed(openDotaMatch)) {
            // Request parse and inform admin
            await requestOpenDotaMatchParse(openDotaGameId);
            return {
                success: false,
                message: 'Match is not yet parsed by OpenDota. Parse has been requested — try again in a few minutes.',
            };
        }

        // 2. Load teams and players
        const teams = await getPDLTeamsAdmin(tournamentId);
        const players = await getPDLPlayersAdmin(tournamentId);

        const radiantTeam = teams.find(t => t.id === radiantTeamId);
        const direTeam = teams.find(t => t.id === direTeamId);

        if (!radiantTeam || !direTeam) {
            return {
                success: false,
                message: `Team not found: ${!radiantTeam ? `radiant (${radiantTeamId})` : `dire (${direTeamId})`}`,
            };
        }

        // 3. Transform with manual team mapping (bypasses lobby name matching)
        const { game, performances } = transformMatchData(
            openDotaMatch,
            teams as any[],
            players as any[],
            false,
            {
                radiant_team: { id: radiantTeam.id, name: radiantTeam.name },
                dire_team: { id: direTeam.id, name: direTeam.name },
            }
        );

        // 4. Recalculate PDL fantasy points
        const updatedPerformances = performances.map((perf: any) => ({
            ...perf,
            fantasyPoints: calculatePDLFantasyPoints(
                perf,
                (perf.teamId === radiantTeamId && openDotaMatch.radiant_win) ||
                (perf.teamId === direTeamId && !openDotaMatch.radiant_win)
            ),
        }));

        // 5. Save to the specified tournament match
        const saveResult = await savePDLGameResultsAdmin(
            tournamentId,
            tournamentMatchId,
            game,
            updatedPerformances
        );

        if (!saveResult.success) {
            return { success: false, message: saveResult.error || 'Failed to save game results' };
        }

        // 6. Mark as processed (removes from skipped/queued state)
        await markPDLGameAsProcessedAdmin(tournamentId, String(openDotaGameId));

        // 7. Also remove from unparsedMatches queue if present
        await db
            .collection('tournaments')
            .doc(tournamentId)
            .collection('unparsedMatches')
            .doc(String(openDotaGameId))
            .delete()
            .catch(() => {}); // Ignore if not present

        return {
            success: true,
            message: `Game ${openDotaGameId} successfully imported into match ${tournamentMatchId} (${radiantTeam.name} as Radiant, ${direTeam.name} as Dire).`,
        };

    } catch (error: any) {
        console.error(`[PDL] Force import error for game ${openDotaGameId}:`, error);
        return { success: false, message: error?.message || 'Force import failed' };
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

            // Reject remakes: games shorter than 5 minutes or with 0 total kills
            const gameDuration: number = openDotaMatch.duration ?? 0;
            const totalKills: number = (openDotaMatch.radiant_score ?? 0) + (openDotaMatch.dire_score ?? 0);
            if (gameDuration < 300 || totalKills === 0) {
                console.log(`[PDL] Skipping match ${matchId} — detected as remake (duration: ${gameDuration}s, kills: ${totalKills})`);
                await markPDLGameAsSkippedAdmin(tournamentId, String(matchId), `Remake (${gameDuration}s, ${totalKills} kills)`);
                skippedCount++;
                continue;
            }

            let radiantTeam = teams.find(t =>
                t.name.trim().toLowerCase() === openDotaMatch.radiant_name?.trim().toLowerCase()
            );
            let direTeam = teams.find(t =>
                t.name.trim().toLowerCase() === openDotaMatch.dire_name?.trim().toLowerCase()
            );

            if (!radiantTeam || !direTeam) {
                // Name-based matching failed — try player-based identification
                console.log(`[PDL] Name lookup failed for "${openDotaMatch.radiant_name}" vs "${openDotaMatch.dire_name}". Trying player-based identification...`);
                const playerIdentified = identifyPDLTeamsByPlayerIds(openDotaMatch, teams);
                if (playerIdentified) {
                    radiantTeam = playerIdentified.radiantTeam;
                    direTeam = playerIdentified.direTeam;
                    console.log(`[PDL] Player-based ID succeeded: ${radiantTeam.name} vs ${direTeam.name}`);
                } else {
                    const rcLabel = openDotaMatch.radiant_name || 'Unknown';
                    const dcLabel = openDotaMatch.dire_name || 'Unknown';
                    await markPDLGameAsSkippedAdmin(tournamentId, String(matchId), `Team not identified: ${rcLabel} vs ${dcLabel}`);
                    skippedCount++;
                    continue;
                }
            }

            const existingMatch = findBestAvailableMatch(
                allMatches,
                radiantTeam.id,
                direTeam.id,
            );

            if (!existingMatch) {
                await markPDLGameAsSkippedAdmin(tournamentId, String(matchId), `No scheduled match: ${radiantTeam.name} vs ${direTeam.name}`);
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

                // Update in-memory match data so findBestAvailableMatch
                // picks the correct match for subsequent games from the
                // same team pair (e.g. different rounds).
                const memMatch = allMatches.find(m => m.id === existingMatch.id);
                if (memMatch) {
                    const numericId = parseInt(game.id);
                    if (!memMatch.game_ids) memMatch.game_ids = [];
                    if (!memMatch.game_ids.includes(numericId)) {
                        memMatch.game_ids.push(numericId);
                    }
                    if (memMatch.game_ids.length >= 2) {
                        memMatch.status = 'completed';
                    }
                }

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

// ============================================================================
// DELETE GAME FROM MATCH (for re-import)
// ============================================================================

/**
 * Delete a single game document from a PDL match and reset the processed flag
 * so the game can be force-imported again with corrected team assignments.
 *
 * Steps:
 *  1. Delete the game doc from matches/{matchId}/games/{gameId}
 *  2. Remove gameId from match.game_ids array
 *  3. Remove from processedGames so force-import / auto-sync can pick it up again
 *  4. Recalculate match scores (or reset to scheduled if no games remain)
 */
export async function deleteGameFromPDLMatchAdmin(
    tournamentId: string,
    matchId: string,
    gameId: string,
): Promise<{ success: boolean; message: string }> {
    ensureAdminInitialized();
    const db = getAdminDb();

    const matchRef = db
        .collection('tournaments')
        .doc(tournamentId)
        .collection('matches')
        .doc(matchId);

    const matchDoc = await matchRef.get();
    if (!matchDoc.exists) {
        return { success: false, message: 'Match not found' };
    }

    // 1. Delete the game document (and its performances subcollection)
    const gameRef = matchRef.collection('games').doc(gameId);
    const gameDoc = await gameRef.get();
    if (gameDoc.exists) {
        // Delete performances first
        const perfsSnap = await gameRef.collection('performances').get();
        const batch = db.batch();
        perfsSnap.docs.forEach(d => batch.delete(d.ref));
        batch.delete(gameRef);
        await batch.commit();
    }

    // 2. Remove gameId from match.game_ids array
    await matchRef.update({
        game_ids: FieldValue.arrayRemove(Number(gameId)),
    });

    // 3. Un-mark as processed so auto-sync / force-import can pick it up again
    await db
        .collection('tournaments')
        .doc(tournamentId)
        .collection('processedGames')
        .doc(String(gameId))
        .delete()
        .catch(() => {}); // OK if not present

    // 4. Recalculate scores — or reset if no games remain
    const remainingGames = await matchRef.collection('games').get();
    if (remainingGames.empty) {
        await matchRef.update({
            'teamA.score': 0,
            'teamB.score': 0,
            status: 'scheduled',
            winnerId: null,
            completedAt: null,
        });
    } else {
        await updatePDLMatchScoresAdmin(tournamentId, matchId);
    }

    console.log(`[PDL] Game ${gameId} deleted from match ${matchId} and un-processed`);
    return { success: true, message: `Game ${gameId} deleted — ready to force-import again` };
}

// ============================================================================
// FORFEIT / WALKOVER
// ============================================================================

/**
 * Record a forfeit for a PDL match.
 *
 * - forfeitedGameNumbers = [] → full series walkover (score 0-2 in BO2)
 * - forfeitedGameNumbers = [1] or [2] → only that game is forfeited;
 *   synthetic game documents are created and series score is recalculated.
 */
export async function forfeitPDLMatchAdmin(
    tournamentId: string,
    matchId: string,
    forfeitingTeam: 'teamA' | 'teamB',
    forfeitedGameNumbers: number[],   // [] = full series
    reason: string,
    adminUserId: string,
): Promise<{ success: boolean; message: string }> {
    ensureAdminInitialized();
    const db = getAdminDb();

    const matchRef = db
        .collection('tournaments')
        .doc(tournamentId)
        .collection('matches')
        .doc(matchId);

    const matchDoc = await matchRef.get();
    if (!matchDoc.exists) {
        return { success: false, message: 'Match not found' };
    }

    const matchData = matchDoc.data()!;
    const teamAId: string = matchData.teams?.[0] || matchData.teamA?.id;
    const teamBId: string = matchData.teams?.[1] || matchData.teamB?.id;
    const teamAName: string = matchData.teamA?.name || teamAId;
    const teamBName: string = matchData.teamB?.name || teamBId;

    if (!teamAId || !teamBId) {
        return { success: false, message: 'Match is missing team IDs' };
    }

    const forfeitMeta = {
        forfeitingTeam,
        scope: forfeitedGameNumbers.length === 0 ? 'series' : 'games',
        ...(forfeitedGameNumbers.length > 0 ? { forfeitedGameNumbers } : {}),
        ...(reason ? { reason } : {}),
        issuedAt: new Date().toISOString(),
        issuedBy: adminUserId,
    };

    // ── Full series walkover ────────────────────────────────────────────────
    if (forfeitedGameNumbers.length === 0) {
        const teamAScore = forfeitingTeam === 'teamA' ? 0 : 2;
        const teamBScore = forfeitingTeam === 'teamB' ? 0 : 2;
        const winnerId   = forfeitingTeam === 'teamA' ? teamBId : teamAId;

        await matchRef.update({
            'teamA.score': teamAScore,
            'teamB.score': teamBScore,
            status: 'completed',
            winnerId,
            completedAt: FieldValue.serverTimestamp(),
            forfeit: forfeitMeta,
        });

        console.log(`[PDL Forfeit] Match ${matchId}: full series walkover by ${forfeitingTeam}`);
        return { success: true, message: `Walkover recorded – ${forfeitingTeam === 'teamA' ? teamAName : teamBName} forfeits the series` };
    }

    // ── Individual game forfeit(s) ──────────────────────────────────────────
    // The forfeiting team is always placed as 'radiant' in synthetic docs so
    // we can set radiant_win = false (radiant loses = forfeit).
    const forfeitingTeamId   = forfeitingTeam === 'teamA' ? teamAId   : teamBId;
    const forfeitingTeamName = forfeitingTeam === 'teamA' ? teamAName : teamBName;
    const winnerTeamId       = forfeitingTeam === 'teamA' ? teamBId   : teamAId;
    const winnerTeamName     = forfeitingTeam === 'teamA' ? teamBName : teamAName;

    const gamesRef = matchRef.collection('games');
    const batch = db.batch();

    for (const gameNum of forfeitedGameNumbers) {
        const docId = `forfeit_game${gameNum}`;
        const gameDocRef = gamesRef.doc(docId);
        batch.set(gameDocRef, {
            id: docId,
            is_forfeit: true,
            game_number: gameNum,
            forfeit_by_team_id: forfeitingTeamId,
            // Forfeiting team = radiant, loses → radiant_win = false
            radiant_team: { id: forfeitingTeamId, name: forfeitingTeamName },
            dire_team:    { id: winnerTeamId,     name: winnerTeamName     },
            radiant_win: false,
            duration: 0,
            start_time: Math.floor(Date.now() / 1000),
            match_id: matchId,
        }, { merge: false });
    }

    await batch.commit();

    // Recalculate series score from all game documents (real + synthetic)
    const allGamesSnap = await gamesRef.get();
    const allGames = allGamesSnap.docs.map(d => d.data());

    let teamAWins = 0;
    let teamBWins = 0;
    allGames.forEach(game => {
        const radiantId = game.radiant_team?.id;
        const direId    = game.dire_team?.id;
        if (game.radiant_win) {
            if (radiantId === teamAId) teamAWins++;
            else if (radiantId === teamBId) teamBWins++;
        } else {
            if (direId === teamAId) teamAWins++;
            else if (direId === teamBId) teamBWins++;
        }
    });

    const isComplete = allGames.length >= 2;
    let winnerId: string | null = null;
    if (teamAWins > teamBWins) winnerId = teamAId;
    else if (teamBWins > teamAWins) winnerId = teamBId;

    const updateData: Record<string, unknown> = {
        'teamA.score': teamAWins,
        'teamB.score': teamBWins,
        forfeit: forfeitMeta,
    };
    if (isComplete) {
        updateData.status     = 'completed';
        updateData.winnerId   = winnerId;
        updateData.completedAt = FieldValue.serverTimestamp();
    }

    await matchRef.update(updateData);

    const gameLabel = forfeitedGameNumbers.map(n => `Game ${n}`).join(' & ');
    console.log(`[PDL Forfeit] Match ${matchId}: ${gameLabel} forfeited by ${forfeitingTeam}. New score: ${teamAWins}-${teamBWins}`);

    // Recalculate standings if the match is now complete
    if (isComplete && matchData.divisionId) {
        await updatePDLDivisionStandingsAdmin(tournamentId, matchData.divisionId);
    }

    return {
        success: true,
        message: `${gameLabel} forfeit recorded – score updated to ${teamAWins}:${teamBWins}`,
    };
}

// ============================================================================
// REVERT FORFEIT
// ============================================================================

/**
 * Reverts a previously recorded forfeit for a PDL match.
 *
 * Full-series walkover: clears scores, status → 'scheduled', removes forfeit field.
 * Game-level forfeit:   deletes synthetic forfit_game* documents, recalculates
 *                       the series score from the remaining real games, and clears
 *                       the forfeit field from the match document.
 *
 * In both cases, division standings are recalculated afterwards.
 */
export async function revertPDLForfeitAdmin(
    tournamentId: string,
    matchId: string,
): Promise<{ success: boolean; message: string }> {
    ensureAdminInitialized();
    const db = getAdminDb();

    const matchRef = db
        .collection('tournaments')
        .doc(tournamentId)
        .collection('matches')
        .doc(matchId);

    const matchDoc = await matchRef.get();
    if (!matchDoc.exists) {
        return { success: false, message: 'Match not found' };
    }

    const matchData = matchDoc.data()!;

    if (!matchData.forfeit) {
        return { success: false, message: 'This match has no forfeit to revert' };
    }

    const forfeitMeta = matchData.forfeit as {
        scope: 'series' | 'games';
        forfeitedGameNumbers?: number[];
    };
    const teamAId: string = matchData.teams?.[0] || matchData.teamA?.id;
    const teamBId: string = matchData.teams?.[1] || matchData.teamB?.id;

    const gamesRef = matchRef.collection('games');

    if (forfeitMeta.scope === 'series') {
        // Full walkover — reset to scheduled state with 0-0 score
        await matchRef.update({
            'teamA.score': 0,
            'teamB.score': 0,
            status: 'scheduled',
            forfeit: FieldValue.delete(),
            winnerId: FieldValue.delete(),
            completedAt: FieldValue.delete(),
        });

        console.log(`[PDL Revert Forfeit] Match ${matchId}: full-series forfeit reverted → scheduled`);

    } else {
        // Game-level forfeit — delete synthetic forfeit_game* docs
        const numGames: number[] = forfeitMeta.forfeitedGameNumbers ?? [1, 2];
        const batch = db.batch();
        for (const gameNum of numGames) {
            batch.delete(gamesRef.doc(`forfeit_game${gameNum}`));
        }
        await batch.commit();

        // Recalculate series score from real (non-synthetic) games remaining
        const allGamesSnap = await gamesRef.get();
        const realGames = allGamesSnap.docs
            .filter(d => !d.id.startsWith('forfeit_'))
            .map(d => d.data());

        let teamAWins = 0;
        let teamBWins = 0;
        realGames.forEach(game => {
            const radiantId = game.radiant_team?.id;
            const direId    = game.dire_team?.id;
            if (game.radiant_win) {
                if (radiantId === teamAId) teamAWins++;
                else if (radiantId === teamBId) teamBWins++;
            } else {
                if (direId === teamAId) teamAWins++;
                else if (direId === teamBId) teamBWins++;
            }
        });

        const isComplete = realGames.length >= 2;
        let winnerId: string | undefined;
        if (teamAWins > teamBWins) winnerId = teamAId;
        else if (teamBWins > teamAWins) winnerId = teamBId;

        const updateData: Record<string, unknown> = {
            'teamA.score': teamAWins,
            'teamB.score': teamBWins,
            forfeit: FieldValue.delete(),
        };

        if (isComplete) {
            updateData.status     = 'completed';
            updateData.winnerId   = winnerId ?? FieldValue.delete();
            updateData.completedAt = FieldValue.serverTimestamp();
        } else {
            updateData.status     = 'scheduled';
            updateData.winnerId   = FieldValue.delete();
            updateData.completedAt = FieldValue.delete();
        }

        await matchRef.update(updateData);

        console.log(`[PDL Revert Forfeit] Match ${matchId}: game-level forfeit reverted. New score: ${teamAWins}-${teamBWins}`);
    }

    // Recalculate division standings
    if (matchData.divisionId) {
        await updatePDLDivisionStandingsAdmin(tournamentId, matchData.divisionId);
    }

    return { success: true, message: 'Forfeit reverted successfully' };
}

// ============================================================================
// PUBLIC STANDINGS RECALCULATION
// ============================================================================

/**
 * Recalculate standings for every division in a tournament from scratch.
 * Call this after any bulk score changes or to fix inconsistent standings.
 */
export async function recalculateAllPDLDivisionStandingsAdmin(
    tournamentId: string,
): Promise<{ success: boolean; message: string; divisionsUpdated: number }> {
    ensureAdminInitialized();
    const db = getAdminDb();

    const divisionsSnapshot = await db
        .collection('tournaments')
        .doc(tournamentId)
        .collection('divisions')
        .get();

    if (divisionsSnapshot.empty) {
        return { success: true, message: 'No divisions found.', divisionsUpdated: 0 };
    }

    let divisionsUpdated = 0;
    const errors: string[] = [];

    for (const divisionDoc of divisionsSnapshot.docs) {
        try {
            await updatePDLDivisionStandingsAdmin(tournamentId, divisionDoc.id);
            divisionsUpdated++;
        } catch (err: any) {
            console.error(`[PDL] Failed to update standings for division ${divisionDoc.id}:`, err);
            errors.push(`${divisionDoc.id}: ${err?.message || 'unknown error'}`);
        }
    }

    const message = errors.length > 0
        ? `Updated ${divisionsUpdated}/${divisionsSnapshot.size} divisions. Errors: ${errors.join(', ')}`
        : `Successfully updated ${divisionsUpdated} division(s).`;

    return { success: errors.length === 0, message, divisionsUpdated };
}
