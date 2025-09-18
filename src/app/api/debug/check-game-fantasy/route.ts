// @ts-nocheck
import { NextResponse } from "next/server";
import { getAdminDb, ensureAdminInitialized } from "@/server/lib/admin";

export async function GET(request: Request) {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();
    
    const { searchParams } = new URL(request.url);
    const gameId = searchParams.get('gameId') || '8444587026';
    
    console.log(`🔍 Checking fantasy scores for game: ${gameId}`);
    
    // Check if game exists
    const gameDoc = await db.collection('games').doc(gameId).get();
    if (!gameDoc.exists) {
      return NextResponse.json({
        success: false,
        message: 'Game not found in games collection',
        gameId
      });
    }
    
    const gameData = gameDoc.data();
    const gameInfo = {
      gameId,
      radiant_name: gameData?.radiant_name || 'Radiant',
      dire_name: gameData?.dire_name || 'Dire',
      date: gameData?.start_time ? new Date(gameData.start_time * 1000).toISOString() : 'Unknown',
      winner: gameData?.radiant_win ? 'Radiant' : 'Dire',
      duration: gameData?.duration || 0
    };
    
    // Check player performances
    if (!gameData?.players || !Array.isArray(gameData.players)) {
      return NextResponse.json({
        success: false,
        message: 'No player data found in game',
        gameInfo
      });
    }
    
    let playersWithFantasyPoints = 0;
    let totalFantasyPoints = 0;
    const playerDetails: any[] = [];
    
    gameData.players.forEach((player: any, index: number) => {
      const hasFantasyPoints = player.fantasyPoints !== undefined && player.fantasyPoints !== null;
      const fantasyPoints = player.fantasyPoints || 0;
      
      const playerInfo = {
        slot: index + 1,
        name: player.personaname || `Player ${index + 1}`,
        account_id: player.account_id,
        hero_id: player.hero_id,
        team: index < 5 ? 'Radiant' : 'Dire',
        kda: `${player.kills || 0}/${player.deaths || 0}/${player.assists || 0}`,
        fantasy_points: hasFantasyPoints ? fantasyPoints : null,
        has_fantasy_points: hasFantasyPoints,
        gpm: player.gold_per_min || 0,
        xpm: player.xp_per_min || 0,
        last_hits: player.last_hits || 0,
        denies: player.denies || 0
      };
      
      playerDetails.push(playerInfo);
      
      if (hasFantasyPoints) {
        playersWithFantasyPoints++;
        totalFantasyPoints += fantasyPoints;
      }
    });
    
    const summary = {
      total_players: gameData.players.length,
      players_with_fantasy_points: playersWithFantasyPoints,
      players_missing_fantasy_points: gameData.players.length - playersWithFantasyPoints,
      total_fantasy_points: totalFantasyPoints,
      average_fantasy_points: gameData.players.length > 0 ? totalFantasyPoints / gameData.players.length : 0,
      all_players_have_scores: playersWithFantasyPoints === gameData.players.length
    };
    
    return NextResponse.json({
      success: true,
      gameInfo,
      summary,
      players: playerDetails
    });
    
  } catch (error: any) {
    console.error('❌ Error checking game fantasy scores:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Error checking game: ${error.message}`
      },
      { status: 500 }
    );
  }
}