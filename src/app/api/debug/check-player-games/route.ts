import { NextResponse } from "next/server";
import { getAdminDb, ensureAdminInitialized } from "@/server/lib/admin";

export async function GET(request: Request) {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();
    
    const { searchParams } = new URL(request.url);
    const playerId = searchParams.get('playerId');
    
    if (!playerId) {
      return NextResponse.json({ error: 'playerId parameter required' }, { status: 400 });
    }
    
    console.log(`🔍 Checking games for player ${playerId}...`);
    
    // Get all matches and check their games for this player
    const matchesQuery = await db.collection('matches').get();
    const playerGames = [];
    
    for (const matchDoc of matchesQuery.docs) {
      const gamesQuery = await matchDoc.ref.collection('games').get();
      
      for (const gameDoc of gamesQuery.docs) {
        const performancesQuery = await gameDoc.ref.collection('performances').get();
        const playerPerformance = performancesQuery.docs.find(perfDoc => 
          perfDoc.id === playerId || 
          perfDoc.data().personaname === playerId ||
          perfDoc.data().playerId === playerId
        );
        
        if (playerPerformance) {
          const gameData = gameDoc.data();
          const perfData = playerPerformance.data();
          
          playerGames.push({
            matchId: matchDoc.id,
            gameId: gameDoc.id,
            gameStartTime: gameData.start_time,
            gameDuration: gameData.duration,
            radiantWin: gameData.radiant_win,
            teamName: perfData.teamName,
            role: perfData.role,
            kills: perfData.kills,
            deaths: perfData.deaths,
            assists: perfData.assists,
            fantasyPoints: perfData.fantasyPoints,
            playerSide: gameData.radiant_team?.name === perfData.teamName ? 'radiant' : 'dire',
            won: gameData.radiant_win ? 
              (gameData.radiant_team?.name === perfData.teamName) : 
              (gameData.dire_team?.name === perfData.teamName)
          });
        }
      }
    }
    
    // Sort by game start time
    playerGames.sort((a, b) => (a.gameStartTime || 0) - (b.gameStartTime || 0));
    
    console.log(`✅ Found ${playerGames.length} games for ${playerId}`);
    
    return NextResponse.json({
      success: true,
      playerId,
      totalGames: playerGames.length,
      games: playerGames,
      gameIds: playerGames.map(g => g.gameId),
      latestGame: playerGames.length > 0 ? playerGames[playerGames.length - 1] : null
    });
    
  } catch (error: any) {
    console.error('❌ Error checking player games:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    );
  }
}