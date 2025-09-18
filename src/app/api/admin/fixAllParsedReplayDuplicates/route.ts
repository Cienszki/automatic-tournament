import { NextResponse } from "next/server";
import { getAdminDb, ensureAdminInitialized } from "@/server/lib/admin";

export async function POST() {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();
    
    console.log('🔧 Starting comprehensive fix for all parsed replay duplicate performance documents...');
    
    // All 4 known parsed replay games that may have duplicates
    // First find the correct match IDs for each game by looking for existing matches
    const parsedGameIds = ['8427125277', '8430102930', '8431558092', '8431678099'];
    const parsedGames = [];
    
    // Find actual match IDs for each game
    for (const gameId of parsedGameIds) {
      console.log(`🔍 Finding match for game ${gameId}...`);
      
      // Search for matches that contain this game
      const allMatchesQuery = await db.collection('matches').get();
      let foundMatchId = null;
      
      for (const matchDoc of allMatchesQuery.docs) {
        const gamesQuery = await matchDoc.ref.collection('games').doc(gameId).get();
        if (gamesQuery.exists) {
          foundMatchId = matchDoc.id;
          console.log(`✅ Found game ${gameId} in match ${foundMatchId}`);
          break;
        }
      }
      
      if (foundMatchId) {
        parsedGames.push({ matchId: foundMatchId, gameId });
      } else {
        console.log(`⚠️ Game ${gameId} not found in any match - may not have been processed yet`);
      }
    }
    
    let totalFixed = 0;
    const results = [];
    
    for (const { matchId, gameId } of parsedGames) {
      console.log(`🔍 Processing game ${gameId} in match ${matchId}...`);
      
      // Get all tournament players for lookup
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
      
      // Get game performances
      const gameRef = db.collection('matches').doc(matchId).collection('games').doc(gameId);
      const performancesQuery = await gameRef.collection('performances').get();
      
      // Group performances by Steam32 ID to find duplicates
      const performancesByPlayer: Record<string, Array<{
        docId: string;
        data: any;
        isCorrectId: boolean;
        steam32: string;
      }>> = {};
      
      performancesQuery.docs.forEach(perfDoc => {
        const perfId = perfDoc.id;
        const perfData = perfDoc.data();
        
        if (perfData.steamId32) {
          const steam32 = perfData.steamId32.toString();
          
          if (!performancesByPlayer[steam32]) {
            performancesByPlayer[steam32] = [];
          }
          
          // Determine if this document ID is correct (should match tournament player ID)
          const correctTournamentId = playerLookup[steam32]?.tournamentPlayerId;
          const isCorrectId = perfId === correctTournamentId;
          
          performancesByPlayer[steam32].push({
            docId: perfId,
            data: perfData,
            isCorrectId,
            steam32
          });
        }
      });
      
      // Find duplicates and fix them
      const batch = db.batch();
      let gameFixCount = 0;
      
      for (const [steam32, performances] of Object.entries(performancesByPlayer)) {
        if (performances.length > 1) {
          console.log(`🔄 Found ${performances.length} duplicates for player ${steam32}`);
          
          const correctTournamentId = playerLookup[steam32]?.tournamentPlayerId;
          if (!correctTournamentId) {
            console.log(`⚠️ No tournament player ID found for Steam32: ${steam32}`);
            continue;
          }
          
          // Find the document with correct ID (if any)
          let correctDoc = performances.find(p => p.isCorrectId);
          
          // If no correct document exists, use the first one as source
          const sourceDoc = correctDoc || performances[0];
          
          // Merge data from all duplicates (in case there are differences)
          let mergedData = { ...sourceDoc.data };
          performances.forEach(perf => {
            // Merge performance data, preferring non-null values
            Object.keys(perf.data).forEach(key => {
              if (perf.data[key] != null && mergedData[key] == null) {
                mergedData[key] = perf.data[key];
              }
            });
          });
          
          // Ensure the playerId is set to correct tournament ID
          mergedData.playerId = correctTournamentId;
          
          // Create/update the correct document
          const correctPerfRef = gameRef.collection('performances').doc(correctTournamentId);
          batch.set(correctPerfRef, mergedData);
          
          // Delete all incorrect duplicates
          performances.forEach(perf => {
            if (perf.docId !== correctTournamentId) {
              const incorrectPerfRef = gameRef.collection('performances').doc(perf.docId);
              batch.delete(incorrectPerfRef);
            }
          });
          
          gameFixCount++;
          console.log(`✅ Prepared fix for ${steam32} -> ${correctTournamentId}`);
        }
      }
      
      if (gameFixCount > 0) {
        await batch.commit();
        console.log(`🎯 Fixed ${gameFixCount} duplicate sets in game ${gameId}`);
        totalFixed += gameFixCount;
        
        results.push({
          matchId,
          gameId,
          duplicatesFixed: gameFixCount
        });
      } else {
        console.log(`✨ No duplicates found in game ${gameId}`);
        results.push({
          matchId,
          gameId,
          duplicatesFixed: 0
        });
      }
    }
    
    console.log(`🏆 Comprehensive fix completed! Total player duplicates fixed: ${totalFixed}`);
    
    return NextResponse.json({
      success: true,
      message: `Fixed ${totalFixed} duplicate performance documents across ${parsedGames.length} parsed replay games`,
      totalFixed,
      gameResults: results
    });
    
  } catch (error: any) {
    console.error('❌ Error fixing parsed replay duplicates:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Error fixing duplicates: ${error.message}`
      },
      { status: 500 }
    );
  }
}