
// src/lib/admin-actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { getAdminDb, getAdminAuth, ensureAdminInitialized, getAdminApp } from '../../server/lib/admin';
import type { Group, GroupStanding, Team, Player, Match } from './definitions';
import { PlayerRoles, TeamStatus } from './definitions';
import { getAllGroups as fetchAllGroups, getTeamById, getAllMatches } from './firestore';
// Admin-side getAllTeams using Admin SDK
export async function getAllTeamsAdmin(): Promise<Team[]> {
    ensureAdminInitialized();
    const db = getAdminDb();
    const teamsSnapshot = await db.collection('teams').get();
    const teams: Team[] = [];
    for (const docSnap of teamsSnapshot.docs) {
        const teamData = docSnap.data();
        // Fetch players subcollection
        const playersSnapshot = await db.collection('teams').doc(docSnap.id).collection('players').get();
        const players = playersSnapshot.docs.map(playerDoc => playerDoc.data() as Player);
        teams.push({
            id: docSnap.id,
            ...teamData,
            players,
            createdAt: teamData.createdAt && typeof teamData.createdAt.toDate === 'function'
                ? teamData.createdAt.toDate().toISOString()
                : new Date(0).toISOString(),
        } as Team);
    }
    return teams;
}

// Admin-side getAllGroups using Admin SDK
export async function getAllGroupsAdmin(): Promise<Group[]> {
    ensureAdminInitialized();
    const db = getAdminDb();
    const groupsSnapshot = await db.collection('groups').get();
    const groups = groupsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            name: data.name,
            standings: data.standings || {},
        } as Group;
    });
    return groups;
}

// Admin-side getAllMatches using Admin SDK
export async function getAllMatchesAdmin(): Promise<Match[]> {
    ensureAdminInitialized();
    const db = getAdminDb();
    const matchesSnapshot = await db.collection('matches').get();
    return matchesSnapshot.docs.map(doc => {
        const data = doc.data();
        return { 
            id: doc.id, 
            ...data,
            // Convert Timestamps to ISO strings for client compatibility
            scheduled_for: data.scheduled_for && typeof data.scheduled_for.toDate === 'function'
                ? data.scheduled_for.toDate().toISOString()
                : data.scheduled_for,
            defaultMatchTime: data.defaultMatchTime && typeof data.defaultMatchTime.toDate === 'function'
                ? data.defaultMatchTime.toDate().toISOString()
                : data.defaultMatchTime,
            dateTime: data.dateTime && typeof data.dateTime.toDate === 'function'
                ? data.dateTime.toDate().toISOString()
                : data.dateTime,
            proposedTime: data.proposedTime && typeof data.proposedTime.toDate === 'function'
                ? data.proposedTime.toDate().toISOString()
                : data.proposedTime,
            completed_at: data.completed_at && typeof data.completed_at.toDate === 'function'
                ? data.completed_at.toDate().toISOString()
                : data.completed_at,
        } as Match;
    });
}

import { generatePassword, Timestamp, addDays, format } from './admin-constants';


// --- AUTHENTICATION & ACTION WRAPPER ---
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
            initialStandings[teamId] = { teamId, teamName: 'Fetching...', teamLogoUrl: '', matchesPlayed: 0, points: 0, wins: 0, draws: 0, losses: 0, headToHead: {}, neustadtlScore: 0, status: 'pending', totalMMR: 0 };
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
        console.log("[generateMatchesForGroup] Starting function...");
        
        // Use the same pattern as getAllTeamsAdmin - this works!
        const db = getAdminDb();
        console.log("[generateMatchesForGroup] Database instance type:", typeof db);
        console.log("[generateMatchesForGroup] Database instance constructor:", db.constructor.name);
        
        console.log("[generateMatchesForGroup] About to call getAllGroupsAdmin...");
        const allGroups = await getAllGroupsAdmin();
        console.log("[generateMatchesForGroup] Successfully got groups:", allGroups.length);
        
        const group = allGroups.find(g => g.id === groupId);
        if (!group) throw new Error(`Group with ID ${groupId} not found.`);
        console.log("[generateMatchesForGroup] Found group:", group.name);

        console.log("[generateMatchesForGroup] About to call getAllMatches...");
        const allExistingMatches = await getAllMatchesAdmin();
        console.log("[generateMatchesForGroup] Successfully got matches:", allExistingMatches.length);
        
        console.log("[generateMatchesForGroup] About to call getAllTeamsAdmin...");
        let allTeams;
        try {
            allTeams = await getAllTeamsAdmin();
            console.log("[generateMatchesForGroup] Successfully got teams:", allTeams.length);
        } catch (error) {
            console.error("[generateMatchesForGroup] Error in getAllTeamsAdmin:", error);
            throw error;
        }
        
        const teamsMap = new Map(allTeams.map(t => [t.id, t]));

        const existingTimes = new Set(allExistingMatches.map(m => new Date(m.defaultMatchTime).getTime()));
        const existingMatchPairsInGroup = new Set(
            allExistingMatches
                .filter(m => m.group_id === groupId)
                .map(m => [...m.teams].sort().join('-'))
        );
        
        console.log("[generateMatchesForGroup] About to create batch...");
        let batch;
        try {
            batch = db.batch();
            console.log("[generateMatchesForGroup] Successfully created batch");
        } catch (error) {
            console.error("[generateMatchesForGroup] Error creating batch:", error);
            throw error;
        }
        
        // Try alternative syntax for collection access
        let matchesCollection;
        try {
            console.log("[generateMatchesForGroup] Attempting db.collection('matches')...");
            matchesCollection = db.collection('matches');
            console.log("[generateMatchesForGroup] Successfully got collection");
        } catch (error) {
            console.error("[generateMatchesForGroup] Error with db.collection:", error);
            throw error;
        }
        let matchesCreated = 0;
        
        // Calculate how many matches we need to create
        const teamIds = Object.keys(group.standings);
        if (teamIds.length < 2) {
             return { success: true, message: "Not enough teams in the group to create matches.", data: { matchesCreated: 0 } };
        }

        // Count matches that need to be created
        let matchesToCreate = 0;
        for (let i = 0; i < teamIds.length; i++) {
            for (let j = i + 1; j < teamIds.length; j++) {
                const sortedIds = [teamIds[i], teamIds[j]].sort().join('-');
                if (!existingMatchPairsInGroup.has(sortedIds)) {
                    matchesToCreate++;
                }
            }
        }

        // Enhanced scheduling algorithm
        // Start from today and work forward, allowing more time slots per day
        let scheduleDate = new Date();
        const timeSlots = [18, 21]; // 6 PM and 9 PM Warsaw time only
        const maxDaysToSchedule = 30; // Allow up to 30 days for scheduling
        
        console.log(`[generateMatchesForGroup] Need to create ${matchesToCreate} matches`);
        console.log(`[generateMatchesForGroup] Time slots per day: ${timeSlots.length}`);
        console.log(`[generateMatchesForGroup] Deadline: ${deadline ? deadline.toISOString() : 'None'}`);
        console.log(`[generateMatchesForGroup] Current date: ${scheduleDate.toISOString()}`);
        console.log(`[generateMatchesForGroup] Max days to schedule: ${maxDaysToSchedule}`);
        
        if (deadline) {
            const daysUntilDeadline = Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            console.log(`[generateMatchesForGroup] Days until deadline: ${daysUntilDeadline}`);
        };
        
        // Pre-calculate available time slots
        const availableSlots: Date[] = [];
        let currentDate = new Date(scheduleDate);
        let slotsSkippedAfterDeadline = 0;
        let slotsSkippedDueToConflicts = 0;
        let totalSlotsChecked = 0;
        
        for (let dayOffset = 0; dayOffset < maxDaysToSchedule; dayOffset++) {
            const dayDate = addDays(currentDate, dayOffset);
            
            for (const hour of timeSlots) {
                totalSlotsChecked++;
                const slotTime = new Date(dayDate);
                slotTime.setHours(hour, 0, 0, 0); // Use local time instead of UTC
                
                // Skip if after deadline
                if (deadline && slotTime > deadline) {
                    slotsSkippedAfterDeadline++;
                    continue;
                }
                
                // Only check for conflicts with existing matches in the same group
                const timeKey = slotTime.getTime();
                const hasConflict = allExistingMatches.some(match => {
                    // Only check conflicts within the same group
                    if (match.group_id !== group.id) return false;
                    
                    const matchTime = new Date(match.defaultMatchTime).getTime();
                    return Math.abs(matchTime - timeKey) < 60000; // Within 1 minute tolerance
                });
                
                if (hasConflict) {
                    slotsSkippedDueToConflicts++;
                    continue;
                }
                
                availableSlots.push(slotTime);
            }
        }

        console.log(`[generateMatchesForGroup] Total slots checked: ${totalSlotsChecked}`);
        console.log(`[generateMatchesForGroup] Slots skipped after deadline: ${slotsSkippedAfterDeadline}`);
        console.log(`[generateMatchesForGroup] Slots skipped due to conflicts: ${slotsSkippedDueToConflicts}`);
        console.log(`[generateMatchesForGroup] Found ${availableSlots.length} available time slots`);
        
        // Smart scheduling: Use latest slots and allow simultaneous matches within group
        console.log(`[generateMatchesForGroup] Starting smart scheduling for ${matchesToCreate} matches`);
        
        // Sort available slots in reverse order (latest first)
        availableSlots.sort((a, b) => b.getTime() - a.getTime());
        console.log(`[generateMatchesForGroup] Using slots from latest to earliest, starting with: ${availableSlots[0]?.toISOString()}`);
        
        // Create match pairs that need to be scheduled
        const matchPairs: { teamA: Team, teamB: Team }[] = [];
        for (let i = 0; i < teamIds.length; i++) {
            for (let j = i + 1; j < teamIds.length; j++) {
                const teamA = teamsMap.get(teamIds[i]);
                const teamB = teamsMap.get(teamIds[j]);
                if (!teamA || !teamB) continue;

                const sortedIds = [teamA.id, teamB.id].sort().join('-');
                if (!existingMatchPairsInGroup.has(sortedIds)) {
                    matchPairs.push({ teamA, teamB });
                }
            }
        }
        
        // Schedule matches using latest slots, allowing simultaneous play
        const scheduledMatches: { matchPair: { teamA: Team, teamB: Team }, time: Date }[] = [];
        const usedTeamsBySlot = new Map<string, Set<string>>(); // track which teams are busy at each time
        
        // Process each time slot from latest to earliest
        let remainingMatchPairs = [...matchPairs];
        
        for (const time of availableSlots) {
            if (remainingMatchPairs.length === 0) break;
            
            const timeKey = time.toISOString();
            const busyTeams = usedTeamsBySlot.get(timeKey) || new Set<string>();
            
            // Try to schedule as many non-conflicting matches as possible at this time
            for (let i = remainingMatchPairs.length - 1; i >= 0; i--) {
                const matchPair = remainingMatchPairs[i];
                
                // Check if either team is already busy at this time
                if (busyTeams.has(matchPair.teamA.id) || busyTeams.has(matchPair.teamB.id)) {
                    continue; // Skip this match, teams are busy
                }
                
                // Schedule this match
                scheduledMatches.push({ matchPair, time });
                busyTeams.add(matchPair.teamA.id);
                busyTeams.add(matchPair.teamB.id);
                usedTeamsBySlot.set(timeKey, busyTeams);
                
                // Remove this match from the remaining list
                remainingMatchPairs.splice(i, 1);
                
                console.log(`[generateMatchesForGroup] Scheduled ${matchPair.teamA.name} vs ${matchPair.teamB.name} at ${time.toISOString()}`);
            }
        }
        
        console.log(`[generateMatchesForGroup] Successfully scheduled ${scheduledMatches.length} out of ${matchesToCreate} needed matches`);
        
        if (scheduledMatches.length < matchesToCreate) {
            return { 
                success: false, 
                message: `Could only schedule ${scheduledMatches.length} out of ${matchesToCreate} needed matches. Need more time slots or extend deadline.` 
            };
        }
        
        // Create the matches in Firestore
        for (const { matchPair, time } of scheduledMatches) {
            const matchRef = matchesCollection.doc();
            batch.set(matchRef, {
                teamA: { id: matchPair.teamA.id, name: matchPair.teamA.name, score: 0, logoUrl: matchPair.teamA.logoUrl },
                teamB: { id: matchPair.teamB.id, name: matchPair.teamB.name, score: 0, logoUrl: matchPair.teamB.logoUrl },
                teams: [matchPair.teamA.id, matchPair.teamB.id],
                status: 'pending',
                scheduled_for: Timestamp.fromDate(time),
                defaultMatchTime: time.toISOString(),
                group_id: group.id,
                schedulingStatus: 'unscheduled',
                series_format: 'bo2', // Group stage matches are always BO2
            });
            matchesCreated++;
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

        const matchData = matchDoc.data();
        if (!matchData) {
            return { success: false, message: "Match data not found." };
        }

        const isReverting = teamAScore === 0 && teamBScore === 0;
        
        // Determine winnerId based on scores
        let winnerId = null;
        if (!isReverting) {
            const teamAId = matchData.teams?.[0];
            const teamBId = matchData.teams?.[1];
            
            if (teamAScore > teamBScore) {
                winnerId = teamAId;
            } else if (teamBScore > teamAScore) {
                winnerId = teamBId;
            }
            // If scores are equal, winnerId remains null (draw)
        }

        const updateData: any = {
            "teamA.score": teamAScore,
            "teamB.score": teamBScore,
            status: isReverting ? 'scheduled' : 'completed',
        };

        if (!isReverting) {
            updateData.winnerId = winnerId;
            updateData.completed_at = new Date().toISOString();
        } else {
            updateData.winnerId = null;
            updateData.completed_at = null;
        }

        await matchRef.update(updateData);

        // If match is completed (not reverting), update group standings
        if (!isReverting) {
            try {
                // Import the admin version of standings update
                const { updateStandingsAfterGameAdmin } = await import('./group-actions-admin');
                
                // Create a match object to pass to the standings update function
                const updatedMatch = {
                    id: matchId,
                    ...matchData,
                    teamA: { ...matchData.teamA, score: teamAScore },
                    teamB: { ...matchData.teamB, score: teamBScore },
                    winnerId,
                    status: 'completed'
                };
                
                const standingsResult = await updateStandingsAfterGameAdmin(updatedMatch as any);
                console.log('Standings update result:', standingsResult);
            } catch (error) {
                console.error('Failed to update standings:', error);
                // Don't fail the entire operation - the score update should still succeed
            }
        }

        revalidatePath('/admin/StageManagementTab');
        revalidatePath('/schedule');
        revalidatePath('/groups'); // Invalidate groups page cache

        const message = isReverting
            ? `Match ${matchId} score reverted and status set to scheduled.`
            : `Match ${matchId} score updated and status set to completed.`;
        
        return { success: true, message };
    });
}


// --- DATA FETCHING ---
export async function getTeams(): Promise<Team[]> { return getAllTeamsAdmin(); }
export async function getGroups(): Promise<Group[]> { return getAllGroupsAdmin(); }
export async function getMatches(): Promise<Match[]> { return getAllMatchesAdmin(); }
export async function getTournamentStatus() {
    return { currentStage: "Group Stage" };
}

// --- ADMIN SAVE FUNCTIONS ---
async function saveGameResultsAdmin(ourMatchId: string, game: any, performances: any[]): Promise<void> {
    const { getAdminDb, ensureAdminInitialized } = await import('../../server/lib/admin');
    const { FieldValue } = await import('firebase-admin/firestore');
    ensureAdminInitialized();
    const db = getAdminDb();

    const matchRef = db.collection("matches").doc(ourMatchId);
    
    // Check if the match document exists - if not, this might be a scrim/practice game
    const matchSnap = await matchRef.get();
    if (!matchSnap.exists) {
        console.log(`Match document ${ourMatchId} does not exist. This might be a scrim or practice game - skipping database save.`);
        return; // Gracefully skip saving games for non-tournament matches
    }

    const batch = db.batch();
    const gameRef = matchRef.collection("games").doc(game.id);

    // 1. Add the new game ID to the main match document
    batch.update(matchRef, {
        game_ids: FieldValue.arrayUnion(parseInt(game.id))
    });

    // 2. Set the data for the new game document
    batch.set(gameRef, game);

    // 3. Set the performance data for each player in a subcollection
    performances.forEach(performance => {
        const performanceRef = gameRef.collection("performances").doc(performance.playerId);
        batch.set(performanceRef, performance);
    });

    await batch.commit();
    
    // After saving, check if the match is now complete
    await checkAndUpdateMatchCompletionAdmin(ourMatchId);
}

// Function to calculate match completion based on games
async function checkAndUpdateMatchCompletionAdmin(matchId: string): Promise<void> {
    const { getAdminDb, ensureAdminInitialized } = await import('../../server/lib/admin');
    ensureAdminInitialized();
    const db = getAdminDb();

    const matchRef = db.collection("matches").doc(matchId);
    const matchDoc = await matchRef.get();
    
    if (!matchDoc.exists) {
        return;
    }

    const matchData = matchDoc.data();
    if (!matchData) {
        return;
    }
    
    // Get all games for this match
    const gamesSnapshot = await matchRef.collection("games").get();
    const games = gamesSnapshot.docs.map(doc => doc.data());
    
    if (games.length === 0) {
        return; // No games yet
    }

    // Calculate series score
    const teamAId = matchData.teams?.[0];
    const teamBId = matchData.teams?.[1];
    
    if (!teamAId || !teamBId) {
        return; // Invalid match structure
    }

    let teamAWins = 0;
    let teamBWins = 0;

    // Count wins for each team
    games.forEach(game => {
        if (game.radiant_win) {
            // Check which team was radiant in this game
            if (game.radiant_team?.id === teamAId) {
                teamAWins++;
            } else if (game.radiant_team?.id === teamBId) {
                teamBWins++;
            }
        } else {
            // Dire won
            if (game.dire_team?.id === teamAId) {
                teamAWins++;
            } else if (game.dire_team?.id === teamBId) {
                teamBWins++;
            }
        }
    });

    const totalGames = games.length;

    // Determine if series is complete based on format
    const seriesFormat = matchData.series_format || (matchData.group_id ? 'bo2' : 'bo3'); // Default: BO2 for groups, BO3 for playoffs
    
    let isComplete = false;
    let winnerId = null;
    
    if (seriesFormat === 'bo1') {
        // BO1: Complete after 1 game
        isComplete = totalGames >= 1;
        winnerId = teamAWins > teamBWins ? teamAId : teamBId;
    } else if (seriesFormat === 'bo2') {
        // BO2: Complete after 2 games OR if one team has 2 wins
        isComplete = totalGames >= 2 || teamAWins >= 2 || teamBWins >= 2;
        // Winner is only determined if one team has more wins
        if (teamAWins > teamBWins) winnerId = teamAId;
        else if (teamBWins > teamAWins) winnerId = teamBId;
        // If tied (1-1), winnerId remains null (draw)
    } else if (seriesFormat === 'bo3') {
        // BO3: Complete when one team gets 2 wins
        isComplete = teamAWins >= 2 || teamBWins >= 2;
        winnerId = teamAWins >= 2 ? teamAId : teamBWins >= 2 ? teamBId : null;
    } else if (seriesFormat === 'bo5') {
        // BO5: Complete when one team gets 3 wins
        isComplete = teamAWins >= 3 || teamBWins >= 3;
        winnerId = teamAWins >= 3 ? teamAId : teamBWins >= 3 ? teamBId : null;
    }

    // Update match document with scores and completion status
    const updateData: any = {
        'teamA.score': teamAWins,
        'teamB.score': teamBWins
    };

    if (isComplete) {
        updateData.status = 'completed';
        updateData.winnerId = winnerId; // Can be null for draws in BO2
        updateData.completed_at = new Date().toISOString();
    }

    await matchRef.update(updateData);

    // If match is complete, trigger standings update (for group stage matches)
    if (isComplete) {
        try {
            // Import the admin-compatible group-actions function
            const { updateStandingsAfterGameAdmin } = await import('./group-actions-admin');
            
            // Get the updated match data to pass to standings update
            const updatedMatchSnapshot = await matchRef.get();
            if (updatedMatchSnapshot.exists) {
                const updatedMatchData = { id: matchId, ...updatedMatchSnapshot.data() } as any;
                await updateStandingsAfterGameAdmin(updatedMatchData);
                console.log(`Updated standings for completed match ${matchId}`);
            }
        } catch (error) {
            console.error(`Failed to update standings for match ${matchId}:`, error);
            // Don't throw - the match completion should still succeed
        }
    }

    console.log(`Match ${matchId} updated: ${teamAWins}-${teamBWins}, complete: ${isComplete}`);
}

async function saveExternalGameResultsAdmin(ourMatchId: string, game: any, performances: any[], teams: { radiantTeam: any, direTeam: any }): Promise<void> {
    const { getAdminDb, ensureAdminInitialized } = await import('../../server/lib/admin');
    const { FieldValue } = await import('firebase-admin/firestore');
    ensureAdminInitialized();
    const db = getAdminDb();

    const matchRef = db.collection("matches").doc(ourMatchId);
    
    // Check if the match document exists
    const matchSnap = await matchRef.get();
    const batch = db.batch();

    if (!matchSnap.exists) {
        // Create the match document for external matches
        const matchData = {
            teams: [teams.radiantTeam.id, teams.direTeam.id],
            team_names: [teams.radiantTeam.name, teams.direTeam.name],
            status: 'completed',
            external: true,
            created_at: new Date().toISOString(),
            game_ids: [parseInt(game.id)]
        };
        batch.set(matchRef, matchData);
    } else {
        // Update existing match to add this game
        batch.update(matchRef, {
            game_ids: FieldValue.arrayUnion(parseInt(game.id))
        });
    }

    const gameRef = matchRef.collection("games").doc(game.id);

    // 2. Set the data for the new game document
    batch.set(gameRef, game);

    // 3. Set the performance data for each player in a subcollection
    performances.forEach(performance => {
        const performanceRef = gameRef.collection("performances").doc(performance.playerId);
        batch.set(performanceRef, performance);
    });

    await batch.commit();
    
    // After saving, check if the match is now complete
    await checkAndUpdateMatchCompletionAdmin(ourMatchId);
}

// --- ADMIN SYNC FUNCTIONS ---
export async function syncLeagueMatchesAdmin() {
    try {
        console.log(`Starting match sync using STRATZ match list...`);

        // Import admin functions
        const { getAllProcessedGameIdsAdmin, markGameAsProcessedAdmin } = await import('./processed-games-admin');
        const { fetchAllStratzLeagueMatches } = await import('./actions');
        const { transformMatchData } = await import('./opendota');
        const { getAllTeams, getAllTournamentPlayers } = await import('./firestore');
        const { LEAGUE_ID } = await import('./definitions');

        // Fetch all match IDs from STRATZ API live
        const stratzMatches = await fetchAllStratzLeagueMatches(LEAGUE_ID);
        const stratzMatchIds = stratzMatches.map((m: any) => Number(m.id));

        // Get all processed match IDs from processedGames collection (using admin SDK)
        const processedMatchIds = new Set(await getAllProcessedGameIdsAdmin());

        // Only import matches not already processed
        const newMatchIds = stratzMatchIds.filter(id => !processedMatchIds.has(String(id)));

        if (newMatchIds.length === 0) {
            console.log("No new matches to import.");
            return { success: true, message: "Database is already up to date.", importedCount: 0 };
        }

        console.log(`Found ${newMatchIds.length} new matches to import.`);

        // Import each new match
        const importResults = await Promise.allSettled(
            newMatchIds.map(async (matchId) => {
                try {
                    console.log(`Starting import for OpenDota match ID: ${matchId}`);

                    const [teams, players] = await Promise.all([
                        getAllTeams(),
                        getAllTournamentPlayers(),
                    ]);
                    
                    // Fetch match from OpenDota
                    const { fetchOpenDotaMatch } = await import('./opendota');
                    const openDotaMatch = await fetchOpenDotaMatch(matchId);
                    
                    try {
                        const { game, performances } = transformMatchData(openDotaMatch, teams as any[], players as any[]);
                        
                        // Extract team info for finding the correct match
                        const radiantTeam = teams.find((t: any) => t.name.trim().toLowerCase() === openDotaMatch.radiant_name?.trim().toLowerCase());
                        const direTeam = teams.find((t: any) => t.name.trim().toLowerCase() === openDotaMatch.dire_name?.trim().toLowerCase());
                        
                        if (radiantTeam && direTeam) {
                            // Find existing match between these teams
                            const { getAllMatches } = await import('./firestore');
                            const allMatches = await getAllMatches();
                            
                            const existingMatch = allMatches.find(match => 
                                (match.teams.includes(radiantTeam.id) && match.teams.includes(direTeam.id))
                            );
                            
                            if (existingMatch) {
                                // Save to existing tournament match
                                await saveGameResultsAdmin(existingMatch.id, game, performances);
                                console.log(`Successfully saved game ${game.id} to existing match ${existingMatch.id} (${radiantTeam.name} vs ${direTeam.name})`);
                            } else {
                                // Create new external match (shouldn't happen for tournament teams, but just in case)
                                await saveExternalGameResultsAdmin(String(matchId), game, performances, { radiantTeam, direTeam });
                                console.log(`Created new external match ${matchId} for ${radiantTeam.name} vs ${direTeam.name}`);
                            }
                        } else {
                            // Fallback - try the original save method (will likely skip if no match document exists)
                            await saveGameResultsAdmin(String(matchId), game, performances);
                        }
                        
                        // Mark this external match/game as processed (admin version)
                        await markGameAsProcessedAdmin(matchId.toString());
                        console.log(`Successfully imported and saved data for match ID: ${matchId}`);
                        return { success: true, message: `Match ${matchId} imported successfully.` };
                    } catch (transformError) {
                        // If transform fails (e.g., teams not found), this might be a scrim - still mark as processed
                        console.log(`Could not transform match ${matchId} - likely a scrim or practice game: ${(transformError as Error).message}`);
                        await markGameAsProcessedAdmin(matchId.toString());
                        return { success: true, message: `Match ${matchId} skipped (likely scrim/practice game).`, skipped: true };
                    }
                } catch (error) {
                    console.error(`Failed to import match ${matchId}:`, error);
                    return { success: false, message: 'Failed to import match.', error: (error as Error).message };
                }
            })
        );

        let successfulImports = 0;
        let skippedMatches = 0;
        let failedImports = 0;

        importResults.forEach(result => {
            if (result.status === 'fulfilled') {
                const value = result.value as any;
                if (value.success) {
                    if (value.skipped) {
                        skippedMatches++;
                    } else {
                        successfulImports++;
                    }
                } else {
                    failedImports++;
                }
            } else {
                failedImports++;
            }
        });

        console.log(`Sync complete. Imported ${successfulImports} new matches. ${skippedMatches} skipped (scrims/practice). ${failedImports} failed.`);

        return {
            success: true,
            message: `Sync complete. Imported ${successfulImports} new matches. ${skippedMatches} skipped (scrims/practice). ${failedImports > 0 ? `${failedImports} failed.` : ''}`.trim(),
            importedCount: successfulImports,
            skippedCount: skippedMatches,
            failedCount: failedImports,
        };
    } catch (error) {
        console.error(`Failed to sync matches:`, error);
        return { 
            success: false, 
            message: 'Failed to sync league matches.', 
            error: (error as Error).message,
            importedCount: 0,
        };
    }
}

export async function clearProcessedGamesAdmin(): Promise<{ success: boolean; message: string; error?: string }> {
    try {
        const { clearAllProcessedGamesAdmin } = await import('@/lib/processed-games-admin');
        await clearAllProcessedGamesAdmin();
        return { success: true, message: 'All processed games cleared successfully.' };
    } catch (error) {
        console.error('Failed to clear processed games:', error);
        return { 
            success: false, 
            message: 'Failed to clear processed games.', 
            error: (error as Error).message 
        };
    }
}

// Update team statistics for all teams
export async function updateAllTeamStatisticsAdmin(): Promise<{ success: boolean; message: string; error?: string }> {
    try {
        const { updateAllTeamStatistics } = await import('./firestore');
        await updateAllTeamStatistics();
        return { success: true, message: 'All team statistics updated successfully.' };
    } catch (error) {
        console.error('Failed to update team statistics:', error);
        return { 
            success: false, 
            message: 'Failed to update team statistics.', 
            error: (error as Error).message 
        };
    }
}
