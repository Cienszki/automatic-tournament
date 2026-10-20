// src/app/api/manage/hero-video/route.ts
//
// Hero video uploads to the platform's Bunny Stream library. Super admins only:
// other organizers host their videos themselves and paste a link, so the
// platform never pays for (or answers for) their files.
//
//   POST   { title }        → create the video + a signed TUS upload ticket
//   GET    ?videoId=<guid>  → encoding status; playable URLs once ready
//   DELETE ?videoId=<guid>  → delete a video that is no longer used
//
// Error responses carry the underlying message (e.g. a missing API key or
// Bunny's own error text): only super admins reach this route, and they are
// the ones who have to fix the configuration.

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { getAdminDb, getAdminAuth, ensureAdminInitialized } from '@/server/lib/admin';
import { createUploadTicket, deleteHeroVideo, getHeroVideoStatus } from '@/server/lib/bunny-stream';

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Verify the caller is a super admin. Returns their uid, or a response to bail with. */
async function requireSuperAdmin(): Promise<{ uid: string } | { error: NextResponse }> {
  const headersList = await headers();
  const authHeader = headersList.get('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return { error: NextResponse.json({ error: 'No Authorization header' }, { status: 401 }) };
  }
  const token = authHeader.split('Bearer ')[1];
  if (!token) {
    return { error: NextResponse.json({ error: 'No token provided' }, { status: 401 }) };
  }

  const decoded = await getAdminAuth().verifyIdToken(token);
  const adminDoc = await getAdminDb().collection('admins').doc(decoded.uid).get();
  if (!adminDoc.exists) {
    return {
      error: NextResponse.json(
        { error: 'Unauthorized - super admin access required' },
        { status: 403 }
      ),
    };
  }
  return { uid: decoded.uid };
}

function videoIdParam(request: NextRequest): string | NextResponse {
  const videoId = request.nextUrl.searchParams.get('videoId') ?? '';
  return GUID.test(videoId) ? videoId : NextResponse.json({ error: 'Invalid videoId' }, { status: 400 });
}

export async function POST(request: NextRequest) {
  try {
    ensureAdminInitialized();
    const auth = await requireSuperAdmin();
    if ('error' in auth) return auth.error;

    const { title } = await request.json().catch(() => ({}));
    const safeTitle = typeof title === 'string' && title.trim() ? title.trim().slice(0, 200) : 'hero video';
    return NextResponse.json(await createUploadTicket(safeTitle));
  } catch (error) {
    console.error('Error creating hero video upload:', error);
    return NextResponse.json({ error: `Failed to create upload: ${(error as Error).message}` }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    ensureAdminInitialized();
    const auth = await requireSuperAdmin();
    if ('error' in auth) return auth.error;

    const videoId = videoIdParam(request);
    if (videoId instanceof NextResponse) return videoId;
    return NextResponse.json(await getHeroVideoStatus(videoId));
  } catch (error) {
    console.error('Error reading hero video status:', error);
    return NextResponse.json({ error: `Failed to read video status: ${(error as Error).message}` }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    ensureAdminInitialized();
    const auth = await requireSuperAdmin();
    if ('error' in auth) return auth.error;

    const videoId = videoIdParam(request);
    if (videoId instanceof NextResponse) return videoId;
    await deleteHeroVideo(videoId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting hero video:', error);
    return NextResponse.json({ error: `Failed to delete video: ${(error as Error).message}` }, { status: 500 });
  }
}
