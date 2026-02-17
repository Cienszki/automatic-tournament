import { NextRequest, NextResponse } from 'next/server';
import { getSteam64IdFromUrl, getOpenDotaAccountIdFromUrl } from '@/lib/server-utils';
import { getAdminDb, ensureAdminInitialized } from '@/lib/admin';
import { fetchSteamProfile } from '@/lib/steam-id-utils';

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


    // Check if already a player using Admin SDK, but allow players from eliminated teams
    ensureAdminInitialized();
    const db = getAdminDb();
    let isAlreadyActivePlayer = false;
    const teamsSnapshot = await db.collection('teams').get();
    for (const teamDoc of teamsSnapshot.docs) {
      const teamData = teamDoc.data();
      
      // Skip eliminated teams - their players can register as standins
      if (teamData.status === 'eliminated') {
        continue;
      }
      
      const playersSnapshot = await db.collection('teams').doc(teamDoc.id).collection('players').get();
      for (const playerDoc of playersSnapshot.docs) {
        const player = playerDoc.data();
        if (player.steamId32 === steamId32.toString() || player.steamId === steamId32.toString()) {
          isAlreadyActivePlayer = true;
          break;
        }
      }
      if (isAlreadyActivePlayer) break;
    }
    if (isAlreadyActivePlayer) {
      return NextResponse.json(
        { 
          error: 'This Steam account is already registered as a player in an active team!',
          isAlreadyPlayer: true 
        },
        { status: 400 }
      );
    }

    // Fetch Steam profile data (avatar, persona name, etc.)
    let profileData;
    try {
      profileData = await fetchSteamProfile(steamId64);
    } catch (error) {
      console.warn('Could not fetch Steam profile data:', error);
      // Continue without profile data
    }

    return NextResponse.json({
      steamId64,
      steamId32: steamId32.toString(),
      isValid: true,
      avatar: profileData?.avatar,
      avatarmedium: profileData?.avatarmedium,
      avatarfull: profileData?.avatarfull,
      personaname: profileData?.personaname,
      profileurl: profileData?.profileurl,
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
