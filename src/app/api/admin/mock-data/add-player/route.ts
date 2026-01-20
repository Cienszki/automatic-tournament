// src/app/api/admin/mock-data/add-player/route.ts
// API endpoint for adding mock player data to teams

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
    const { tournamentId, teamId, nickname, role, mmr, steamId } = data;

    // Validate required fields
    if (!tournamentId || !teamId || !nickname || !role || !mmr || !steamId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if team exists
    const teamDoc = await getAdminDb()
      .collection('tournaments')
      .doc(tournamentId)
      .collection('teams')
      .doc(teamId)
      .get();

    if (!teamDoc.exists) {
      return NextResponse.json(
        { error: `Team ${teamId} not found` },
        { status: 404 }
      );
    }

    // Generate player ID
    const playerId = `player-${steamId}`;

    // Calculate fantasy price based on MMR (simple formula)
    const fantasyPrice = Math.round(mmr / 100) / 10;

    // Create player document
    const playerData = {
      id: playerId,
      nickname,
      role,
      mmr,
      steamId64: steamId,
      steamId32: String(Number(steamId) - 76561197960265728),
      fantasyPrice,
      stats: {
        gamesPlayed: 0,
        kills: 0,
        deaths: 0,
        assists: 0,
        gpm: 0,
        xpm: 0,
        lastHits: 0,
        denies: 0,
        heroDamage: 0,
        towerDamage: 0,
        healing: 0,
      },
      achievements: [],
      joinedAt: new Date().toISOString(),
      isMockData: true,
    };

    await getAdminDb()
      .collection('tournaments')
      .doc(tournamentId)
      .collection('teams')
      .doc(teamId)
      .collection('players')
      .doc(playerId)
      .set(playerData);

    return NextResponse.json({ 
      success: true, 
      playerId,
      message: `Player "${nickname}" added to team ${teamId}` 
    });
  } catch (error: any) {
    console.error('Error adding player:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to add player' },
      { status: 500 }
    );
  }
}
