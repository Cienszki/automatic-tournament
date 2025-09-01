import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { getAdminDb, ensureAdminInitialized } = await import('../../../../../server/lib/admin');
    ensureAdminInitialized();
    const db = getAdminDb();

    // Get all matches first to understand the overall structure
    const matchesSnapshot = await db.collection("matches").get();
    console.log(`Found ${matchesSnapshot.size} matches`);

    const results = {
      totalMatches: matchesSnapshot.size,
      sampleMatches: [] as any[],
      structureAnalysis: {
        matchesWithGameIds: 0,
        matchesWithOpenDotaIds: 0,
        gameIdTypes: {} as Record<string, number>,
        openDotaIdTypes: {} as Record<string, number>
      }
    };

    // Analyze structure and get sample data from first few matches
    let sampleCount = 0;
    const maxSamples = 3;

    for (const matchDoc of matchesSnapshot.docs) {
      const matchData = matchDoc.data();
      const matchId = matchDoc.id;

      // Track structure statistics
      if (matchData.game_ids && matchData.game_ids.length > 0) {
        results.structureAnalysis.matchesWithGameIds++;
        
        // Analyze game ID types
        matchData.game_ids.forEach((gameId: any) => {
          const type = typeof gameId;
          const key = `${type}${type === 'number' ? ` (${gameId.toString().length} digits)` : ''}`;
          results.structureAnalysis.gameIdTypes[key] = (results.structureAnalysis.gameIdTypes[key] || 0) + 1;
        });
      }

      if (matchData.openDotaMatchId || matchData.openDotaMatchUrl) {
        results.structureAnalysis.matchesWithOpenDotaIds++;
        
        const openDotaId = matchData.openDotaMatchId || 'from_url';
        const type = typeof openDotaId;
        results.structureAnalysis.openDotaIdTypes[type] = (results.structureAnalysis.openDotaIdTypes[type] || 0) + 1;
      }

      // Get detailed sample data for first few matches
      if (sampleCount < maxSamples) {
        try {
          // Get games subcollection
          const gamesSnapshot = await matchDoc.ref.collection("games").get();
          const games = [];
          
          for (const gameDoc of gamesSnapshot.docs) {
            const gameData = gameDoc.data();
            
            // Get performance data
            const performancesSnapshot = await gameDoc.ref.collection("performances").get();
            const performances = performancesSnapshot.docs.map(perfDoc => ({
              id: perfDoc.id,
              data: perfDoc.data()
            }));

            games.push({
              id: gameDoc.id,
              data: gameData,
              performancesCount: performances.length,
              samplePerformances: performances.slice(0, 2) // Get first 2 performances as sample
            });
          }

          results.sampleMatches.push({
            matchId,
            matchData: {
              teamA: matchData.teamA,
              teamB: matchData.teamB,
              teams: matchData.teams,
              game_ids: matchData.game_ids,
              openDotaMatchId: matchData.openDotaMatchId,
              openDotaMatchUrl: matchData.openDotaMatchUrl,
              status: matchData.status,
              series_format: matchData.series_format,
              isManualImport: matchData.isManualImport,
              isParsed: matchData.isParsed
            },
            gamesCount: games.length,
            games: games
          });

          sampleCount++;
        } catch (error) {
          console.error(`Error examining games for match ${matchId}:`, error);
        }
      }
    }

    console.log('Structure analysis results:', results.structureAnalysis);

    return NextResponse.json(results);
    
  } catch (error) {
    console.error('Error examining match structure:', error);
    return NextResponse.json({ 
      success: false, 
      error: (error as Error).message 
    }, { status: 500 });
  }
}