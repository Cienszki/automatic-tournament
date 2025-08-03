import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { getAdminDb, ensureAdminInitialized } = await import('../../../../../server/lib/admin');
    ensureAdminInitialized();
    const db = getAdminDb();

    // Focus on the completed match
    const matchId = "P5B0D7exIWyO0wDP9ml2";
    const matchDoc = await db.collection("matches").doc(matchId).get();
    
    if (!matchDoc.exists) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    const matchData = matchDoc.data();
    if (!matchData) {
      return NextResponse.json({ error: "Match data not found" }, { status: 404 });
    }

    const gamesSnapshot = await db.collection("matches").doc(matchId).collection("games").get();
    const games = gamesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Analyze the games to see if we can determine team mapping
    const analysis = games.map((game: any) => {
      const radiantPicks = game.picksBans?.filter((pb: any) => pb.is_pick && pb.team === 0) || [];
      const direPicks = game.picksBans?.filter((pb: any) => pb.is_pick && pb.team === 1) || [];
      
      return {
        gameId: game.id,
        radiant_win: game.radiant_win,
        radiantPicks: radiantPicks.length,
        direPicks: direPicks.length,
        duration: game.duration,
        // If we assume consistent team positioning across games, we can make an educated guess
        // Team A = Herbatka u Bratka (rVNxI6Uxf4UEH3H1tsAU)
        // Team B = Budzik Team (RohssvN56tR0WoGmu7c0)
      };
    });

    // In a BO2, we'd expect either 1-1 or 2-0
    // Game 1: radiant_win: false (Dire won)
    // Game 2: radiant_win: true (Radiant won)
    // Game 3: radiant_win: false (Dire won)
    
    // If teams switch sides between games (which is common), we need to figure out the pattern
    // One approach: assume Team A starts as radiant in odd games, Team B starts as radiant in even games
    // Or simply try both possibilities and see which makes sense

    return NextResponse.json({
      matchData: {
        id: matchId,
        teamA: matchData.teamA,
        teamB: matchData.teamB,
        series_format: matchData.series_format
      },
      gamesAnalysis: analysis,
      suggestion: "Based on 3 games with results [Dire, Radiant, Dire], this suggests either alternating sides or one team winning 2-1"
    });

  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json({
      success: false,
      message: `Analysis failed: ${(error as Error).message}`
    }, { status: 500 });
  }
}
