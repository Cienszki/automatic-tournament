import { NextResponse } from "next/server";
import { getAdminDb, ensureAdminInitialized } from "@/server/lib/admin";

export async function GET() {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();
    
    console.log('🔍 Checking game_ids in matches...');
    
    const matchesQuery = await db.collection('matches').get();
    
    const gameId = '8444587026';
    let foundMatch = null;
    const allGameIds: string[] = [];
    
    matchesQuery.forEach((doc) => {
      const data = doc.data();
      
      if (data.game_ids && Array.isArray(data.game_ids)) {
        allGameIds.push(...data.game_ids);
        
        // Check if our target game ID is in this match
        const hasGameId = data.game_ids.some((id: string) => 
          id === gameId || id.toString() === gameId
        );
        
        if (hasGameId) {
          foundMatch = {
            matchId: doc.id,
            game_ids: data.game_ids,
            teamA: data.teamA,
            teamB: data.teamB,
            status: data.status,
            completed_at: data.completed_at
          };
        }
      }
    });
    
    // Now check if the game exists in the individual game documents
    let gameDocExists = false;
    let gameData = null;
    
    if (foundMatch) {
      try {
        const gameDoc = await db.collection('games').doc(gameId).get();
        gameDocExists = gameDoc.exists;
        if (gameDocExists) {
          gameData = gameDoc.data();
        }
      } catch (error) {
        console.log('Error checking game doc:', error);
      }
    }
    
    return NextResponse.json({
      success: true,
      searchedGameId: gameId,
      foundInMatch: foundMatch,
      gameDocExists,
      gameHasFantasyScores: gameData?.players ? 
        gameData.players.some((p: any) => p.fantasyPoints !== undefined) : false,
      totalUniqueGameIds: [...new Set(allGameIds)].length,
      sampleGameIds: [...new Set(allGameIds)].slice(0, 10)
    });
    
  } catch (error: any) {
    console.error('❌ Error checking game IDs:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Error checking game IDs: ${error.message}`
      },
      { status: 500 }
    );
  }
}