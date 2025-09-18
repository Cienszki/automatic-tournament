import { NextResponse } from "next/server";
import { getAdminDb, ensureAdminInitialized } from "@/server/lib/admin";

export async function GET() {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();
    
    console.log('🔍 Examining match structure...');
    
    // Get a few matches to see their structure
    const matchesQuery = await db.collection('matches').limit(3).get();
    
    if (matchesQuery.empty) {
      return NextResponse.json({
        success: false,
        message: 'No matches found'
      });
    }
    
    const matchStructures: any[] = [];
    
    matchesQuery.forEach((doc) => {
      const data = doc.data();
      const structure: any = {
        matchId: doc.id,
        keys: Object.keys(data),
        hasGames: !!data.games,
        gamesType: Array.isArray(data.games) ? 'array' : typeof data.games,
        gamesCount: Array.isArray(data.games) ? data.games.length : 0,
        hasGameIds: false,
        sampleGameIds: [] as any[],
        hasPlayerPerformances: false
      };
      
      // Check if games contain match IDs
      if (Array.isArray(data.games)) {
        structure.hasGameIds = data.games.some((game: any) => game.match_id || game.id);
        structure.sampleGameIds = data.games.slice(0, 3).map((game: any) => 
          game.match_id || game.id || game.gameId || 'no-id'
        );
        structure.hasPlayerPerformances = data.games.some((game: any) => 
          game.players && Array.isArray(game.players)
        );
      }
      
      // Check other possible fields where game data might be
      if (data.gameIds) structure.gameIds = data.gameIds;
      if (data.match_id) structure.match_id = data.match_id;
      if (data.players) structure.hasPlayersDirectly = true;
      
      matchStructures.push(structure);
    });
    
    // Also look for the specific game ID in any field
    const gameId = '8444587026';
    let foundGameIn = null;
    
    for (const doc of matchesQuery.docs) {
      const data = doc.data();
      const dataStr = JSON.stringify(data);
      
      if (dataStr.includes(gameId)) {
        foundGameIn = {
          matchId: doc.id,
          foundInData: true
        };
        break;
      }
    }
    
    return NextResponse.json({
      success: true,
      totalMatches: matchesQuery.size,
      matchStructures,
      searchedFor: gameId,
      foundGameIn
    });
    
  } catch (error: any) {
    console.error('❌ Error examining match structure:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Error examining matches: ${error.message}`
      },
      { status: 500 }
    );
  }
}