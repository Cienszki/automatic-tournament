import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { getAdminDb, ensureAdminInitialized } = await import('../../../../../server/lib/admin');
    ensureAdminInitialized();
    const db = getAdminDb();

    // Let's examine a specific completed match with game data
    const matchId = "0Q1zNJl50nhaAU2aN3cJ"; // From our previous query
    
    const matchDoc = await db.collection("matches").doc(matchId).get();
    if (!matchDoc.exists) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    const matchData = matchDoc.data()!;
    const result = {
      matchInfo: {
        id: matchId,
        teamA: matchData.teamA,
        teamB: matchData.teamB,
        status: matchData.status,
        game_ids: matchData.game_ids,
        openDotaMatchId: matchData.openDotaMatchId,
        series_format: matchData.series_format
      },
      games: [] as any[]
    };

    // Get all games for this match
    const gamesSnapshot = await matchDoc.ref.collection("games").get();
    
    for (const gameDoc of gamesSnapshot.docs) {
      const gameData = gameDoc.data();
      const gameInfo = {
        gameId: gameDoc.id,
        gameData: {
          id: gameData.id,
          radiant_win: gameData.radiant_win,
          duration: gameData.duration,
          start_time: gameData.start_time,
          isParsed: gameData.isParsed,
          radiant_team: gameData.radiant_team,
          dire_team: gameData.dire_team
        },
        performances: [] as any[]
      };

      // Get all performances for this game
      const performancesSnapshot = await gameDoc.ref.collection("performances").get();
      
      for (const perfDoc of performancesSnapshot.docs) {
        const perfData = perfDoc.data();
        gameInfo.performances.push({
          playerId: perfDoc.id,
          data: perfData
        });
      }

      result.games.push(gameInfo);
    }

    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Error examining specific match:', error);
    return NextResponse.json({ 
      success: false, 
      error: (error as Error).message 
    }, { status: 500 });
  }
}