// src/app/api/admin/mock-data/add-announcement/route.ts
// API endpoint for creating mock announcements

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth, ensureAdminInitialized } from '../../../../../../server/lib/admin';
import { headers } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    ensureAdminInitialized();
    const headersList = await headers();
    const authHeader = headersList.get('Authorization');

    if (!authHeader) {
      return NextResponse.json({ error: 'No Authorization header' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 });
    }

    // Verify admin status
    const decodedToken = await getAdminAuth().verifyIdToken(token);
    const adminDoc = await getAdminDb().collection('admins').doc(decodedToken.uid).get();
    
    if (!adminDoc.exists) {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
    }

    const data = await request.json();
    const { tournamentId, title, content, type, isPinned } = data;

    // Validate required fields
    if (!tournamentId || !title || !content || !type) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Generate announcement ID
    const announcementId = `announcement-${Date.now()}`;

    // Create announcement document
    const announcementData = {
      id: announcementId,
      title,
      content,
      type, // info, success, warning, error
      isPinned: isPinned || false,
      isImportant: isPinned || false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      author: 'Admin',
      isMockData: true,
    };

    await getAdminDb()
      .collection('tournaments')
      .doc(tournamentId)
      .collection('announcements')
      .doc(announcementId)
      .set(announcementData);

    return NextResponse.json({ 
      success: true, 
      announcementId,
      message: `Announcement "${title}" created successfully` 
    });
  } catch (error: any) {
    console.error('Error creating announcement:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create announcement' },
      { status: 500 }
    );
  }
}
