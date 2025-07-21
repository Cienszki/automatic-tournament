// src/app/api/announcements/route.ts
import { NextResponse } from 'next/server';
import { collection, getDocs, query, orderBy, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Announcement } from "@/lib/definitions";

async function getAnnouncements(): Promise<Announcement[]> {
    const announcementsCollection = collection(db, "announcements");
    const q = query(announcementsCollection, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
        const data = doc.data();
        const firestoreTimestamp = data.createdAt as Timestamp | undefined;
        return {
            id: doc.id,
            title: data.title, 
            content: data.content,
            authorId: data.authorId || '',
            authorName: data.authorName || 'N/A',
            createdAt: firestoreTimestamp ? firestoreTimestamp.toDate() : new Date(0),
        } as Announcement;
    });
}

export async function GET() {
  const announcements = await getAnnouncements();
  return NextResponse.json(announcements);
}
