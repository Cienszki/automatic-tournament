// src/lib/pdl-registration-actions.ts
// PDL team registration - tournament-scoped, no MMR requirements

import { getAdminDb, ensureAdminInitialized } from '../server/lib/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { processPlayerSteamUrls, checkDuplicateSteamIds } from './steam-id-utils';
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
    }>;
    coach?: {
        hasCoach: boolean;
        nickname?: string;
        steamProfileUrl?: string;
    };
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

    // Team tag
    if (!data.tag || data.tag.length < 2 || data.tag.length > 4) {
        errors.push('Team tag must be 2-4 characters');
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

        // Check Steam URLs
        data.players.forEach((player, index) => {
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
 * Check if team name is already taken in the tournament
 */
async function isTeamNameTaken(tournamentId: string, teamName: string): Promise<boolean> {
    ensureAdminInitialized();
    const db = getAdminDb();

    const snapshot = await db
        .collection('tournaments')
        .doc(tournamentId)
        .collection('teams')
        .where('name', '==', teamName)
        .limit(1)
        .get();

    return !snapshot.empty;
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

        // Step 5: Check for duplicate Steam IDs
        const duplicateCheck = checkDuplicateSteamIds(processedPlayers);
        if (duplicateCheck.hasDuplicates) {
            return {
                success: false,
                message: `Duplicate Steam profiles detected for: ${duplicateCheck.duplicates.join(', ')}`,
            };
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

        // Prepare team document
        const teamDoc = {
            name: teamData.name,
            tag: teamData.tag,
            logoUrl: teamData.logoUrl,
            captainId: teamData.captainId,
            captainDiscordUsername: teamData.discordUsername,
            motto: teamData.motto,
            status: 'pending' as const,
            divisionId: null, // Assigned by admin later
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        };

        // Use batch write for atomicity
        const batch = db.batch();

        // Save team document
        batch.set(teamRef, teamDoc);

        // Save player documents
        processedPlayers.forEach((player) => {
            const playerRef = teamRef.collection('players').doc();
            batch.set(playerRef, {
                nickname: player.nickname,
                role: player.role,
                steamProfileUrl: player.steamProfileUrl,
                steamId64: player.steamId64,
                steamId32: player.steamId32,
                avatar: player.avatar || null,
                personaname: player.personaname || player.nickname,
                createdAt: FieldValue.serverTimestamp(),
            });
        });

        // Save coach document if provided
        if (processedCoach) {
            const coachRef = teamRef.collection('players').doc('coach');
            batch.set(coachRef, {
                nickname: processedCoach.nickname,
                role: 'Coach' as const,
                steamProfileUrl: processedCoach.steamProfileUrl,
                steamId64: processedCoach.steamId64,
                steamId32: processedCoach.steamId32,
                avatar: processedCoach.avatar || null,
                personaname: processedCoach.personaname || processedCoach.nickname,
                isCoach: true,
                createdAt: FieldValue.serverTimestamp(),
            });
        }

        // Commit batch
        await batch.commit();

        console.log(`[PDL Registration] ✅ Team "${teamData.name}" registered successfully with ID: ${teamId}`);

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
