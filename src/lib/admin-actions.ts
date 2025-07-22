// src/lib/admin-actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { collection, doc, writeBatch, runTransaction, getDocs, query, where, deleteDoc } from 'firebase/firestore';
import { adminDb, ensureAdminInitialized } from './admin'; // Correct import
import type { Group, GroupStanding, Match, Team, Player } from './definitions';
import { getAllTeams as fetchAllTeams, getAllGroups as fetchAllGroups, getTeamById } from './firestore';

async function performAdminAction<T>(action: () => Promise<T>): Promise<{ success: boolean; message: string; data?: T }> {
    await ensureAdminInitialized();
    if (!adminDb) {
        return { success: false, message: "Firebase Admin is not initialized. Check your server logs for details." };
    }
    try {
        const result = await action();
        return { success: true, message: "Action completed successfully.", data: result };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        return { success: false, message: `An error occurred: ${errorMessage}` };
    }
}

/**
 * Creates a new group and initializes the standings for the given teams.
 */
export async function createGroup(groupName: string, teamIds: string[]): Promise<{ success: boolean; message: string }> {
    return performAdminAction(async () => {
        if (!groupName || !teamIds || !teamIds.length) {
            throw new Error('Group name and at least one team are required.');
        }
        const batch = writeBatch(adminDb);
        const groupRef = doc(adminDb, 'groups', groupName.toLowerCase().replace(/\s+/g, '-'));
        const initialStandings: { [teamId: string]: GroupStanding } = {};
        teamIds.forEach(teamId => {
            initialStandings[teamId] = {
                teamId: teamId,
                teamName: 'Fetching...', 
                teamLogoUrl: '',
                matchesPlayed: 0,
                points: 0,
                wins: 0,
                losses: 0,
                headToHead: {},
                neustadtlScore: 0,
                status: 'pending',
            };
        });
        const newGroup: Omit<Group, 'id'> = { name: groupName, standings: initialStandings };
        batch.set(groupRef, newGroup);
        await batch.commit();
        revalidatePath('/groups');
        revalidatePath('/admin');
        return { success: true, message: `Group '${groupName}' created successfully.`};
    });
}

/**
 * Deletes a single group from Firestore.
 */
export async function deleteGroup(groupId: string): Promise<{ success: boolean; message: string }> {
     return performAdminAction(async () => {
        if (!groupId) throw new Error('Group ID is required.');
        await deleteDoc(doc(adminDb, 'groups', groupId));
        revalidatePath('/groups');
        revalidatePath('/admin');
        return { success: true, message: `Group ${groupId} deleted successfully.`};
    });
}

/**
 * Deletes all groups from Firestore.
 */
export async function deleteAllGroups(): Promise<{ success: boolean; message: string }> {
    return performAdminAction(async () => {
        const groupsCollection = collection(adminDb, 'groups');
        const batch = writeBatch(adminDb);
        const snapshot = await getDocs(groupsCollection);
        if (snapshot.empty) return { success: true, message: 'No groups to delete.'};
        snapshot.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
        revalidatePath('/groups');
        revalidatePath('/admin');
        return { success: true, message: `${snapshot.size} groups deleted.`};
    });
}

/**
 * Fetches the team associated with a given user ID.
 */
export async function getUserTeam(userId: string): Promise<{ hasTeam: boolean; team?: Team | null; }> {
    const result = await performAdminAction(async () => {
        const teamsRef = collection(adminDb, 'teams');
        const q = query(teamsRef, where('captainId', '==', userId));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) return { hasTeam: false, team: null };
        
        const teamDoc = querySnapshot.docs[0];
        // This should be an admin-specific function in a real app
        const team = await getTeamById(teamDoc.id); 
        return { hasTeam: true, team };
    });
    return result.data || { hasTeam: false, team: null };
}

// Wrapper functions to be used by client components
export async function getTeams(): Promise<Team[]> { return await fetchAllTeams(); }
export async function getGroups(): Promise<Group[]> { return await fetchAllGroups(); }
export async function generateGroupStageMatches(groupId: string, deadline: Date): Promise<{ success: boolean; message: string }> { return { success: true, message: "Not implemented." }; }
export async function createTestGroup(): Promise<{ success: boolean; message: string }> { return { success: true, message: "Not implemented." }; }
