import { NextResponse } from "next/server";
import { getAdminDb, ensureAdminInitialized } from "@/server/lib/admin";

export async function GET() {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();
    
    console.log('🔍 Checking all performance document IDs...');
    
    // Get all matches and check their game performance document IDs
    const matchesQuery = await db.collection('matches').get();
    const allPerformanceIds = new Set<string>();
    const performanceStats: Record<string, { count: number; games: string[]; personaname?: string; steamId32?: string; teamName?: string }> = {};
    
    for (const matchDoc of matchesQuery.docs) {
      const gamesQuery = await matchDoc.ref.collection('games').get();
      
      for (const gameDoc of gamesQuery.docs) {
        const performancesQuery = await gameDoc.ref.collection('performances').get();
        
        performancesQuery.docs.forEach(perfDoc => {
          const perfId = perfDoc.id;
          const perfData = perfDoc.data();
          
          allPerformanceIds.add(perfId);
          
          if (!performanceStats[perfId]) {
            performanceStats[perfId] = { count: 0, games: [] };
          }
          
          performanceStats[perfId].count++;
          performanceStats[perfId].games.push(gameDoc.id);
          
          // Add additional metadata for context
          if (perfData.personaname && perfData.personaname !== perfId) {
            performanceStats[perfId].personaname = perfData.personaname;
          }
          if (perfData.steamId32) {
            performanceStats[perfId].steamId32 = perfData.steamId32;
          }
          if (perfData.teamName) {
            performanceStats[perfId].teamName = perfData.teamName;
          }
        });
      }
    }
    
    // Sort by game count (descending)
    const sortedStats = Object.entries(performanceStats)
      .sort(([,a], [,b]) => b.count - a.count)
      .slice(0, 50); // Top 50 most active players
    
    console.log(`✅ Found ${allPerformanceIds.size} unique performance IDs`);
    
    return NextResponse.json({
      success: true,
      totalUniqueIds: allPerformanceIds.size,
      allPerformanceIds: Array.from(allPerformanceIds).sort(),
      topPlayers: sortedStats.map(([id, stats]) => ({
        performanceId: id,
        gameCount: stats.count,
        personaname: stats.personaname,
        steamId32: stats.steamId32,
        teamName: stats.teamName,
        recentGames: stats.games.slice(-3) // Last 3 games
      }))
    });
    
  } catch (error: any) {
    console.error('❌ Error checking performance IDs:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    );
  }
}