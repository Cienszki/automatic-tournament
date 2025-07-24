
// src/lib/admin-actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { getAdminDb, getAdminAuth, ensureAdminInitialized, getAdminApp } from './admin';
import type { Group, GroupStanding, Team, Player, Match } from './definitions';
import { PlayerRoles, TeamStatus } from './definitions';
import { getAllTeams as fetchAllTeams, getAllGroups as fetchAllGroups, getTeamById, getAllMatches } from './firestore';
import { Timestamp } from 'firebase-admin/firestore';
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

// --- AUTHENTICATION & ACTION WRAPPER ---
// This wrapper now requires the token to be passed in explicitly.
async function performAdminAction<T>(
    token: string | null, 
    action: (decodedToken: any) => Promise<{ success: boolean; message: string; data?: T }>
): Promise<{ success: boolean; message: string; data?: T }> {
    try {
        ensureAdminInitialized();
        if (!token) {
            throw new Error('Authentication token not provided.');
        }
        
        const decodedToken = await getAdminAuth().verifyIdToken(token);
        
        const adminDoc = await getAdminDb().collection('admins').doc(decodedToken.uid).get();
        if (!adminDoc.exists) {
            throw new Error('Not authorized as an admin.');
        }

        return await action(decodedToken);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        console.error("Admin action failed:", error);
        return { success: false, message: `An unexpected error occurred: ${errorMessage}` };
    }
}


export async function createTestTeam(token: string, data: { name: string; tag: string }): Promise<{ success: boolean; message: string }> {
    return performAdminAction(token, async (decodedToken) => {
        const teamData = {
            ...data,
            captainId: decodedToken.uid,
            createdAt: Timestamp.now(),
            status: 'verified' as TeamStatus,
            logoUrl: 'https://placehold.co/128x128.png',
        };
        const newTeamRef = getAdminDb().collection('teams').doc();
        await newTeamRef.set(teamData);
        return { success: true, message: 'Test team created successfully.' };
    });
}


export async function updateTeamStatus(token: string, teamId: string, status: TeamStatus): Promise<{ success: boolean; error?: string }> {
     return performAdminAction(token, async () => {
        await getAdminDb().collection("teams").doc(teamId).update({ status });
        revalidatePath('/admin');
        return { success: true, message: "Team status updated." };
    }).then(res => ({ success: res.success, error: res.success ? undefined : res.message }));
}

// --- TEAM ACTIONS ---
// Note: These actions manage their own auth for now, they don't use the wrapper.
export async function createFakeTeam(isTestTeam = false): Promise<{ success: boolean; message: string; data?: { teamId: string, captainEmail: string, captainPassword: string } }> {
    try {
        ensureAdminInitialized();
        const auth = getAdminAuth();
        const batch = getAdminDb().batch();
        const teamRef = getAdminDb().collection('teams').doc();
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
            id: teamId,
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
        revalidatePath('/my-team');
        return { success: true, message: `Fake team "${teamName}" created successfully.`, data: { teamId, captainEmail, captainPassword } };
    } catch(error) {
         const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        console.error("Fake team creation failed:", error);
        return { success: false, message: `An unexpected error occurred: ${errorMessage}` };
    }
}

export async function deleteTeam(token: string, teamId: string): Promise<{ success: boolean; message: string }> {
    return performAdminAction(token, async () => {
        const teamRef = getAdminDb().collection('teams').doc(teamId);
        const teamDoc = await teamRef.get();
        const teamData = teamDoc.data();

        if (teamData?.captainId && teamData.testCaptainEmail) {
            try {
                await getAdminAuth().deleteUser(teamData.captainId);
            } catch (error: any) {
                if (error.code !== 'auth/user-not-found') {
                    console.error(`Failed to delete auth user ${teamData.captainId}:`, error);
                }
            }
        }
        
        const playersRef = teamRef.collection('players');
        const playersSnapshot = await playersRef.get();
        const batch = getAdminDb().batch();
        playersSnapshot.docs.forEach(doc => batch.delete(doc.ref));
        batch.delete(teamRef);

        await batch.commit();
        revalidatePath('/admin');
        return { success: true, message: `Team ${teamId} and its players deleted.` };
    });
}

// --- GROUP ACTIONS ---
export async function createGroup(token: string, groupName: string, teamIds: string[]): Promise<{ success: boolean; message: string }> {
     return performAdminAction(token, async () => {
        if (!groupName || teamIds.length === 0) {
            return { success: false, message: 'Group name and at least one team are required.' };
        }
        const batch = getAdminDb().batch();
        const groupRef = getAdminDb().collection('groups').doc(groupName.toLowerCase().replace(/\s+/g, '-'));
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

export async function deleteGroup(token: string, groupId: string): Promise<{ success: boolean; message:string }> {
     return performAdminAction(token, async () => {
        const batch = getAdminDb().batch();
        const groupRef = getAdminDb().collection('groups').doc(groupId);
        batch.delete(groupRef);

        const matchesQuery = getAdminDb().collection('matches').where('group_id', '==', groupId);
        const matchesSnapshot = await matchesQuery.get();
        matchesSnapshot.docs.forEach(doc => batch.delete(doc.ref));

        await batch.commit();

        revalidatePath('/groups');
        revalidatePath('/admin');
        revalidatePath('/schedule');
        return { success: true, message: `Group ${groupId} and its ${matchesSnapshot.size} matches deleted.` };
    });
}

export async function deleteAllGroups(token: string): Promise<{ success: boolean; message: string }> {
    return performAdminAction(token, async () => {
        const batch = getAdminDb().batch();
        
        const groupsCollectionRef = getAdminDb().collection('groups');
        const groupsSnapshot = await groupsCollectionRef.get();
        if (groupsSnapshot.empty) return { success: true, message: 'No groups to delete.' };
        groupsSnapshot.docs.forEach(doc => batch.delete(doc.ref));

        const matchesCollectionRef = getAdminDb().collection('matches');
        const matchesSnapshot = await matchesCollectionRef.get();
        matchesSnapshot.docs.forEach(doc => {
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
export async function deleteSelectedMatches(token: string, matchIds: string[]): Promise<{ success: boolean; message: string }> {
    return performAdminAction(token, async () => {
        if (!matchIds || matchIds.length === 0) {
            return { success: false, message: 'No match IDs provided.' };
        }
        const batch = getAdminDb().batch();
        const matchesCollection = getAdminDb().collection('matches');
        matchIds.forEach(id => {
            batch.delete(matchesCollection.doc(id));
        });
        await batch.commit();
        revalidatePath('/schedule');
        revalidatePath('/admin');
        return { success: true, message: `${matchIds.length} matches deleted.` };
    });
}

export async function deleteAllMatches(token: string): Promise<{ success: boolean; message: string }> {
    return performAdminAction(token, async () => {
        const matchesCollection = getAdminDb().collection('matches');
        const snapshot = await matchesCollection.get();
        if (snapshot.empty) {
            return { success: true, message: 'No matches to delete.' };
        }
        const batch = getAdminDb().batch();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        revalidatePath('/schedule');
        revalidatePath('/admin');
        return { success: true, message: `${snapshot.size} matches deleted.` };
    });
}

export async function generateMatchesForGroup(token: string, groupId: string, deadline: Date | null): Promise<{ success: boolean; message: string; data?: { matchesCreated: number } }> {
    return performAdminAction(token, async () => {
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
        
        const batch = getAdminDb().batch();
        const matchesCollection = getAdminDb().collection('matches');
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
                    status: 'pending',
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

export async function revertMatchToPending(token: string, matchId: string): Promise<{ success: boolean; message: string }> {
    return performAdminAction(token, async () => {
        const matchRef = getAdminDb().collection('matches').doc(matchId);
        
        await matchRef.update({
            status: 'pending',
            schedulingStatus: 'unscheduled',
            'teamA.score': 0,
            'teamB.score': 0,
            opendota_match_id: null,
            completed_at: null,
            dateTime: null,
            proposedTime: null,
            proposingCaptainId: null,
        });

        revalidatePath('/schedule');
        revalidatePath('/admin');
        revalidatePath('/my-team');
        return { success: true, message: `Match ${matchId} has been reverted to pending.` };
    });
}


// --- TEST SCENARIOS ---
export async function createTestGroup(token: string): Promise<{ success: boolean; message: string; data?: { groupId: string, teams: any[] } }> {
     return performAdminAction(token, async () => {
        const teamCreationPromises = Array.from({ length: 4 }, () => createFakeTeam(true));
        const teamResults = await Promise.all(teamCreationPromises);

        const createdTeams = teamResults.map(res => {
            if (!res.success || !res.data) throw new Error("Failed to create one of the test teams during scenario setup.");
            return res.data;
        });
        
        const groupName = `Test Group ${Math.floor(Math.random() * 100)}`;
        // This internal call doesn't have access to the original token, 
        // but createGroup doesn't actually need admin privileges beyond the wrapper.
        // For now, we'll pass a dummy token, but a better refactor would be to separate
        // the action logic from the permission logic.
        const createGroupResult = await createGroup("dummy-token-internal-call", groupName, createdTeams.map(t => t.teamId));
        if (!createGroupResult.success) {
            throw new Error(`Failed to create the group for the scenario: ${createGroupResult.message}`);
        }

        revalidatePath('/admin');
        return { success: true, message: `Test group '${groupName}' created with 4 teams.`, data: { groupId: groupName.toLowerCase().replace(/\s+/g, '-'), teams: createdTeams } };
    });
}

export async function updateMatchScore(
    token: string,
    matchId: string,
    teamAScore: number,
    teamBScore: number
): Promise<{ success: boolean; message: string }> {
    return performAdminAction(token, async () => {
        const matchRef = getAdminDb().collection('matches').doc(matchId);
        const matchDoc = await matchRef.get();
        if (!matchDoc.exists) {
            return { success: false, message: "Match not found." };
        }

        const isReverting = teamAScore === 0 && teamBScore === 0;

        await matchRef.update({
            "teamA.score": teamAScore,
            "teamB.score": teamBScore,
            status: isReverting ? 'scheduled' : 'completed',
        });

        revalidatePath('/admin/StageManagementTab');
        revalidatePath('/schedule');

        const message = isReverting
            ? `Match ${matchId} score reverted and status set to scheduled.`
            : `Match ${matchId} score updated and status set to completed.`;
        
        return { success: true, message };
    });
}


// --- DATA FETCHING ---
export async function getTeams(): Promise<Team[]> { return fetchAllTeams(); }
export async function getGroups(): Promise<Group[]> { return fetchAllGroups(); }
export async function getMatches(): Promise<Match[]> { return getAllMatches(); }
export async function getTournamentStatus() {
    return { currentStage: "Group Stage" };
}
