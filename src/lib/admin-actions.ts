// src/lib/admin-actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { adminDb, ensureAdminInitialized } from './admin';
import type { Group, GroupStanding, Team, Player, Match } from './definitions';
import { PlayerRoles, TeamStatus } from './definitions';
import { getAllTeams as fetchAllTeams, getAllGroups as fetchAllGroups, getTeamById, getAllMatches } from './firestore';
import { Timestamp } from 'firebase-admin/firestore';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { toZonedTime } from 'date-fns-tz';


// --- UTILITY ---
const generatePassword = (length = 10) => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let password = '';
    for (let i = 0; i < length; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
};

// --- ACTION WRAPPER ---
// This new wrapper centralizes auth checks, initialization, and error handling.
// It directly returns the result of the action function, which should be a { success, message, data? } object.
async function performAdminAction<T>(action: () => Promise<{ success: boolean; message: string; data?: T }>): Promise<{ success: boolean; message: string; data?: T }> {
    try {
        await ensureAdminInitialized();
        if (!adminDb) {
            throw new Error("Firebase Admin is not initialized.");
        }
        return await action();
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        console.error("Admin action failed:", error);
        return { success: false, message: `An unexpected error occurred: ${errorMessage}` };
    }
}

// --- AUTHENTICATION ---
async function verifyAdmin(token: string) {
    if (!token) {
      throw new Error('Not authenticated');
    }
    await ensureAdminInitialized();
    const decodedToken = await getAdminAuth(adminDb.app).verifyIdToken(token);
    const adminDoc = await adminDb.collection('admins').doc(decodedToken.uid).get();
    if (!adminDoc.exists) {
      throw new Error('Not authorized');
    }
    return decodedToken;
}

export async function updateTeamStatus(teamId: string, status: TeamStatus, token: string): Promise<{ success: boolean; message: string }> {
    return performAdminAction(async () => {
        await verifyAdmin(token);
        await adminDb.collection("teams").doc(teamId).update({ status });
        revalidatePath('/admin');
        return { success: true, message: `Team status updated to ${status}.` };
    });
}


// --- TEAM ACTIONS ---
export async function createFakeTeam(isTestTeam = false): Promise<{ success: boolean; message: string; data?: { teamId: string, captainEmail: string, captainPassword: string } }> {
    return performAdminAction(async () => {
        const auth = getAdminAuth(adminDb.app);
        const batch = adminDb.batch();
        const teamRef = adminDb.collection('teams').doc();
        const teamId = teamRef.id;

        const randomSuffix = Math.random().toString(36).substring(2, 8);
        const captainEmail = `test-captain-${randomSuffix}@example.com`;
        const captainPassword = generatePassword();
        
        const userRecord = await auth.createUser({
            email: captainEmail,
            password: captainPassword,
            displayName: `Captain ${randomSuffix}`,
        });

        const teamName = isTestTeam ? `TestTeam-${randomSuffix}` : `Team-${randomSuffix}`;
        const fakeTeamData = {
            id: teamId, // Storing the document ID inside the document itself
            name: teamName,
            tag: `T${randomSuffix.substring(0,3)}`,
            logoUrl: 'https://placehold.co/128x128.png',
            captainId: userRecord.uid,
            discordUsername: `captain#${Math.floor(Math.random() * 9000) + 1000}`,
            motto: "We play for fun... and glory!",
            status: 'verified' as TeamStatus,
            testCaptainEmail: captainEmail,
            testCaptainPassword: captainPassword,
            createdAt: Timestamp.now(),
        };
        batch.set(teamRef, fakeTeamData);

        const playersCollectionRef = teamRef.collection('players');
        const roles = [...PlayerRoles];
        for (let i = 0; i < 5; i++) {
            const playerRef = playersCollectionRef.doc();
            batch.set(playerRef, {
                id: playerRef.id,
                nickname: `Player-${Math.random().toString(36).substring(2, 8)}`,
                mmr: Math.floor(Math.random() * 6000) + 2000,
                role: roles[i % roles.length],
                steamId: `https://steamcommunity.com/id/fakeplayer${i+1}`,
                profileScreenshotUrl: 'https://placehold.co/800x600.png',
            });
        }

        await batch.commit();
        revalidatePath('/admin');
        return { success: true, message: `Fake team "${teamName}" created successfully.`, data: { teamId, captainEmail, captainPassword } };
    });
}

export async function deleteTeam(teamId: string): Promise<{ success: boolean; message: string }> {
    return performAdminAction(async () => {
        const teamRef = adminDb.collection('teams').doc(teamId);
        const teamDoc = await teamRef.get();
        const teamData = teamDoc.data();

        if (teamData?.captainId && teamData.testCaptainEmail) {
            try {
                await getAdminAuth(adminDb.app).deleteUser(teamData.captainId);
            } catch (error: any) {
                if (error.code !== 'auth/user-not-found') {
                    console.error(`Failed to delete auth user ${teamData.captainId}:`, error);
                }
            }
        }
        
        const playersRef = teamRef.collection('players');
        const playersSnapshot = await playersRef.get();
        const batch = adminDb.batch();
        playersSnapshot.docs.forEach(doc => batch.delete(doc.ref));
        batch.delete(teamRef);

        await batch.commit();
        revalidatePath('/admin');
        return { success: true, message: `Team ${teamId} and its players deleted.` };
    });
}

// --- GROUP ACTIONS ---
export async function createGroup(groupName: string, teamIds: string[]): Promise<{ success: boolean; message: string }> {
    return performAdminAction(async () => {
        if (!groupName || teamIds.length === 0) {
            return { success: false, message: 'Group name and at least one team are required.' };
        }
        const batch = adminDb.batch();
        const groupRef = adminDb.collection('groups').doc(groupName.toLowerCase().replace(/\s+/g, '-'));
        const initialStandings: { [teamId: string]: GroupStanding } = {};
        teamIds.forEach(teamId => {
            initialStandings[teamId] = { teamId, teamName: 'Fetching...', teamLogoUrl: '', matchesPlayed: 0, points: 0, wins: 0, losses: 0, headToHead: {}, neustadtlScore: 0, status: 'pending' };
        });
        batch.set(groupRef, { name: groupName, standings: initialStandings });
        await batch.commit();
        revalidatePath('/groups');
        revalidatePath('/admin');
        return { success: true, message: `Group '${groupName}' created successfully.` };
    });
}

export async function deleteGroup(groupId: string): Promise<{ success: boolean; message:string }> {
     return performAdminAction(async () => {
        const batch = adminDb.batch();
        
        const groupRef = adminDb.collection('groups').doc(groupId);
        batch.delete(groupRef);

        const matchesQuery = adminDb.collection('matches').where('group_id', '==', groupId);
        const matchesSnapshot = await matchesQuery.get();
        matchesSnapshot.docs.forEach(doc => batch.delete(doc.ref));

        await batch.commit();

        revalidatePath('/groups');
        revalidatePath('/admin');
        revalidatePath('/schedule');
        return { success: true, message: `Group ${groupId} and its ${matchesSnapshot.size} matches deleted.` };
    });
}

export async function deleteAllGroups(): Promise<{ success: boolean; message: string }> {
    return performAdminAction(async () => {
        const batch = adminDb.batch();
        
        const groupsCollectionRef = adminDb.collection('groups');
        const groupsSnapshot = await groupsCollectionRef.get();
        if (groupsSnapshot.empty) return { success: true, message: 'No groups to delete.' };
        groupsSnapshot.docs.forEach(doc => batch.delete(doc.ref));

        const matchesCollectionRef = adminDb.collection('matches');
        const matchesSnapshot = await matchesCollectionRef.get();
        matchesSnapshot.docs.forEach(doc => {
            // We only delete matches that belong to a group, preserving other potential matches
            if (doc.data().group_id) {
                batch.delete(doc.ref);
            }
        });

        await batch.commit();
        
        revalidatePath('/groups');
        revalidatePath('/admin');
        revalidatePath('/schedule');
        return { success: true, message: `${groupsSnapshot.size} groups and their associated matches deleted.` };
    });
}

// --- MATCH ACTIONS ---
export async function deleteSelectedMatches(matchIds: string[]): Promise<{ success: boolean; message: string }> {
    return performAdminAction(async () => {
        if (!matchIds || matchIds.length === 0) {
            return { success: false, message: 'No match IDs provided.' };
        }
        const batch = adminDb.batch();
        const matchesCollection = adminDb.collection('matches');
        matchIds.forEach(id => {
            batch.delete(matchesCollection.doc(id));
        });
        await batch.commit();
        revalidatePath('/schedule');
        revalidatePath('/admin');
        return { success: true, message: `${matchIds.length} matches deleted.` };
    });
}

export async function deleteAllMatches(): Promise<{ success: boolean; message: string }> {
    return performAdminAction(async () => {
        const matchesCollection = adminDb.collection('matches');
        const snapshot = await matchesCollection.get();
        if (snapshot.empty) {
            return { success: true, message: 'No matches to delete.' };
        }
        const batch = adminDb.batch();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        revalidatePath('/schedule');
        revalidatePath('/admin');
        return { success: true, message: `${snapshot.size} matches deleted.` };
    });
}

export async function generateMatchesForGroup(groupId: string, deadline: Date | null): Promise<{ success: boolean; message: string; data?: { matchesCreated: number } }> {
    return performAdminAction(async () => {
        const allGroups = await fetchAllGroups(true);
        const group = allGroups.find(g => g.id === groupId);
        if (!group) throw new Error(`Group with ID ${groupId} not found.`);

        const allExistingMatches = await getAllMatches();
        const allTeams = await fetchAllTeams(true);
        const teamsMap = new Map(allTeams.map(t => [t.id, t]));

        const existingTimes = new Set(allExistingMatches.map(m => new Date(m.defaultMatchTime).getTime()));
        const existingMatchPairsInGroup = new Set(
            allExistingMatches
                .filter(m => m.group_id === groupId)
                .map(m => [...m.teams].sort().join('-'))
        );
        
        const batch = adminDb.batch();
        const matchesCollection = adminDb.collection('matches');
        let matchesCreated = 0;
        const timeZone = "Europe/Warsaw"; 
        
        let scheduleDate = deadline ? toZonedTime(deadline, timeZone) : toZonedTime(new Date(), timeZone);
        scheduleDate.setHours(0, 0, 0, 0);

        const timeSlots = [18, 21];
        const teamIds = Object.keys(group.standings);

        if (teamIds.length < 2) {
             return { success: true, message: "Not enough teams in the group to create matches.", data: { matchesCreated: 0 } };
        }

        for (let i = 0; i < teamIds.length; i++) {
            for (let j = i + 1; j < teamIds.length; j++) {
                const teamA = teamsMap.get(teamIds[i]);
                const teamB = teamsMap.get(teamIds[j]);
                if (!teamA || !teamB) continue;

                const sortedIds = [teamA.id, teamB.id].sort().join('-');
                if (existingMatchPairsInGroup.has(sortedIds)) continue;

                let matchTime!: Date;
                let foundSlot = false;
                while (!foundSlot) {
                    for (const hour of timeSlots) {
                        const potentialDate = new Date(scheduleDate);
                        potentialDate.setHours(hour, 0, 0, 0);
                        const potentialTime = toZonedTime(potentialDate, timeZone);

                        if (!existingTimes.has(potentialTime.getTime())) {
                            matchTime = potentialTime;
                            existingTimes.add(matchTime.getTime());
                            foundSlot = true;
                            break;
                        }
                    }
                    if (!foundSlot) {
                        scheduleDate.setDate(scheduleDate.getDate() + 1);
                    }
                }

                const matchRef = matchesCollection.doc();
                batch.set(matchRef, {
                    teamA: { id: teamA.id, name: teamA.name, score: 0, logoUrl: teamA.logoUrl },
                    teamB: { id: teamB.id, name: teamB.name, score: 0, logoUrl: teamB.logoUrl },
                    teams: [teamA.id, teamB.id],
                    status: 'scheduled',
                    scheduled_for: Timestamp.fromDate(deadline || matchTime),
                    defaultMatchTime: matchTime.toISOString(),
                    group_id: group.id,
                    schedulingStatus: 'unscheduled',
                });
                matchesCreated++;
            }
        }

        if (matchesCreated === 0) {
            return { success: true, message: `All possible matches for ${group.name} already exist.`, data: { matchesCreated } };
        }
        
        await batch.commit();
        revalidatePath('/schedule');
        revalidatePath('/admin');
        return { success: true, message: `Generated ${matchesCreated} new matches for ${group.name}.`, data: { matchesCreated } };
    });
}

// --- TEST SCENARIOS ---
export async function createTestGroup(): Promise<{ success: boolean; message: string; data?: { groupId: string, teams: any[] } }> {
    return performAdminAction(async () => {
        const teamCreationPromises = Array.from({ length: 4 }, () => createFakeTeam(true));
        const teamResults = await Promise.all(teamCreationPromises);

        const createdTeams = teamResults.map(res => {
            if (!res.success || !res.data) throw new Error("Failed to create one of the test teams during scenario setup.");
            return res.data;
        });
        
        const groupName = `Test Group ${Math.floor(Math.random() * 100)}`;
        const createGroupResult = await createGroup(groupName, createdTeams.map(t => t.teamId));
        if (!createGroupResult.success) {
            throw new Error(`Failed to create the group for the scenario: ${createGroupResult.message}`);
        }

        revalidatePath('/admin');
        return { success: true, message: `Test group '${groupName}' created with 4 teams.`, data: { groupId: groupName.toLowerCase().replace(/\s+/g, '-'), teams: createdTeams } };
    });
}


// --- DATA FETCHING ---
export async function getUserTeam(userId: string): Promise<{ hasTeam: boolean; team?: Team | null; }> {
    await ensureAdminInitialized();
    const q = adminDb.collection('teams').where('captainId', '==', userId);
    const querySnapshot = await q.get();
    if (querySnapshot.empty) return { hasTeam: false, team: null };
    const team = await getTeamById(querySnapshot.docs[0].id); 
    return { hasTeam: true, team };
}

export async function getTeams(): Promise<Team[]> { return fetchAllTeams(); }
export async function getGroups(): Promise<Group[]> { return fetchAllGroups(); }
export async function getMatches(): Promise<Match[]> { return getAllMatches(); }
