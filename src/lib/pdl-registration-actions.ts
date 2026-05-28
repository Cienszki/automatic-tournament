// src/lib/pdl-registration-actions.ts
// PDL team registration - tournament-scoped, no MMR requirements

import { getAdminDb, ensureAdminInitialized } from '../server/lib/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { processPlayerSteamUrls, checkDuplicateSteamIds, extractSteamIdFromUrl } from './steam-id-utils';
import { PlayerRole } from './definitions';

// ============================================================================
// TYPES
// ============================================================================

export interface PDLTeamRegistrationData {
    name: string;
    tag: string;
    discordUsername: string;
    motto: string;
    logoUrl: string;
    captainId: string;
    players: Array<{
        nickname: string;
        role: PlayerRole;
        steamProfileUrl: string;
        mmr?: number;
        profileScreenshotUrl?: string;
        smurfAccounts?: { steamProfileUrl: string }[];
    }>;
    coach?: {
        hasCoach: boolean;
        nickname?: string;
        steamProfileUrl?: string;
    };
    mmrCap?: number;
}

export interface RegistrationResult {
    success: boolean;
    message: string;
    teamId?: string;
    errors?: string[];
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate team registration data
 */
function validateTeamData(data: PDLTeamRegistrationData): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Team name
    if (!data.name || data.name.length < 3) {
        errors.push('Team name must be at least 3 characters');
    }
    if (data.name && data.name.length > 20) {
        errors.push('Team name cannot exceed 20 characters');
    }

    // Team tag
    if (!data.tag || data.tag.length < 2 || data.tag.length > 6) {
        errors.push('Team tag must be 2-6 characters');
    }

    // Discord username
    if (!data.discordUsername || data.discordUsername.length < 2) {
        errors.push('Discord username is required');
    }

    // Logo
    if (!data.logoUrl) {
        errors.push('Team logo is required');
    }

    // Captain ID
    if (!data.captainId) {
        errors.push('Captain ID is required');
    }

    // Players
    if (!data.players || data.players.length !== 5) {
        errors.push('Exactly 5 players are required');
    } else {
        // Check unique roles
        const roles = data.players.map(p => p.role);
        const uniqueRoles = new Set(roles);
        if (uniqueRoles.size !== 5) {
            errors.push('Each player must have a unique role');
        }

        // Check all roles covered
        const requiredRoles: PlayerRole[] = ['Carry', 'Mid', 'Offlane', 'Soft Support', 'Hard Support'];
        const hasAllRoles = requiredRoles.every(role => roles.includes(role));
        if (!hasAllRoles) {
            errors.push('Must have one player for each role: Carry, Mid, Offlane, Soft Support, Hard Support');
        }

        // Check player nicknames and Steam URLs
        data.players.forEach((player, index) => {
            if (!player.nickname || player.nickname.length < 2) {
                errors.push(`Player ${index + 1}: Nickname must be at least 2 characters`);
            }
            if (player.nickname && player.nickname.length > 20) {
                errors.push(`Player ${index + 1} (${player.nickname}): Nickname cannot exceed 20 characters`);
            }
            if (!player.steamProfileUrl || !player.steamProfileUrl.includes('steamcommunity.com')) {
                errors.push(`Player ${index + 1} (${player.nickname}): Invalid Steam profile URL`);
            }
        });
    }

    // Coach validation (if enabled)
    if (data.coach?.hasCoach) {
        if (!data.coach.nickname || data.coach.nickname.length < 2) {
            errors.push('Coach nickname is required when adding a coach');
        }
        if (data.coach.nickname && data.coach.nickname.length > 20) {
            errors.push('Coach nickname cannot exceed 20 characters');
        }
        if (!data.coach.steamProfileUrl || !data.coach.steamProfileUrl.includes('steamcommunity.com')) {
            errors.push('Coach Steam profile URL is required');
        }
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Check if team name is already taken in the tournament (case and whitespace insensitive)
 */
async function isTeamNameTaken(tournamentId: string, teamName: string): Promise<boolean> {
    ensureAdminInitialized();
    const db = getAdminDb();

    // Get all teams and check client-side for case/whitespace insensitive match
    const snapshot = await db
        .collection('tournaments')
        .doc(tournamentId)
        .collection('teams')
        .get();

    const normalizedInput = teamName.toLowerCase().replace(/\s+/g, '');
    
    for (const doc of snapshot.docs) {
        const existingName = doc.data().name;
        const normalizedExisting = existingName.toLowerCase().replace(/\s+/g, '');
        if (normalizedExisting === normalizedInput) {
            return true;
        }
    }

    return false;
}

/**
 * Check if captain already has a team in the tournament
 */
async function hasCaptainRegistered(tournamentId: string, captainId: string): Promise<boolean> {
    ensureAdminInitialized();
    const db = getAdminDb();

    const snapshot = await db
        .collection('tournaments')
        .doc(tournamentId)
        .collection('teams')
        .where('captainId', '==', captainId)
        .limit(1)
        .get();

    return !snapshot.empty;
}

/**
 * Check if any players are already registered in other teams in the tournament
 * Returns array of already registered player nicknames
 */
async function checkPlayersAlreadyRegistered(
    tournamentId: string,
    steamIds: string[]
): Promise<string[]> {
    ensureAdminInitialized();
    const db = getAdminDb();

    const alreadyRegistered: string[] = [];

    // Get all teams in the tournament
    const teamsSnapshot = await db
        .collection('tournaments')
        .doc(tournamentId)
        .collection('teams')
        .get();

    // Check each team's players
    for (const teamDoc of teamsSnapshot.docs) {
        const teamId = teamDoc.id;
        const playersSnapshot = await db
            .collection('tournaments')
            .doc(tournamentId)
            .collection('teams')
            .doc(teamId)
            .collection('players')
            .get();

        for (const playerDoc of playersSnapshot.docs) {
            const playerData = playerDoc.data();
            // Coalesce field name variants: registration writes steamId32/steamId64,
            // transfers write steamId (=steamId64). Check all variants.
            const docSteamId = playerData.steamId32 || playerData.steamId64 || playerData.steamId || '';
            if (docSteamId && steamIds.includes(docSteamId)) {
                alreadyRegistered.push(playerData.nickname);
            }
        }
    }

    return alreadyRegistered;
}

// ============================================================================
// MAIN REGISTRATION FUNCTION
// ============================================================================

/**
 * Register a PDL team
 * Saves to tournament-scoped Firestore collections
 */
export async function registerPDLTeam(
    tournamentId: string,
    teamData: PDLTeamRegistrationData
): Promise<RegistrationResult> {
    try {
        console.log(`[PDL Registration] Starting registration for team: ${teamData.name}`);

        // Step 1: Validate input data
        const validation = validateTeamData(teamData);
        if (!validation.valid) {
            return {
                success: false,
                message: 'Validation failed',
                errors: validation.errors,
            };
        }

        // Step 2: Check for duplicate team name
        const nameTaken = await isTeamNameTaken(tournamentId, teamData.name);
        if (nameTaken) {
            return {
                success: false,
                message: `Team name "${teamData.name}" is already taken in this tournament`,
            };
        }

        // Step 3: Check if captain already registered a team
        const captainHasTeam = await hasCaptainRegistered(tournamentId, teamData.captainId);
        if (captainHasTeam) {
            return {
                success: false,
                message: 'You have already registered a team in this tournament',
            };
        }

        // Step 4: Process player Steam URLs and extract Steam IDs
        console.log(`[PDL Registration] Processing player Steam profiles...`);
        const processedPlayers = await processPlayerSteamUrls(teamData.players);

        // Step 5: Check for duplicate Steam IDs within the registration
        const duplicateCheck = checkDuplicateSteamIds(processedPlayers);
        if (duplicateCheck.hasDuplicates) {
            return {
                success: false,
                message: `Duplicate Steam profiles detected for: ${duplicateCheck.duplicates.join(', ')}`,
            };
        }

        // Step 5.5: Check if any players are already registered in other teams
        const playerSteamIds = processedPlayers.map(p => p.steamId32 || p.steamId64).filter(Boolean);
        const alreadyRegisteredPlayers = await checkPlayersAlreadyRegistered(tournamentId, playerSteamIds);
        if (alreadyRegisteredPlayers.length > 0) {
            return {
                success: false,
                message: `Następujący gracze są już zarejestrowani w innych drużynach: ${alreadyRegisteredPlayers.join(', ')}`,
            };
        }

        // Step 5.7: Resolve smurf account Steam IDs server-side
        console.log(`[PDL Registration] Resolving smurf account Steam IDs...`);
        const resolvedSmurfsPerPlayer: Array<Array<{ steamProfileUrl: string; steamId64: string; steamId32: string }>> = [];
        for (const originalPlayer of teamData.players) {
            const resolvedSmurfs: { steamProfileUrl: string; steamId64: string; steamId32: string }[] = [];
            for (const smurf of originalPlayer.smurfAccounts || []) {
                if (!smurf.steamProfileUrl) continue;
                try {
                    const { steamId64, steamId32 } = await extractSteamIdFromUrl(smurf.steamProfileUrl);
                    resolvedSmurfs.push({ steamProfileUrl: smurf.steamProfileUrl, steamId64, steamId32 });
                } catch (e) {
                    console.warn(`[PDL Registration] Could not resolve smurf URL: ${smurf.steamProfileUrl}`, e);
                    resolvedSmurfs.push({ steamProfileUrl: smurf.steamProfileUrl, steamId64: '', steamId32: '' });
                }
            }
            resolvedSmurfsPerPlayer.push(resolvedSmurfs);
        }

        // Step 6: Process coach if provided
        let processedCoach = null;
        if (teamData.coach?.hasCoach && teamData.coach.nickname && teamData.coach.steamProfileUrl) {
            console.log(`[PDL Registration] Processing coach Steam profile...`);
            const coachArray = await processPlayerSteamUrls([{
                nickname: teamData.coach.nickname,
                steamProfileUrl: teamData.coach.steamProfileUrl,
                role: 'Carry' as PlayerRole, // Placeholder, not used for coaches
            }]);
            processedCoach = coachArray[0];
        }

        // Step 7: Save to Firestore
        ensureAdminInitialized();
        const db = getAdminDb();

        const teamRef = db
            .collection('tournaments')
            .doc(tournamentId)
            .collection('teams')
            .doc(); // Auto-generate ID

        const teamId = teamRef.id;

        // Prepare team document — includes embedded roster for single-doc reads
        const roster: Record<string, { nickname: string; role: string; steamId32: string; avatar?: string; avatarmedium?: string; avatarfull?: string; mmr?: number; profileScreenshotUrl?: string; smurfAccounts?: { steamProfileUrl: string; steamId64: string; steamId32: string }[] }> = {};
        processedPlayers.forEach((player, index) => {
            if (player.steamId64) {
                const originalPlayer = teamData.players[index];
                const resolvedSmurfs = resolvedSmurfsPerPlayer[index];
                roster[player.steamId64] = {
                    nickname: player.nickname,
                    role: player.role,
                    steamId32: player.steamId32,
                    avatar: player.avatar || '',
                    avatarmedium: player.avatarmedium || '',
                    avatarfull: player.avatarfull || '',
                    ...(originalPlayer?.mmr != null ? { mmr: originalPlayer.mmr } : {}),
                    ...(originalPlayer?.profileScreenshotUrl ? { profileScreenshotUrl: originalPlayer.profileScreenshotUrl } : {}),
                    ...(resolvedSmurfs?.length ? { smurfAccounts: resolvedSmurfs } : {}),
                };
            }
        });

        const totalMMR = Object.values(roster).reduce((s, p) => s + (p.mmr || 0), 0);

        const teamDoc = {
            name: teamData.name,
            tag: teamData.tag,
            logoUrl: teamData.logoUrl,
            captainId: teamData.captainId,
            captainDiscordUsername: teamData.discordUsername,
            motto: teamData.motto,
            status: 'pending' as const,
            divisionId: null, // Assigned by admin later
            totalMMR,
            /**
             * Quick-read roster: { [steamId64]: { nickname, role, steamId32, mmr?, profileScreenshotUrl? } }
             * Used to display team rosters without reading the player subcollection.
             */
            roster,
            ...(teamData.mmrCap != null ? { mmrCap: teamData.mmrCap } : {}),
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        };

        // Use batch write for atomicity
        const batch = db.batch();

        // Save team document
        batch.set(teamRef, teamDoc);

        // Save player pointer documents (pointer-only — full data is in /players/{steamId64})
        processedPlayers.forEach((player, index) => {
            const playerRef = teamRef.collection('players').doc(player.steamId64);
            const originalPlayer = teamData.players[index];
            const resolvedSmurfs = resolvedSmurfsPerPlayer[index];
            batch.set(playerRef, {
                steamId: player.steamId64,
                steamId32: player.steamId32,
                role: player.role,
                ...(originalPlayer?.mmr != null ? { mmr: originalPlayer.mmr } : {}),
                ...(originalPlayer?.profileScreenshotUrl ? { profileScreenshotUrl: originalPlayer.profileScreenshotUrl } : {}),
                ...(resolvedSmurfs?.length ? { smurfAccounts: resolvedSmurfs } : {}),
            });
        });

        // Save coach pointer document if provided
        if (processedCoach) {
            const coachRef = teamRef.collection('players').doc(processedCoach.steamId64 || 'coach');
            batch.set(coachRef, {
                steamId: processedCoach.steamId64,
                steamId32: processedCoach.steamId32,
                role: 'Coach' as const,
                isCoach: true,
            });
        }

        // Commit batch
        await batch.commit();

        // ── Upsert global player profiles ──
        // This ensures every registered player has a record in /players/{steamId64}
        // with their currentTeam pointer set.
        try {
            const { batchUpsertGlobalPlayerProfiles } = await import('./player-profiles');
            await batchUpsertGlobalPlayerProfiles(
                processedPlayers
                    .filter(p => p.steamId64)
                    .map(p => ({
                        steamId: p.steamId64,
                        steamId32: p.steamId32,
                        nickname: p.nickname,
                        steamProfileUrl: p.steamProfileUrl,
                        avatar: p.avatar,
                        avatarmedium: p.avatarmedium,
                        avatarfull: p.avatarfull,
                        currentTeam: {
                            tournamentId,
                            teamId,
                            teamName: teamData.name,
                            teamTag: teamData.tag,
                            role: p.role as PlayerRole,
                        },
                    }))
            );
            console.log(`[PDL Registration] Global player profiles upserted for ${processedPlayers.length} players`);
        } catch (profileError) {
            // Non-fatal: registration succeeded, global profiles can be created later via migration
            console.warn('[PDL Registration] Failed to upsert global player profiles:', profileError);
        }

        console.log(`[PDL Registration] ✅ Team "${teamData.name}" registered successfully with ID: ${teamId}`);

        // ── Fetch most-played heroes from OpenDota (non-blocking) ──
        // This runs after the main registration is committed so it doesn't slow down
        // or block the user. Errors are non-fatal.
        try {
            console.log(`[PDL Registration] Fetching most-played heroes from OpenDota...`);
            const updatedRoster = { ...roster };
            let heroFetchCount = 0;
            for (const player of processedPlayers) {
                if (!player.steamId64 || !player.steamId32) continue;
                try {
                    if (heroFetchCount > 0) await new Promise(r => setTimeout(r, 2100)); // OpenDota rate limit
                    const [overallRes, recentRes] = await Promise.all([
                        fetch(`https://api.opendota.com/api/players/${player.steamId32}/heroes`),
                        fetch(`https://api.opendota.com/api/players/${player.steamId32}/heroes?date=180`),
                    ]);
                    if (overallRes.ok && recentRes.ok) {
                        const overallData = await overallRes.json();
                        const recentData = await recentRes.json();
                        const heroData = {
                            overall: overallData.sort((a: any, b: any) => b.games - a.games).slice(0, 5).filter((h: any) => h.games > 0).map((h: any) => ({ heroId: parseInt(h.hero_id), games: h.games, win: h.win })),
                            recent: recentData.sort((a: any, b: any) => b.games - a.games).slice(0, 5).filter((h: any) => h.games > 0).map((h: any) => ({ heroId: parseInt(h.hero_id), games: h.games, win: h.win })),
                            lastUpdated: new Date().toISOString(),
                        };
                        if (updatedRoster[player.steamId64]) {
                            updatedRoster[player.steamId64] = { ...updatedRoster[player.steamId64], mostPlayedHeroes: heroData } as any;
                        }
                        heroFetchCount++;
                    }
                } catch (e) {
                    console.warn(`[PDL Registration] Could not fetch heroes for ${player.steamId32}:`, e);
                }
            }
            if (heroFetchCount > 0) {
                await db.collection('tournaments').doc(tournamentId).collection('teams').doc(teamId).update({ roster: updatedRoster });
                console.log(`[PDL Registration] Most-played heroes saved for ${heroFetchCount} players`);
            }
        } catch (heroError) {
            console.warn('[PDL Registration] Failed to fetch most-played heroes (non-fatal):', heroError);
        }

        return {
            success: true,
            message: 'Team registered successfully! Your team is pending admin approval.',
            teamId,
        };

    } catch (error) {
        console.error('[PDL Registration] Error:', error);
        return {
            success: false,
            message: `Registration failed: ${(error as Error).message}`,
        };
    }
}

// ============================================================================
// ADMIN APPROVAL FUNCTIONS
// ============================================================================

/**
 * Approve a pending PDL team
 */
export async function approvePDLTeam(
    tournamentId: string,
    teamId: string,
    divisionId?: string
): Promise<{ success: boolean; message: string }> {
    try {
        ensureAdminInitialized();
        const db = getAdminDb();

        const teamRef = db
            .collection('tournaments')
            .doc(tournamentId)
            .collection('teams')
            .doc(teamId);

        const updateData: any = {
            status: 'verified',
            verifiedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        };

        if (divisionId) {
            updateData.divisionId = divisionId;
        }

        await teamRef.update(updateData);

        console.log(`[PDL Admin] ✅ Team ${teamId} approved`);

        return {
            success: true,
            message: 'Team approved successfully',
        };
    } catch (error) {
        console.error('[PDL Admin] Error approving team:', error);
        return {
            success: false,
            message: `Failed to approve team: ${(error as Error).message}`,
        };
    }
}

/**
 * Reject a pending PDL team
 */
export async function rejectPDLTeam(
    tournamentId: string,
    teamId: string,
    reason?: string
): Promise<{ success: boolean; message: string }> {
    try {
        ensureAdminInitialized();
        const db = getAdminDb();

        const teamRef = db
            .collection('tournaments')
            .doc(tournamentId)
            .collection('teams')
            .doc(teamId);

        const updateData: any = {
            status: 'rejected',
            rejectedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        };

        if (reason) {
            updateData.rejectionReason = reason;
        }

        await teamRef.update(updateData);

        console.log(`[PDL Admin] ❌ Team ${teamId} rejected`);

        return {
            success: true,
            message: 'Team rejected',
        };
    } catch (error) {
        console.error('[PDL Admin] Error rejecting team:', error);
        return {
            success: false,
            message: `Failed to reject team: ${(error as Error).message}`,
        };
    }
}

/**
 * Get all pending teams for admin review
 */
export async function getPendingPDLTeams(tournamentId: string): Promise<any[]> {
    ensureAdminInitialized();
    const db = getAdminDb();

    const snapshot = await db
        .collection('tournaments')
        .doc(tournamentId)
        .collection('teams')
        .where('status', '==', 'pending')
        .orderBy('createdAt', 'desc')
        .get();

    const teams = [];

    for (const doc of snapshot.docs) {
        const teamData = doc.data();

        // Get players
        const playersSnapshot = await doc.ref.collection('players').get();
        const players = playersSnapshot.docs.map(p => ({ id: p.id, ...p.data() }));

        teams.push({
            id: doc.id,
            ...teamData,
            players,
        });
    }

    return teams;
}
