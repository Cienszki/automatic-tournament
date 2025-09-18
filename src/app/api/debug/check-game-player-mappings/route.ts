import { NextResponse } from "next/server";
import { getAdminDb, ensureAdminInitialized } from "@/server/lib/admin";

export async function GET(request: Request) {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();
    
    const { searchParams } = new URL(request.url);
    const gameId = searchParams.get('gameId') || '8430102930';
    
    console.log(`🔍 Checking player ID mappings for game ${gameId}...`);
    
    // Get all tournament players for reference
    const playersQuery = await db.collection('tournamentPlayers').get();
    const playerLookup: Record<string, { 
      tournamentPlayerId: string; 
      nickname: string; 
      steamId32: string; 
      teamName: string; 
      role: string; 
    }> = {};
    
    playersQuery.forEach(doc => {
      const player = doc.data();
      if (player.steamId32) {
        const steam32Str = player.steamId32.toString();
        playerLookup[steam32Str] = {
          tournamentPlayerId: doc.id,
          nickname: player.nickname,
          steamId32: steam32Str,
          teamName: player.teamName,
          role: player.role
        };
        
        // Also index by nickname for lookup
        if (player.nickname) {
          playerLookup[player.nickname] = playerLookup[steam32Str];
        }
      }
    });
    
    // Get the game performances
    const matchRef = db.collection('matches').doc('7VdHDXHUb0uSjOOiaD9r');
    const gameRef = matchRef.collection('games').doc(gameId);
    const performancesQuery = await gameRef.collection('performances').get();
    
    const performanceAnalysis: any[] = [];
    const duplicatesByPlayer: Record<string, string[]> = {};
    
    performancesQuery.docs.forEach(perfDoc => {
      const perfId = perfDoc.id;
      const perfData = perfDoc.data();
      
      // Try to determine the correct tournament player ID
      let correctTournamentId = null;
      let lookupMethod = 'none';
      
      // Method 1: Direct tournament player ID lookup
      if (playerLookup[perfId] && playerLookup[perfId].tournamentPlayerId === perfId) {
        correctTournamentId = perfId;
        lookupMethod = 'direct_tournament_id';
      }
      // Method 2: Steam32 ID lookup
      else if (perfData.steamId32 && playerLookup[perfData.steamId32.toString()]) {
        correctTournamentId = playerLookup[perfData.steamId32.toString()].tournamentPlayerId;
        lookupMethod = 'steam32_lookup';
      }
      // Method 3: Nickname lookup
      else if (perfData.personaname && playerLookup[perfData.personaname]) {
        correctTournamentId = playerLookup[perfData.personaname].tournamentPlayerId;
        lookupMethod = 'nickname_lookup';
      }
      
      // Track duplicates by Steam32 ID
      if (perfData.steamId32) {
        const steam32Key = perfData.steamId32.toString();
        if (!duplicatesByPlayer[steam32Key]) {
          duplicatesByPlayer[steam32Key] = [];
        }
        duplicatesByPlayer[steam32Key].push(perfId);
      }
      
      performanceAnalysis.push({
        currentPerformanceId: perfId,
        correctTournamentId,
        lookupMethod,
        isCorrect: perfId === correctTournamentId,
        playerData: {
          steamId32: perfData.steamId32,
          personaname: perfData.personaname,
          teamName: perfData.teamName,
          role: perfData.role
        },
        expectedPlayerData: correctTournamentId ? playerLookup[correctTournamentId] : null
      });
    });
    
    // Find actual duplicates (same Steam32, different performance IDs)
    const duplicates = Object.entries(duplicatesByPlayer)
      .filter(([steam32, perfIds]) => perfIds.length > 1)
      .map(([steam32, perfIds]) => ({
        steam32,
        performanceIds: perfIds,
        correctTournamentId: playerLookup[steam32]?.tournamentPlayerId || null,
        nickname: playerLookup[steam32]?.nickname || 'Unknown'
      }));
    
    return NextResponse.json({
      success: true,
      gameId,
      totalPerformances: performancesQuery.docs.length,
      expectedPerformances: 10, // 5v5 game
      performanceAnalysis,
      duplicates,
      summary: {
        correctIds: performanceAnalysis.filter(p => p.isCorrect).length,
        incorrectIds: performanceAnalysis.filter(p => !p.isCorrect).length,
        duplicateCount: duplicates.reduce((sum, d) => sum + (d.performanceIds.length - 1), 0)
      }
    });
    
  } catch (error: any) {
    console.error('❌ Error checking player mappings:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    );
  }
}