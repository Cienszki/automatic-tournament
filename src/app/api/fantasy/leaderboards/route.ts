import { NextResponse } from "next/server";
import { getAdminDb, ensureAdminInitialized } from "@/server/lib/admin";

export async function GET() {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();
    
    console.log(`📊 [${new Date().toISOString()}] Fetching fantasy leaderboards from fixed algorithm collections...`);
    
    // Get leaderboards from the new collection created by the fixed recalculation
    // Try both possible document IDs from different recalculation versions
    let leaderboardsRef = db.collection('fantasyLeaderboards').doc('current');
    let leaderboardsSnap = await leaderboardsRef.get();
    
    // If 'current' doesn't exist, try the old 'data' document ID
    if (!leaderboardsSnap.exists) {
      console.log('Trying alternative document ID: data');
      leaderboardsRef = db.collection('fantasyLeaderboards').doc('data');
      leaderboardsSnap = await leaderboardsRef.get();
    }
    
    if (!leaderboardsSnap.exists) {
      console.log('⚠️ No leaderboards found - may need to run recalculation first');
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
    
    console.log(`✅ Retrieved leaderboards: ${leaderboardsData?.overall?.length || 0} overall entries`);
    console.log('🔍 DEBUG - Generated at:', leaderboardsData?.generatedAt);
    console.log('🔍 DEBUG - Algorithm:', leaderboardsData?.algorithm);
    
    // Debug specific users that should have updated game counts
    const testUsers = ['BeBoy', 'SZATOŚI CI PRZYSZTOSI FUJARE', 'Maruda', 'AaDeHaDe', 'Pocieszny'];
    testUsers.forEach(userName => {
      const user = leaderboardsData?.overall?.find((u: any) => u.displayName === userName);
      if (user) {
        console.log(`🔍 DEBUG - ${userName}: ${user.gamesPlayed || 0} games, score: ${user.totalScore}, avg: ${user.averageScore}`);
      }
    });
    
    // Transform the data to match expected frontend format
    const transformedLeaderboards = {
      overall: (leaderboardsData?.overall || []).map((entry: any) => {
        const gamesPlayed = entry.gamesPlayed || entry.playerGames || 0;
        if (['BeBoy', 'SZATOŚI CI PRZYSZTOSI FUJARE', 'Maruda'].includes(entry.displayName)) {
          console.log(`🔍 TRANSFORM - ${entry.displayName}: raw=${entry.gamesPlayed}, playerGames=${entry.playerGames}, final=${gamesPlayed}`);
        }
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
      message: `Fixed leaderboards loaded successfully (${transformedLeaderboards.overall.length} users)`
    });
    
    // Prevent caching to ensure fresh data
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
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