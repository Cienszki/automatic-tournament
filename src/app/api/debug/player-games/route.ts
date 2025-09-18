import { NextResponse } from "next/server";
import { getAdminDb, ensureAdminInitialized } from "@/server/lib/admin";

export async function GET(request: Request) {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();
    
    const { searchParams } = new URL(request.url);
    const playerName = searchParams.get('player') || 'Marchewa';
    
    console.log(`🔍 Finding all games for player: ${playerName}`);
    
    const games: any[] = [];
    
    // Get all matches
    const matchesQuery = await db.collection('matches').get();
    
    for (const matchDoc of matchesQuery.docs) {
      const matchId = matchDoc.id;
      const matchData = matchDoc.data();
      
      // Get all games in this match
      const gamesRef = matchDoc.ref.collection('games');
      const gamesSnap = await gamesRef.get();
      
      for (const gameDoc of gamesSnap.docs) {
        const gameId = gameDoc.id;
        const gameData = gameDoc.data();
        
        // Check performances subcollection for this player
        const performancesRef = gameDoc.ref.collection('performances');
        const performancesSnap = await performancesRef.get();
        
        for (const perfDoc of performancesSnap.docs) {
          const perfData = perfDoc.data();
          
          // Check if this performance belongs to our target player
          const playerNickname = perfData.personaname || perfData.nickname || perfData.name || 'Unknown';
          
          if (playerNickname.toLowerCase().includes(playerName.toLowerCase()) || 
              perfDoc.id.includes('3xm0vHddeFVo2gaodOW7')) { // Marchewa's known player ID
            
            games.push({
              matchId,
              gameId,
              playerId: perfDoc.id,
              playerNickname,
              fantasyPoints: perfData.fantasyPoints,
              matchDate: matchData.completed_at || gameData.start_time,
              teamA: matchData.teamA?.name,
              teamB: matchData.teamB?.name,
              radiantWin: gameData.radiant_win,
              duration: gameData.duration,
              gameStartTime: gameData.start_time ? new Date(gameData.start_time * 1000).toISOString() : null
            });
            
            break; // Found player in this game, move to next game
          }
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