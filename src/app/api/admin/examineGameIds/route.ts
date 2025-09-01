import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { getAdminDb, ensureAdminInitialized } = await import('../../../../../server/lib/admin');
    ensureAdminInitialized();
    const db = getAdminDb();

    // Get all matches with game IDs
    const matchesSnapshot = await db.collection("matches").where("game_ids", "!=", null).get();
    
    const results = {
      totalMatchesWithGameIds: matchesSnapshot.size,
      gameIdAnalysis: [] as any[],
      potentialOpenDotaIds: [] as any[]
    };

    for (const matchDoc of matchesSnapshot.docs) {
      const matchData = matchDoc.data();
      const matchId = matchDoc.id;

      if (matchData.game_ids && Array.isArray(matchData.game_ids)) {
        for (const gameId of matchData.game_ids) {
          const gameIdStr = gameId.toString();
          
          // OpenDota match IDs are typically 10 digit numbers
          const isLikelyOpenDotaId = typeof gameId === 'number' && gameIdStr.length === 10;
          
          results.gameIdAnalysis.push({
            matchId,
            gameId,
            gameIdType: typeof gameId,
            gameIdLength: gameIdStr.length,
            isLikelyOpenDotaId,
            teamA: matchData.teamA?.name,
            teamB: matchData.teamB?.name,
            status: matchData.status
          });

          if (isLikelyOpenDotaId) {
            // Get the game document to see what data we have
            try {
              const gameDoc = await matchDoc.ref.collection("games").doc(gameId.toString()).get();
              if (gameDoc.exists) {
                const gameData = gameDoc.data();
                results.potentialOpenDotaIds.push({
                  matchId,
                  gameId,
                  hasGameDoc: true,
                  gameData: {
                    radiant_win: gameData?.radiant_win,
                    duration: gameData?.duration,
                    start_time: gameData?.start_time,
                    isParsed: gameData?.isParsed,
                    radiant_team: gameData?.radiant_team,
                    dire_team: gameData?.dire_team
                  }
                });
              } else {
                results.potentialOpenDotaIds.push({
                  matchId,
                  gameId,
                  hasGameDoc: false
                });
              }
            } catch (error) {
              console.error(`Error checking game doc for ${gameId}:`, error);
            }
          }
        }
      }
    }

    // Sort by match ID for easier analysis
    results.gameIdAnalysis.sort((a, b) => a.matchId.localeCompare(b.matchId));
    results.potentialOpenDotaIds.sort((a, b) => a.matchId.localeCompare(b.matchId));

    return NextResponse.json(results);
    
  } catch (error) {
    console.error('Error examining game IDs:', error);
    return NextResponse.json({ 
      success: false, 
      error: (error as Error).message 
    }, { status: 500 });
  }
}