import { NextResponse } from "next/server";

export async function POST() {
  try {
    const { getAdminDb, ensureAdminInitialized } = await import('../../../../../server/lib/admin');
    ensureAdminInitialized();
    const db = getAdminDb();

    // Focus on the specific completed match
    const matchId = "P5B0D7exIWyO0wDP9ml2";
    const matchDoc = await db.collection("matches").doc(matchId).get();
    
    if (!matchDoc.exists) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    const matchData = matchDoc.data();
    if (!matchData) {
      return NextResponse.json({ error: "Match data not found" }, { status: 404 });
    }

    // Team A: Herbatka u Bratka (rVNxI6Uxf4UEH3H1tsAU)
    // Team B: Budzik Team (RohssvN56tR0WoGmu7c0)
    const teamA = { id: matchData.teamA.id, name: matchData.teamA.name };
    const teamB = { id: matchData.teamB.id, name: matchData.teamB.name };

    const gamesSnapshot = await db.collection("matches").doc(matchId).collection("games").get();
    const gameUpdates = [];

    // Game pattern: [Dire, Radiant, Dire] wins
    // Assume alternating sides starting with Team A as Radiant in game 1
    for (const gameDoc of gamesSnapshot.docs) {
      const gameData = gameDoc.data();
      const gameIndex = parseInt(gameDoc.id.slice(-1)) || 1; // Try to determine game order
      
      // For simplicity, let's assign based on game ID order
      const gameIds = gamesSnapshot.docs.map(doc => doc.id).sort();
      const currentGameIndex = gameIds.indexOf(gameDoc.id);
      
      let radiantTeam, direTeam;
      
      // Alternate sides: Team A starts as Radiant in odd games (0, 2), Team B as Radiant in even games (1)
      if (currentGameIndex % 2 === 0) {
        // Team A is Radiant, Team B is Dire
        radiantTeam = teamA;
        direTeam = teamB;
      } else {
        // Team B is Radiant, Team A is Dire  
        radiantTeam = teamB;
        direTeam = teamA;
      }

      await db.collection("matches").doc(matchId).collection("games").doc(gameDoc.id).update({
        radiant_team: radiantTeam,
        dire_team: direTeam
      });

      gameUpdates.push({
        gameId: gameDoc.id,
        gameIndex: currentGameIndex,
        radiant_win: gameData.radiant_win,
        radiantTeam: radiantTeam.name,
        direTeam: direTeam.name,
        winner: gameData.radiant_win ? radiantTeam.name : direTeam.name
      });
    }

    return NextResponse.json({
      success: true,
      message: `Updated ${gameUpdates.length} games with team mapping`,
      matchId,
      gameUpdates
    });

  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json({
      success: false,
      message: `Migration failed: ${(error as Error).message}`
    }, { status: 500 });
  }
}
