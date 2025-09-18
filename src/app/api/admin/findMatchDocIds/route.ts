import { NextRequest, NextResponse } from 'next/server';
import { ensureAdminInitialized, getAdminDb } from '../../../../server/lib/admin';

/**
 * Find match document IDs for given game IDs
 */
export async function POST(request: NextRequest) {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();
    
    const { gameIds } = await request.json();
    
    if (!gameIds || !Array.isArray(gameIds)) {
      return NextResponse.json({
        success: false,
        message: 'gameIds array is required'
      }, { status: 400 });
    }
    
    console.log(`🔍 Finding match document IDs for ${gameIds.length} games:`, gameIds);
    
    const results: Array<{
      gameId: string;
      matchDocId?: string;
      radiantTeam?: string;
      direTeam?: string;
      found: boolean;
      matchInfo?: {
        teamA: string;
        teamB: string;
        matchStatus: string;
      };
    }> = [];
    
    // Get all matches
    const matchesSnap = await db.collection('matches').get();
    
    for (const gameId of gameIds) {
      console.log(`🔍 Searching for game ${gameId}...`);
      
      let found = false;
      
      // Search through all matches
      for (const matchDoc of matchesSnap.docs) {
        const matchId = matchDoc.id;
        
        // Check games subcollection for this match
        const gamesSnap = await matchDoc.ref.collection('games').where('__name__', '==', gameId.toString()).get();
        
        if (!gamesSnap.empty) {
          // Found the game in this match
          const gameDoc = gamesSnap.docs[0];
          const gameData = gameDoc.data();
          const matchData = matchDoc.data();
          
          results.push({
            gameId: gameId.toString(),
            matchDocId: matchId,
            radiantTeam: gameData.radiant_team?.name || 'Unknown',
            direTeam: gameData.dire_team?.name || 'Unknown',
            found: true,
            matchInfo: {
              teamA: matchData.teamA?.name || 'Unknown',
              teamB: matchData.teamB?.name || 'Unknown',
              matchStatus: matchData.status || 'Unknown'
            }
          });
          
          console.log(`✅ Found game ${gameId} in match ${matchId}`);
          found = true;
          break;
        }
      }
      
      if (!found) {
        results.push({
          gameId: gameId.toString(),
          found: false
        });
        console.log(`❌ Game ${gameId} not found in any match`);
      }
    }
    
    const foundCount = results.filter(r => r.found).length;
    console.log(`🎉 Found ${foundCount}/${gameIds.length} games`);
    
    return NextResponse.json({
      success: true,
      message: `Found ${foundCount}/${gameIds.length} games`,
      results: results,
      summary: {
        total: gameIds.length,
        found: foundCount,
        notFound: gameIds.length - foundCount
      }
    });
    
  } catch (error: any) {
    console.error('❌ Error finding match document IDs:', error);
    return NextResponse.json({
      success: false,
      message: `Error finding match document IDs: ${error.message}`,
      results: []
    }, { status: 500 });
  }
}