import { NextResponse } from 'next/server';
import { getAdminDb, ensureAdminInitialized } from '@/server/lib/admin';

// Enable route caching for 5 minutes (fantasy leader rarely changes)
export const revalidate = 300;

export async function GET() {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();
    
    // Get leaderboards from the fixed algorithm collection
    let leaderboardsRef = db.collection('fantasyLeaderboards').doc('current');
    let leaderboardsSnap = await leaderboardsRef.get();
    
    // Fallback to old 'data' document ID
    if (!leaderboardsSnap.exists) {
      leaderboardsRef = db.collection('fantasyLeaderboards').doc('data');
      leaderboardsSnap = await leaderboardsRef.get();
    }
    
    if (!leaderboardsSnap.exists) {
      return NextResponse.json({
        success: false,
        message: 'Fantasy leaderboards not found',
        fantasyLeader: null
      });
    }
    
    const leaderboardsData = leaderboardsSnap.data();
    
    if (!leaderboardsData?.overall?.length) {
      return NextResponse.json({
        success: false,
        message: 'No fantasy players found',
        fantasyLeader: null
      });
    }
    
    // Get the top player (rank 1)
    const topPlayer = leaderboardsData.overall.find((p: any) => p.rank === 1) || leaderboardsData.overall[0];
    
    const fantasyLeader = {
      displayName: topPlayer.displayName,
      totalFantasyScore: topPlayer.averageScore || 0
    };
    
    const response = NextResponse.json({
      success: true,
      fantasyLeader
    });
    
    // Add cache headers
    response.headers.set('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    
    return response;
    
  } catch (error: any) {
    console.error('Failed to fetch fantasy leader:', error);
    return NextResponse.json({
      success: false,
      message: `Failed to fetch fantasy leader: ${error.message}`,
      fantasyLeader: null
    }, { status: 500 });
  }
}