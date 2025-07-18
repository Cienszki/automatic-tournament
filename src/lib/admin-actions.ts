
'use server';

import { adminDb } from './admin';
import type { TournamentStatus } from './definitions';
import { getAuth } from 'firebase-admin/auth';
import { headers } from 'next/headers';

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

/**
 * [SERVER ACTION] Fetches the current tournament status from Firestore.
 */
export async function getTournamentStatus(): Promise<TournamentStatus | null> {
  try {
    const statusDocRef = adminDb.collection('tournament').doc('status');
    const statusDocSnap = await statusDocRef.get();

    if (statusDocSnap.exists) {
      return statusDocSnap.data() as TournamentStatus;
    }
    return null;
  } catch (error) {
    console.error("Error fetching tournament status:", error);
    return null;
  }
}

/**
 * [SERVER ACTION] Initializes the tournament status document.
 */
export async function initializeTournament() {
    try {
        await verifyAdmin();
        const statusDocRef = adminDb.collection('tournament').doc('status');
        await statusDocRef.set({ roundId: 'initial' });
        return { success: true };
    } catch(error) {
        console.error("Error initializing tournament:", error);
        return { success: false, error: (error as Error).message };
    }
}

/**
 * [SERVER ACTION] Updates the tournament status document.
 * @param newStatus - The new status object to set.
 */
export async function updateTournamentStatus(newStatus: Partial<TournamentStatus>) {
    try {
        await verifyAdmin();
        const statusDocRef = adminDb.collection('tournament').doc('status');
        await statusDocRef.set(newStatus, { merge: true });
        return { success: true };
    } catch (error) {
        console.error("Error updating tournament status:", error);
        return { success: false, error: (error as Error).message };
    }
}

export async function createTestTeam(data: { name: string; tag: string }) {
    try {
        const decodedToken = await verifyAdmin();
        const teamData = {
            ...data,
            captainId: decodedToken.uid,
            createdAt: new Date().toISOString(),
            status: 'verified',
            players: [], // Add dummy players if needed
        };
        const newTeamRef = adminDb.collection('teams').doc();
        await newTeamRef.set(teamData);
        return { success: true, message: `Team '${data.name}' created successfully!` };
    } catch (error) {
        return { success: false, message: (error as Error).message };
    }
}
