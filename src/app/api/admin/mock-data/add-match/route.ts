// src/app/api/admin/mock-data/add-match/route.ts
// API endpoint for creating mock match data

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
    const { tournamentId, teamAId, teamBId, divisionId, round, scheduledFor, format } = data;

    // Validate required fields
    if (!tournamentId || !teamAId || !teamBId || !divisionId || !round || !scheduledFor || !format) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate teams exist
    const teamADoc = await getAdminDb()
      .collection('tournaments')
      .doc(tournamentId)
      .collection('teams')
      .doc(teamAId)
      .get();

    const teamBDoc = await getAdminDb()
      .collection('tournaments')
      .doc(tournamentId)
      .collection('teams')
      .doc(teamBId)
      .get();

    if (!teamADoc.exists || !teamBDoc.exists) {
      return NextResponse.json(
        { error: 'One or both teams not found' },
        { status: 404 }
      );
    }

    const teamA = teamADoc.data();
    const teamB = teamBDoc.data();

    // Generate match ID
    const matchId = `${tournamentId}-${divisionId}-r${round}-m${Date.now()}`;

    // Create match document
    const matchData = {
      id: matchId,
      tournamentId,
      divisionId,
      round,
      matchday: round, // For league format, matchday = round
      teamA: {
        id: teamAId,
        name: teamA?.name || teamAId,
        tag: teamA?.tag || '',
        score: 0,
      },
      teamB: {
        id: teamBId,
        name: teamB?.name || teamBId,
        tag: teamB?.tag || '',
        score: 0,
      },
      format, // bo1, bo2, bo3, bo5
      scheduledFor: new Date(scheduledFor).toISOString(),
      status: 'scheduled', // scheduled, in_progress, completed, cancelled
      result: null,
      winner: null,
      createdAt: new Date().toISOString(),
      isMockData: true,
    };

    await getAdminDb()
      .collection('tournaments')
      .doc(tournamentId)
      .collection('matches')
      .doc(matchId)
      .set(matchData);

    return NextResponse.json({ 
      success: true, 
      matchId,
      message: `Match created: ${teamA?.name} vs ${teamB?.name}` 
    });
  } catch (error: any) {
    console.error('Error creating match:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create match' },
      { status: 500 }
    );
  }
}
