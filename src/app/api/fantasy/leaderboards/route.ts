import { NextResponse } from "next/server";
import { getAdminDb, ensureAdminInitialized } from "@/server/lib/admin";

// Enable route caching for 60 seconds with stale-while-revalidate
export const revalidate = 60;

export async function GET() {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();
    
    // Get leaderboards from the fixed algorithm collection
    let leaderboardsRef = db.collection('fantasyLeaderboards').doc('current');
    let leaderboardsSnap = await leaderboardsRef.get();
    
    // Fallback to old 'data' document ID if 'current' doesn't exist
    if (!leaderboardsSnap.exists) {
      leaderboardsRef = db.collection('fantasyLeaderboards').doc('data');
      leaderboardsSnap = await leaderboardsRef.get();
    }
    
    if (!leaderboardsSnap.exists) {
      return NextResponse.json({
        success: false,
        message: 'Leaderboards not found. Please run fixed fantasy recalculation first.',
        leaderboards: {
          overall: [],
          byRole: {
            'Carry': [],
            'Mid': [],
            'Offlane': [],
            'Soft Support': [],
            'Hard Support': []
          }
        }
      });
    }
    
    const leaderboardsData = leaderboardsSnap.data();
    
    // Transform the data to match expected frontend format
    const transformedLeaderboards = {
      overall: (leaderboardsData?.overall || []).map((entry: any) => {
        const gamesPlayed = entry.gamesPlayed || entry.playerGames || 0;
        return {
          userId: entry.userId,
          displayName: entry.displayName,
          totalScore: entry.totalScore,
          gamesPlayed: gamesPlayed,
          averageScore: entry.averageScore,
          rank: entry.rank,
          currentLineup: entry.currentLineup || {}
        };
      }),
      byRole: leaderboardsData?.byRole || {
        'Carry': [],
        'Mid': [],
        'Offlane': [],
        'Soft Support': [],
        'Hard Support': []
      }
    };

    const response = NextResponse.json({
      success: true,
      leaderboards: transformedLeaderboards,
      generatedAt: leaderboardsData?.generatedAt,
      algorithm: leaderboardsData?.algorithm || 'FIXED - Player-centric scoring with accurate game counting',
      message: `Leaderboards loaded successfully (${transformedLeaderboards.overall.length} users)`
    });
    
    // Add cache headers for CDN/edge caching (stale-while-revalidate pattern)
    response.headers.set('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    
    return response;
    
  } catch (error: any) {
    console.error('❌ Failed to fetch fantasy leaderboards:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Failed to fetch leaderboards: ${error.message}`,
        leaderboards: {
          overall: [],
          byRole: {
            'Carry': [],
            'Mid': [],
            'Offlane': [],
            'Soft Support': [],
            'Hard Support': []
          }
        }
      },
      { status: 500 }
    );
  }
}