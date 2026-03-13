// src/app/api/admin/bot/sessions/route.ts
// API route for fetching lobby sessions for a tournament

import { NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth } from '@/server/lib/admin';
import type { LobbySession } from '@/types/lobby-bot';

/**
 * GET /api/admin/bot/sessions?tournamentId=xxx&status=active|pending|all
 * Returns lobby sessions for a tournament
 */
export async function GET(req: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(req.url);
    const tournamentId = searchParams.get('tournamentId');
    const status = searchParams.get('status') || 'all';

    if (!tournamentId) {
      return NextResponse.json({ error: 'tournamentId is required' }, { status: 400 });
    }

    // Verify admin auth
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    try {
      await getAdminAuth().verifyIdToken(token);
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const db = getAdminDb();
    let query = db
      .collection('botLobbySessions')
      .where('tournamentId', '==', tournamentId)
      .orderBy('createdAt', 'desc')
      .limit(50);

    // Filter by status categories
    if (status === 'active') {
      query = db
        .collection('botLobbySessions')
        .where('tournamentId', '==', tournamentId)
        .where('state', 'in', [
          'bot_assigned',
          'lobby_creating',
          'lobby_open',
          'ready_check',
          'requirements_met',
          'coin_toss',
          'in_game',
          'post_game',
          'syncing',
        ])
        .orderBy('createdAt', 'desc')
        .limit(50);
    } else if (status === 'pending') {
      query = db
        .collection('botLobbySessions')
        .where('tournamentId', '==', tournamentId)
        .where('state', '==', 'pending')
        .orderBy('createdAt', 'desc')
        .limit(50);
    }

    const snapshot = await query.get();
    const sessions: LobbySession[] = snapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
        }) as LobbySession
    );

    return NextResponse.json({ sessions });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Bot sessions GET error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/admin/bot/sessions
 * Manually create a lobby session for a match (admin action)
 *
 * Body: { tournamentId: string, matchId: string, gameNumber: number }
 */
export async function POST(req: Request): Promise<Response> {
  try {
    // Verify admin auth
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    let uid: string;
    try {
      const decoded = await getAdminAuth().verifyIdToken(token);
      uid = decoded.uid;
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await req.json();
    const { tournamentId, matchId, gameNumber } = body as {
      tournamentId: string;
      matchId: string;
      gameNumber: number;
    };

    if (!tournamentId || !matchId || !gameNumber) {
      return NextResponse.json(
        { error: 'tournamentId, matchId, and gameNumber are required' },
        { status: 400 }
      );
    }

    const db = getAdminDb();

    // Verify admin permissions
    const adminDoc = await db.collection('admins').doc(tournamentId).get();
    const adminData = adminDoc.data();
    const superAdminDoc = await db.collection('superAdmins').doc(uid).get();

    if (!superAdminDoc.exists && (!adminData || !adminData[uid])) {
      return NextResponse.json({ error: 'Not an admin for this tournament' }, { status: 403 });
    }

    // Import and use scheduleLobbyForMatch
    const { scheduleLobbyForMatch } = await import('@/lib/bot/bot-config-actions');
    // Get match info to pass match name and series format
    const matchDoc = await db
      .collection('tournaments')
      .doc(tournamentId)
      .collection('matches')
      .doc(matchId)
      .get();
    const matchData = matchDoc.data();
    const matchName = matchData?.name || `Game ${gameNumber}`;
    const seriesFormat = matchData?.series_format || 'bo2';

    const session = await scheduleLobbyForMatch(tournamentId, matchId, matchName, seriesFormat);

    return NextResponse.json({ session });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Bot sessions POST error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
