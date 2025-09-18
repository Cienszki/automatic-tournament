// @ts-nocheck
import { NextResponse } from "next/server";
import { getAdminDb, ensureAdminInitialized } from "@/server/lib/admin";

export async function GET() {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();
    
    console.log('🔍 Fetching recent games from database...');
    
    // Get recent games (limit to 20)
    const gamesQuery = await db.collection('games')
      .orderBy('start_time', 'desc')
      .limit(20)
      .get();
    
    if (gamesQuery.empty) {
      return NextResponse.json({
        success: false,
        message: 'No games found in games collection',
        total: 0,
        games: []
      });
    }
    
    const games: any[] = [];
    
    gamesQuery.forEach((doc) => {
      const gameData = doc.data();
      const gameInfo = {
        id: doc.id,
        radiant_name: gameData?.radiant_name || 'Radiant',
        dire_name: gameData?.dire_name || 'Dire',
        date: gameData?.start_time ? new Date(gameData.start_time * 1000).toISOString() : 'Unknown',
        winner: gameData?.radiant_win ? 'Radiant' : 'Dire',
        duration: gameData?.duration || 0,
        players_count: gameData?.players ? gameData.players.length : 0,
        has_fantasy_points: gameData?.players ? gameData.players.some((p: any) => p.fantasyPoints !== undefined) : false,
        all_players_have_fantasy: gameData?.players ? gameData.players.every((p: any) => p.fantasyPoints !== undefined && p.fantasyPoints !== null) : false
      };
      games.push(gameInfo);
    });
    
    // Check for game IDs that contain the searched ID
    const searchId = '8444587026';
    const matchingGames = games.filter(game => 
      game.id.includes(searchId) || 
      game.id === searchId ||
      game.id.endsWith(searchId.slice(-6)) // last 6 digits match
    );
    
    return NextResponse.json({
      success: true,
      total: games.length,
      searched_for: searchId,
      matching_games: matchingGames,
      recent_games: games.slice(0, 10), // Show first 10
      all_games_sample: games.map(g => ({ id: g.id, date: g.date }))
    });
    
  } catch (error: any) {
    console.error('❌ Error listing games:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Error listing games: ${error.message}`
      },
      { status: 500 }
    );
  }
}