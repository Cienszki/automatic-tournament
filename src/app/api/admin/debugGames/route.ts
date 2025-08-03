import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { getAdminDb, ensureAdminInitialized } = await import('../../../../../server/lib/admin');
    ensureAdminInitialized();
    const db = getAdminDb();

    const matchId = "P5B0D7exIWyO0wDP9ml2"; // The completed match from our debug
    
    // Get match data
    const matchRef = db.collection("matches").doc(matchId);
    const matchDoc = await matchRef.get();
    const matchData = matchDoc.data();
    
    // Get all games for this match
    const gamesSnapshot = await matchRef.collection("games").get();
    const games = gamesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    return NextResponse.json({ 
      matchData: {
        id: matchId,
        teams: matchData?.teams,
        series_format: matchData?.series_format,
        status: matchData?.status,
        teamA: matchData?.teamA,
        teamB: matchData?.teamB
      },
      gamesCount: games.length,
      games: games
    });
  } catch (error) {
    console.error('Error debugging match games:', error);
    return NextResponse.json({ 
      success: false, 
      error: (error as Error).message 
    }, { status: 500 });
  }
}
