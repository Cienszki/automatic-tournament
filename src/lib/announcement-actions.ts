
'use server';

import { getAdminDb, getAdminAuth } from './admin';
import { FieldValue } from 'firebase-admin/firestore';

async function verifyAdmin(token: string) {
    if (!token) {
      throw new Error('Not authenticated');
    }
    const decodedToken = await getAdminAuth().verifyIdToken(token);
    const adminDoc = await getAdminDb().collection('admins').doc(decodedToken.uid).get();
    if (!adminDoc.exists) {
      throw new Error('Not authorized');
    }
    return decodedToken;
}

export async function createAnnouncement(token: string, title: string, content: string) {
    try {
        const decodedToken = await verifyAdmin(token);
        const announcementRef = getAdminDb().collection("announcements").doc();
        await announcementRef.set({
            id: announcementRef.id,
            title,
            content,
            authorId: decodedToken.uid,
            authorName: decodedToken.name || "Admin",
            createdAt: FieldValue.serverTimestamp(),
        });
        return { success: true };
    } catch(error) {
        console.error("Error creating announcement:", error);
        return { success: false, error: (error as Error).message };
    }
}

export async function deleteAnnouncement(token: string, announcementId: string) {
    try {
        await verifyAdmin(token);
        const announcementRef = getAdminDb().collection("announcements").doc(announcementId);
        await announcementRef.delete();
        return { success: true };
    } catch (error) {
        console.error("Error deleting announcement:", error);
        return { success: false, error: (error as Error).message };
    }
}
