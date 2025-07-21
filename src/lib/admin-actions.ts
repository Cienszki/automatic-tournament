
"use server";

import { adminDb, adminStorage } from './admin';
import { revalidatePath } from 'next/cache';
import { getSteam64IdFromUrl, getOpenDotaAccountIdFromUrl, getSteamPlayerSummary } from './server-utils'; // Import server-side utility
import { TournamentStatus, Player, Team } from './definitions';
import { v4 as uuidv4 } from 'uuid';
import { firestore } from 'firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { headers } from 'next/headers';

// Securely verify admin privileges on the server
async function verifyAdmin() {
    const authHeader = headers().get('Authorization');
    if (!authHeader) {
        throw new Error('Not authenticated');
    }
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await getAuth(adminDb.app).verifyIdToken(token);
    const adminDoc = await adminDb.collection('admins').doc(decodedToken.uid).get();
    if (!adminDoc.exists) {
        throw new Error('Not authorized');
    }
    return decodedToken;
}

// --- Team Logo Upload Action ---
export async function uploadTeamLogo(formData: FormData): Promise<{ success: true, url: string } | { success: false, message: string }> {
    const file = formData.get('logo') as File;
    const teamName = formData.get('teamName') as string;

    if (!file || !teamName) {
        return { success: false, message: 'Missing file or team name for logo upload.' };
    }

    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    if (!bucketName) {
        return { success: false, message: 'Server configuration error: Storage bucket not found.' };
    }

    try {
        const bucket = adminStorage.bucket(bucketName);
        const safeTeamName = teamName.replace(/[^a-zA-Z0-9]/g, '_');
        const fileExtension = file.name.split('.').pop();
        const uniqueFileName = `${safeTeamName}_logo_${uuidv4()}.${fileExtension}`;
        const filePath = `team-logos/${uniqueFileName}`;

        const buffer = Buffer.from(await file.arrayBuffer());
        const bucketFile = bucket.file(filePath);

        await bucketFile.save(buffer, { metadata: { contentType: file.type } });
        await bucketFile.makePublic();
        const publicUrl = bucketFile.publicUrl();

        return { success: true, url: publicUrl };
    } catch (error) {
        console.error("Error uploading team logo:", error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        return { success: false, message: `Upload failed: ${errorMessage}` };
    }
}

// --- Single Screenshot Upload Action ---
export async function uploadPlayerScreenshot(formData: FormData): Promise<{ success: true, url: string } | { success: false, message: string }> {
    const file = formData.get('screenshot') as File;
    const teamName = formData.get('teamName') as string;
    const nickname = formData.get('nickname') as string;

    if (!file || !teamName || !nickname) {
        return { success: false, message: 'Missing file, team name, or nickname for upload.' };
    }

    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    if (!bucketName) {
        return { success: false, message: 'Server configuration error: Storage bucket not found.' };
    }

    try {
        const bucket = adminStorage.bucket(bucketName);
        const safeTeamName = teamName.replace(/[^a-zA-Z0-9]/g, '_');
        const safeNickname = nickname.replace(/[^a-zA-Z0-9]/g, '_');
        const fileExtension = file.name.split('.').pop();
        const uniqueFileName = `${safeNickname}_${uuidv4()}.${fileExtension}`;
        const filePath = `screenshots/${safeTeamName}/${uniqueFileName}`;

        const buffer = Buffer.from(await file.arrayBuffer());
        const bucketFile = bucket.file(filePath);

        await bucketFile.save(buffer, { metadata: { contentType: file.type } });
        await bucketFile.makePublic();
        const publicUrl = bucketFile.publicUrl();

        return { success: true, url: publicUrl };
    } catch (error) {
        console.error("Error uploading player screenshot:", error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        return { success: false, message: `Upload failed: ${errorMessage}` };
    }
}

// --- Team Registration Action (Handles Steam ID resolution and Logo Upload) ---
export async function registerTeam(teamData: {
    name: string;
    tag: string;
    motto: string;
    logoUrl: string; // Now expecting a URL
    captainDiscordUsername: string;
    createdBy: string;
    players: (Omit<Player, 'id' | 'steamId' | 'openDotaAccountId'> & { steamUrl: string })[];
}) {
    const { name, tag, motto, logoUrl, captainDiscordUsername, createdBy, players } = teamData;

    if (!name || !logoUrl || !captainDiscordUsername || !createdBy || !players || players.length < 5) {
        return { success: false, message: 'Missing critical team data for registration.' };
    }
    
    const existingTeamCheck = await getUserTeam(createdBy);
    if (existingTeamCheck.hasTeam) {
        return { success: false, message: 'This user has already registered a team.' };
    }

    try {
        const teamRef = adminDb.collection('teams').doc();
        
        const teamPayload = {
            name,
            tag,
            motto,
            logoUrl, // Saving the logo URL
            captainDiscordUsername,
            captainId: createdBy,
            createdBy,
            createdAt: new Date(),
            status: 'pending',
            wins: 0,
            losses: 0,
        };

        const batch = adminDb.batch();
        batch.set(teamRef, teamPayload);

        const playersCollectionRef = teamRef.collection('players');
        
        for (const player of players) {
            const playerRef = playersCollectionRef.doc();
            
            // Resolve Steam URLs and get player summary on the server
            const steamId = await getSteam64IdFromUrl(player.steamUrl);
            const openDotaAccountId = await getOpenDotaAccountIdFromUrl(player.steamUrl);
            const summary = await getSteamPlayerSummary(steamId);

            batch.set(playerRef, { 
                ...player, 
                id: playerRef.id, 
                steamId, 
                openDotaAccountId,
                avatarUrlSmall: summary.avatar,
                avatarUrlMedium: summary.avatarmedium,
                avatarUrlFull: summary.avatarfull,
            });
        }

        await batch.commit();

        revalidatePath('/register');
        revalidatePath('/my-team');
        revalidatePath('/teams');
        return { success: true, message: `Team "${name}" registered successfully!` };

    } catch (error) {
        console.error("Error in registerTeam DB operation:", error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        return { success: false, message: `Failed to save team data: ${errorMessage}` };
    }
}

// --- Group Stage Match Generation ---
export async function generateGroupStageMatches(groupId: string, deadline: Date) {
    try {
        await verifyAdmin();
        const groupRef = adminDb.collection('groups').doc(groupId);
        const groupDoc = await groupRef.get();

        if (!groupDoc.exists) {
            return { success: false, message: "Group not found." };
        }

        const groupData = groupDoc.data();
        const teamIds = groupData?.teams || [];

        if (teamIds.length < 2) {
            return { success: false, message: "Group must have at least two teams." };
        }

        // Generate all unique pairs of teams
        const matchesToCreate = [];
        for (let i = 0; i < teamIds.length; i++) {
            for (let j = i + 1; j < teamIds.length; j++) {
                matchesToCreate.push([teamIds[i], teamIds[j]]);
            }
        }
        
        // --- Smart Default Scheduling Algorithm ---
        const schedule: { [key: string]: string[] } = {}; // Maps date string to list of team IDs playing
        const deadlineDate = new Date(deadline);
        let currentSchedulingDate = new Date(deadlineDate);

        const batch = adminDb.batch();

        for (const [teamAId, teamBId] of matchesToCreate) {
            // Find a valid date for this match, working backwards from the deadline
            let scheduled = false;
            while (!scheduled) {
                const dateStr = currentSchedulingDate.toISOString().split('T')[0];
                if (!schedule[dateStr]) {
                    schedule[dateStr] = [];
                }

                if (!schedule[dateStr].includes(teamAId) && !schedule[dateStr].includes(teamBId)) {
                    // This slot is available for both teams
                    schedule[dateStr].push(teamAId, teamBId);

                    const defaultMatchTime = new Date(currentSchedulingDate);
                    defaultMatchTime.setUTCHours(20, 0, 0, 0); // Set to 20:00 UTC

                    const matchRef = adminDb.collection('matches').doc();
                    batch.set(matchRef, {
                        teamA: { id: teamAId },
                        teamB: { id: teamBId },
                        teams: [teamAId, teamBId],
                        roundDeadline: firestore.Timestamp.fromDate(deadlineDate),
                        defaultMatchTime: firestore.Timestamp.fromDate(defaultMatchTime),
                        schedulingStatus: 'unscheduled',
                        status: 'upcoming',
                    });

                    scheduled = true;
                } else {
                    // Slot is taken, move to the previous day
                    currentSchedulingDate.setDate(currentSchedulingDate.getDate() - 1);
                }
            }
        }

        await batch.commit();
        revalidatePath('/admin/stages');
        revalidatePath('/schedule');
        revalidatePath('/my-team');

        return { success: true, message: `Successfully generated ${matchesToCreate.length} matches.` };

    } catch (error) {
        console.error("Error generating group stage matches:", error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        return { success: false, message: `Failed to generate matches: ${errorMessage}` };
    }
}

// --- Testing Tool: Create Test Group ---
export async function createTestGroup() {
    try {
        await verifyAdmin();
        const batch = adminDb.batch();
        const teamIds = [];

        // Create 3 dummy teams
        for (let i = 1; i <= 3; i++) {
            const teamRef = adminDb.collection('teams').doc(`test_team_${i}`);
            const captainId = `test_captain_${i}`;
            teamIds.push(teamRef.id);
            
            batch.set(teamRef, {
                name: `Test Team ${i}`,
                tag: `TT${i}`,
                captainId: captainId,
                captainDiscordUsername: `TestCaptain#000${i}`,
                logoUrl: `https://placehold.co/128x128.png?text=TT${i}`,
                status: 'verified',
                wins: 0,
                losses: 0,
            });
        }
        
        // Create a group for these teams
        const groupRef = adminDb.collection('groups').doc('test_group');
        batch.set(groupRef, {
            name: "Test Group",
            teams: teamIds,
        });

        await batch.commit();
        revalidatePath('/admin/stages');
        return { success: true };
    } catch (error) {
        console.error("Error creating test group:", error);
        return { success: false, message: "Failed to write to database." };
    }
}

export async function createTestTeam(data: { name: string, tag: string }) {
    try {
        await verifyAdmin(); // Secure the action
        const { name, tag } = data;
        const decodedToken = await verifyAdmin();

        const teamData = {
            name,
            tag,
            captainId: decodedToken.uid,
            createdAt: new Date().toISOString(),
            status: 'verified', // Test teams are auto-verified
        };

        const newTeamRef = adminDb.collection('teams').doc();
        await newTeamRef.set(teamData);

        return { success: true, teamId: newTeamRef.id };
    } catch (error) {
        return { success: false, message: (error as Error).message };
    }
}

export async function getGroups(): Promise<{id: string, name: string}[]> {
    try {
      await verifyAdmin();
      const groupsSnapshot = await adminDb.collection('groups').get();
      if (groupsSnapshot.empty) {
        return [];
      }
      return groupsSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name as string,
      }));
    } catch (error) {
      console.error("Failed to get groups:", error);
      return [];
    }
}

// --- Other Actions ---
export async function getTournamentStatus(): Promise<TournamentStatus> {
    try {
        await verifyAdmin();
        const docRef = adminDb.collection('tournament').doc('status');
        const docSnap = await docRef.get();
        if (docSnap.exists()) {
            return docSnap.data() as TournamentStatus;
        }
        return { registrationOpen: false, currentStage: 'initial', verificationRequired: true };
    } catch (error) {
        console.error("Error fetching tournament status:", error);
        return { registrationOpen: false, currentStage: 'Unknown', verificationRequired: true };
    }
}

export async function getUserTeam(userId: string) {
    if (!userId) return { hasTeam: false, team: null };
    try {
        const snapshot = await adminDb.collection('teams').where('captainId', '==', userId).limit(1).get();
        if (snapshot.empty) return { hasTeam: false, team: null };
        const teamDoc = snapshot.docs[0];
        return { hasTeam: true, team: { id: teamDoc.id, name: teamDoc.data().name } };
    } catch(error) {
        console.error("Error getting user team:", error);
        return { hasTeam: false, team: null };
    }
}
