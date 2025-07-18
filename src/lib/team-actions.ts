
'use server';

import { adminDb } from './admin';
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

export async function updateTeamStatus(teamId: string, status: 'verified' | 'warning' | 'banned' | 'pending') {
    try {
        await verifyAdmin();
        const teamRef = adminDb.collection("teams").doc(teamId);
        await teamRef.update({ status: status });
        return { success: true };
    } catch (error) {
        console.error("Error updating team status:", error);
        return { success: false, error: (error as Error).message };
    }
}
