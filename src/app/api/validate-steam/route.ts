import { NextRequest, NextResponse } from 'next/server';
import { getSteam64IdFromUrl, getOpenDotaAccountIdFromUrl } from '@/lib/server-utils';
import { getAdminDb, ensureAdminInitialized } from '@/lib/admin';

export async function POST(request: NextRequest) {
  try {
    const { steamProfileUrl } = await request.json();

    if (!steamProfileUrl) {
      return NextResponse.json(
        { error: 'Steam profile URL is required' },
        { status: 400 }
      );
    }

    // Get Steam IDs
    const steamId64 = await getSteam64IdFromUrl(steamProfileUrl);
    const steamId32 = await getOpenDotaAccountIdFromUrl(steamProfileUrl);


    // Check if already a player using Admin SDK
    ensureAdminInitialized();
    const db = getAdminDb();
    let isAlreadyPlayer = false;
    const teamsSnapshot = await db.collection('teams').get();
    for (const teamDoc of teamsSnapshot.docs) {
      const playersSnapshot = await db.collection('teams').doc(teamDoc.id).collection('players').get();
      for (const playerDoc of playersSnapshot.docs) {
        const player = playerDoc.data();
        if (player.steamId32 === steamId32.toString() || player.steamId === steamId32.toString()) {
          isAlreadyPlayer = true;
          break;
        }
      }
      if (isAlreadyPlayer) break;
    }
    if (isAlreadyPlayer) {
      return NextResponse.json(
        { 
          error: 'This Steam account is already registered as a player in one of the teams!',
          isAlreadyPlayer: true 
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      steamId64,
      steamId32: steamId32.toString(),
      isValid: true
    });

  } catch (error) {
    console.error('Steam validation error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to validate Steam profile',
        isValid: false 
      },
      { status: 400 }
    );
  }
}
