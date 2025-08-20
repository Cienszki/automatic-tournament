// src/app/api/announcements/route.ts
import { NextResponse } from 'next/server';
import { getAdminDb } from "@/lib/admin";
import { Announcement } from "@/lib/definitions";

async function getAnnouncements(): Promise<Announcement[]> {
    const db = getAdminDb();
    const announcementsCollection = db.collection("announcements");
    const snapshot = await announcementsCollection.orderBy("createdAt", "desc").get();
    return snapshot.docs.map(doc => {
        const data = doc.data();
        const firestoreTimestamp = data.createdAt;
        return {
            id: doc.id,
            title: data.title, 
            content: data.content,
            authorId: data.authorId || '',
            authorName: data.authorName || 'N/A',
            createdAt: firestoreTimestamp && typeof firestoreTimestamp.toDate === 'function' ? firestoreTimestamp.toDate() : new Date(0),
        } as Announcement;
    });
}

export async function GET() {
  const announcements = await getAnnouncements();
  return NextResponse.json(announcements);
}
