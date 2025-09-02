import { NextResponse } from 'next/server';
import { getAdminDb, ensureAdminInitialized } from '@/server/lib/admin';

export async function GET() {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();
    
    // Get leaderboards from the fixed algorithm collection (same logic as fantasy leaderboards API)
    let leaderboardsRef = db.collection('fantasyLeaderboards').doc('current');
    let leaderboardsSnap = await leaderboardsRef.get();
    
    // If 'current' doesn't exist, try the old 'data' document ID
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
      totalFantasyScore: topPlayer.averageScore || 0 // Use average score instead of total
    };
    
    return NextResponse.json({
      success: true,
      fantasyLeader
    });
    
  } catch (error: any) {
    console.error('Failed to fetch fantasy leader:', error);
    return NextResponse.json({
      success: false,
      message: `Failed to fetch fantasy leader: ${error.message}`,
      fantasyLeader: null
    }, { status: 500 });
  }
}