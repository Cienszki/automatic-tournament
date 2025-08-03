import { NextResponse } from "next/server";

export async function POST() {
  try {
    const { getAdminDb, ensureAdminInitialized } = await import('../../../../../server/lib/admin');
    ensureAdminInitialized();
    const db = getAdminDb();

    // Get all matches
    const matchesSnapshot = await db.collection("matches").get();
    let migratedGames = 0;
    let processedMatches = 0;

    for (const matchDoc of matchesSnapshot.docs) {
      const matchData = matchDoc.data();
      if (!matchData.teams || matchData.teams.length !== 2) continue;

      const teamAId = matchData.teams[0];
      const teamBId = matchData.teams[1];

      // Get team data to get names
      const teamADoc = await db.collection("teams").doc(teamAId).get();
      const teamBDoc = await db.collection("teams").doc(teamBId).get();

      if (!teamADoc.exists || !teamBDoc.exists) continue;

      const teamAData = teamADoc.data();
      const teamBData = teamBDoc.data();

      // Get all games for this match
      const gamesSnapshot = await db.collection("matches").doc(matchDoc.id).collection("games").get();
      
      for (const gameDoc of gamesSnapshot.docs) {
        const gameData = gameDoc.data();
        
        // Skip if game already has team mapping
        if (gameData.radiant_team && gameData.dire_team) continue;

        // Determine which team was radiant/dire
        // For now, let's assume teamA is always radiant and teamB is always dire
        // This is a simplification - in reality we'd need more logic to determine this
        // But since we have the game results (radiant_win), we can infer this later if needed

        const updatedGameData = {
          ...gameData,
          radiant_team: { id: teamAId, name: teamAData?.name || "Team A" },
          dire_team: { id: teamBId, name: teamBData?.name || "Team B" }
        };

        await db.collection("matches").doc(matchDoc.id).collection("games").doc(gameDoc.id).update({
          radiant_team: updatedGameData.radiant_team,
          dire_team: updatedGameData.dire_team
        });

        migratedGames++;
      }

      processedMatches++;
    }

    return NextResponse.json({
      success: true,
      message: `Migration complete: ${migratedGames} games updated across ${processedMatches} matches`,
      migratedGames,
      processedMatches
    });

  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json({
      success: false,
      message: `Migration failed: ${(error as Error).message}`
    }, { status: 500 });
  }
}
