import { NextResponse } from "next/server";
import { getAdminDb, ensureAdminInitialized } from "@/server/lib/admin";

export async function GET() {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();
    
    console.log('🔍 Checking database collections...');
    
    const collections = [
      'games', 
      'matches', 
      'playerPerformances',
      'fantasyLineups',
      'fantasyLeaderboards',
      'tournamentPlayers',
      'gamePerformances'
    ];
    
    const results: any = {};
    
    for (const collectionName of collections) {
      try {
        const snapshot = await db.collection(collectionName).limit(5).get();
        results[collectionName] = {
          exists: true,
          count: snapshot.size,
          hasData: !snapshot.empty,
          sampleIds: snapshot.docs.map(doc => doc.id)
        };
        
        if (!snapshot.empty && collectionName === 'matches') {
          // Check if matches have games data
          const firstMatch = snapshot.docs[0].data();
          results[collectionName].hasGames = !!firstMatch.games;
          results[collectionName].gamesCount = firstMatch.games ? firstMatch.games.length : 0;
          if (firstMatch.games && firstMatch.games.length > 0) {
            results[collectionName].sampleGameId = firstMatch.games[0].match_id;
          }
        }
      } catch (error: any) {
        results[collectionName] = {
          exists: false,
          error: error.message
        };
      }
    }
    
    // Also check if the specific game ID might be in matches/games structure
    const gameId = '8444587026';
    let foundIn = null;
    
    // Search in matches for games with this ID
    try {
      const matchesQuery = await db.collection('matches').get();
      for (const matchDoc of matchesQuery.docs) {
        const matchData = matchDoc.data();
        if (matchData.games && Array.isArray(matchData.games)) {
          const foundGame = matchData.games.find((game: any) => 
            game.match_id?.toString() === gameId || 
            game.id?.toString() === gameId
          );
          if (foundGame) {
            foundIn = {
              collection: 'matches',
              matchId: matchDoc.id,
              gameIndex: matchData.games.indexOf(foundGame),
              hasFantasyPoints: foundGame.players ? foundGame.players.some((p: any) => p.fantasyPoints !== undefined) : false
            };
            break;
          }
        }
      }
    } catch (error) {
      console.log('Error searching matches:', error);
    }
    
    return NextResponse.json({
      success: true,
      collections: results,
      searchedGameId: gameId,
      foundIn: foundIn
    });
    
  } catch (error: any) {
    console.error('❌ Error checking collections:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Error checking collections: ${error.message}`
      },
      { status: 500 }
    );
  }
}