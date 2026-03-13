/**
 * Admin API: Manage global player profiles
 *
 * GET    → List all global player profiles (paginated)
 * POST   → Create/update a global player profile
 * DELETE → Remove a global player profile (body: { steamId: string })
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, ensureAdminInitialized } from '@/server/lib/admin';
import type { GlobalPlayerProfile } from '@/lib/player-profiles';

export async function GET(request: NextRequest) {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();

    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const startAfter = searchParams.get('startAfter') || '';
    const searchQuery = searchParams.get('q') || '';

    let ref = db.collection('players').orderBy('nickname').limit(limit);

    if (startAfter) {
      const startDoc = await db.collection('players').doc(startAfter).get();
      if (startDoc.exists) {
        ref = ref.startAfter(startDoc);
      }
    }

    const snap = await ref.get();
    let players = snap.docs.map(doc => ({
      steamId: doc.id,
      ...doc.data(),
    })) as (GlobalPlayerProfile & { steamId: string })[];

    // Client-side search filter (for small result sets)
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      players = players.filter(p =>
        p.nickname.toLowerCase().includes(q) ||
        p.steamId.includes(q) ||
        p.steamId32?.includes(q) ||
        p.steamProfileUrl?.toLowerCase().includes(q)
      );
    }

    return NextResponse.json({
      success: true,
      players,
      count: players.length,
      hasMore: snap.docs.length === limit,
      lastId: snap.docs.length > 0 ? snap.docs[snap.docs.length - 1].id : null,
    });
  } catch (error) {
    console.error('Failed to list global players:', error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    ensureAdminInitialized();

    const body = await request.json();
    const { steamId, steamId32, nickname, steamProfileUrl, avatar, avatarmedium, avatarfull } = body;

    if (!steamId || !nickname) {
      return NextResponse.json(
        { success: false, error: 'steamId and nickname are required' },
        { status: 400 }
      );
    }

    const { upsertGlobalPlayerProfile } = await import('@/lib/player-profiles');
    await upsertGlobalPlayerProfile({
      steamId,
      steamId32: steamId32 || '',
      nickname,
      steamProfileUrl: steamProfileUrl || `https://steamcommunity.com/profiles/${steamId}`,
      avatar: avatar || '',
      avatarmedium: avatarmedium || '',
      avatarfull: avatarfull || '',
    });

    return NextResponse.json({ success: true, message: `Player profile ${nickname} (${steamId}) upserted` });
  } catch (error) {
    console.error('Failed to upsert global player:', error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();

    const body = await request.json();
    const { steamId } = body;

    if (!steamId) {
      return NextResponse.json(
        { success: false, error: 'steamId is required' },
        { status: 400 }
      );
    }

    await db.collection('players').doc(steamId).delete();

    return NextResponse.json({ success: true, message: `Player profile ${steamId} deleted` });
  } catch (error) {
    console.error('Failed to delete global player:', error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
