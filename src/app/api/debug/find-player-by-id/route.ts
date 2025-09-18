// @ts-nocheck
import { NextResponse } from "next/server";
import { getAdminDb, ensureAdminInitialized } from "@/server/lib/admin";

export async function GET(request: Request) {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();
    
    const { searchParams } = new URL(request.url);
    const playerId = searchParams.get('id') || '3xm0vHddeFVo2gaodOW7'; // Marchewa's ID
    const playerName = searchParams.get('name') || 'Marchewa';
    
    console.log(`🔍 Finding all games for player ID: ${playerId} (${playerName})`);
    
    const games: any[] = [];
    let processedMatches = 0;
    
    // Get all matches
    const matchesQuery = await db.collection('matches').get();
    const totalMatches = matchesQuery.size;
    
    for (const matchDoc of matchesQuery.docs) {
      processedMatches++;
      console.log(`Processing match ${processedMatches}/${totalMatches}: ${matchDoc.id}`);
      
      const matchId = matchDoc.id;
      const matchData = matchDoc.data();
      
      // Get all games in this match
      const gamesRef = matchDoc.ref.collection('games');
      const gamesSnap = await gamesRef.get();
      
      for (const gameDoc of gamesSnap.docs) {
        const gameId = gameDoc.id;
        const gameData = gameDoc.data();
        
        // Check if this player has a performance in this game
        const playerPerfRef = gameDoc.ref.collection('performances').doc(playerId);
        const playerPerfSnap = await playerPerfRef.get();
        
        if (playerPerfSnap.exists) {
          const perfData = playerPerfSnap.data();
          
          games.push({
            matchId,
            gameId,
            playerId,
            playerName,
            fantasyPoints: perfData?.fantasyPoints || 0,
            matchDate: matchData.completed_at,
            teamA: matchData.teamA?.name,
            teamB: matchData.teamB?.name,
            radiantWin: gameData.radiant_win,
            duration: gameData.duration,
            gameStartTime: gameData.start_time ? new Date(gameData.start_time * 1000).toISOString() : null,
            // Include some performance stats
            kills: perfData?.kills,
            deaths: perfData?.deaths,
            assists: perfData?.assists,
            heroName: perfData?.hero_name
          });
        }
      }
    }
    
    // Sort games by date
    games.sort((a, b) => {
      const dateA = new Date(a.matchDate || a.gameStartTime || 0).getTime();
      const dateB = new Date(b.matchDate || b.gameStartTime || 0).getTime();
      return dateA - dateB;
    });
    
    return NextResponse.json({
      success: true,
      playerId,
      playerName,
      totalGames: games.length,
      games,
      totalFantasyPoints: games.reduce((sum, game) => sum + (game.fantasyPoints || 0), 0),
      averageFantasyPoints: games.length > 0 ? games.reduce((sum, game) => sum + (game.fantasyPoints || 0), 0) / games.length : 0
    });
    
  } catch (error: any) {
    console.error('❌ Error finding player games:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Error finding player games: ${error.message}`
      },
      { status: 500 }
    );
  }
}