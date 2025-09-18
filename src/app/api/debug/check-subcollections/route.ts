import { NextResponse } from "next/server";
import { getAdminDb, ensureAdminInitialized } from "@/server/lib/admin";

export async function GET() {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();
    
    console.log('🔍 Checking subcollections for game: 8444587026');
    
    const gameId = '8444587026';
    const matchId = 'sBRxyEb9CJbssjnlQUTJ'; // From previous query
    
    // Check if there's a games subcollection in this match
    const gamesSubcollection = await db
      .collection('matches')
      .doc(matchId)
      .collection('games')
      .get();
    
    if (gamesSubcollection.empty) {
      return NextResponse.json({
        success: false,
        message: 'No games subcollection found in match',
        matchId,
        gameId
      });
    }
    
    console.log(`Found ${gamesSubcollection.size} games in match ${matchId}`);
    
    // Look for our specific game
    let targetGame = null;
    let allGameIds: string[] = [];
    
    for (const gameDoc of gamesSubcollection.docs) {
      const gameData = gameDoc.data();
      allGameIds.push(gameDoc.id);
      
      if (gameDoc.id === gameId || gameDoc.id === gameId.toString()) {
        targetGame = {
          id: gameDoc.id,
          data: gameData,
          hasPlayers: !!gameData.players,
          playersCount: gameData.players ? gameData.players.length : 0,
          hasPerformances: false,
          performancesCount: 0
        } as any;
        
        // Check for performances subcollection
        try {
          const performancesSubcollection = await db
            .collection('matches')
            .doc(matchId)
            .collection('games')
            .doc(gameDoc.id)
            .collection('performances')
            .get();
            
          targetGame.hasPerformances = !performancesSubcollection.empty;
          targetGame.performancesCount = performancesSubcollection.size;
          
          if (!performancesSubcollection.empty) {
            const performances: any[] = [];
            performancesSubcollection.forEach(perfDoc => {
              const perfData = perfDoc.data();
              performances.push({
                playerId: perfDoc.id,
                hasFantasyPoints: perfData.fantasyPoints !== undefined && perfData.fantasyPoints !== null,
                fantasyPoints: perfData.fantasyPoints,
                playerName: perfData.personaname || perfData.name || 'Unknown'
              });
            });
            targetGame.performances = performances;
            targetGame.allHaveFantasyPoints = performances.every(p => p.hasFantasyPoints);
          }
        } catch (error) {
          console.log('Error checking performances:', error);
          targetGame.performancesError = error;
        }
        
        break;
      }
    }
    
    return NextResponse.json({
      success: true,
      matchId,
      searchedGameId: gameId,
      foundGame: targetGame,
      allGameIdsInMatch: allGameIds,
      totalGamesInMatch: gamesSubcollection.size
    });
    
  } catch (error: any) {
    console.error('❌ Error checking subcollections:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Error checking subcollections: ${error.message}`
      },
      { status: 500 }
    );
  }
}