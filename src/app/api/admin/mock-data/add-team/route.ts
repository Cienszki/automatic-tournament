// src/app/api/admin/mock-data/add-team/route.ts
// API endpoint for adding mock team data

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
    const { tournamentId, name, tag, divisionId, motto, captainId } = data;

    // Validate required fields
    if (!tournamentId || !name || !tag || !divisionId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Generate team ID based on division
    const divisionPrefix = divisionId.toLowerCase();
    const teamsSnapshot = await getAdminDb()
      .collection('tournaments')
      .doc(tournamentId)
      .collection('teams')
      .where('divisionId', '==', divisionId)
      .get();
    
    const teamNumber = teamsSnapshot.size + 1;
    const teamId = `${divisionPrefix}-team-${teamNumber}`;

    // Create team document
    const teamData = {
      id: teamId,
      name,
      tag,
      divisionId,
      motto: motto || '',
      captainId: captainId || `mock-captain-${Date.now()}`,
      status: 'active',
      registrationDate: new Date().toISOString(),
      verified: false,
      stats: {
        played: 0,
        wins: 0,
        losses: 0,
        draws: 0,
      },
      createdAt: new Date().toISOString(),
      isMockData: true,
    };

    await getAdminDb()
      .collection('tournaments')
      .doc(tournamentId)
      .collection('teams')
      .doc(teamId)
      .set(teamData);

    return NextResponse.json({ 
      success: true, 
      teamId,
      message: `Team "${name}" added successfully` 
    });
  } catch (error: any) {
    console.error('Error adding team:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to add team' },
      { status: 500 }
    );
  }
}
