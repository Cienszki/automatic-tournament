// @ts-nocheck
import { NextResponse } from "next/server";
import { getAdminDb, ensureAdminInitialized } from "@/server/lib/admin";

export async function GET(request: Request) {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();
    
    const { searchParams } = new URL(request.url);
    const gameId = searchParams.get('gameId');
    
    if (!gameId) {
      return NextResponse.json({ error: 'gameId parameter required' }, { status: 400 });
    }
    
    console.log(`🔍 Checking if game ${gameId} was properly saved...`);
    
    // Look for the game across all matches
    const matchesQuery = await db.collection('matches').get();
    let gameFound = false;
    let matchId = null;
    let gameData = null;
    
    for (const matchDoc of matchesQuery.docs) {
      const gameRef = matchDoc.ref.collection('games').doc(gameId);
      const gameSnap = await gameRef.get();
      
      if (gameSnap.exists) {
        gameFound = true;
        matchId = matchDoc.id;
        gameData = gameSnap.data();
        
        // Get performances
        const performancesQuery = await gameRef.collection('performances').get();
        const performances = performancesQuery.docs.map(doc => ({
          playerId: doc.id,
          ...doc.data()
        } as any));
        
        // Check specifically for Marchewa
        const marchewaPerformance = performances.find(p => 
          p.personaname === 'Marchewa' || 
          p.playerId === 'Marchewa' ||
          p.steamId32 === '106750803'
        );
        
        console.log(`✅ Game ${gameId} found in match ${matchId}`);
        console.log(`📊 Total performances: ${performances.length}`);
        console.log(`🎯 Marchewa found: ${marchewaPerformance ? 'YES' : 'NO'}`);
        
        return NextResponse.json({
          success: true,
          gameFound,
          matchId,
          gameData: {
            radiant_team: gameData?.radiant_team,
            dire_team: gameData?.dire_team,
            duration: gameData?.duration,
            radiant_win: gameData?.radiant_win
          },
          totalPerformances: performances.length,
          marchewaFound: !!marchewaPerformance,
          marchewaPerformance: marchewaPerformance || null,
          allPlayers: performances.map(p => ({
            playerId: p.playerId,
            personaname: p.personaname,
            steamId32: p.steamId32,
            teamName: p.teamName
          }))
        });
      }
    }
    
    console.log(`❌ Game ${gameId} not found in any match`);
    
    return NextResponse.json({
      success: false,
      gameFound: false,
      message: `Game ${gameId} not found in any match document`
    });
    
  } catch (error: any) {
    console.error('❌ Error checking game save:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    );
  }
}