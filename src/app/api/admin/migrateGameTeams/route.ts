import { NextResponse } from "next/server";
import { getAdminDb, ensureAdminInitialized } from "../../../../../server/lib/admin";
import { getTeams } from "@/lib/admin-actions";
import { fetchOpenDotaMatch } from "@/lib/opendota";
import type { Team } from "@/lib/definitions";

export async function POST(req: Request) {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();
    
    // Get all tournament teams for name matching
    const teams = await getTeams();
    
    // Get all matches
    const matchesSnapshot = await db.collection("matches").get();
    let migratedGamesCount = 0;
    
    for (const matchDoc of matchesSnapshot.docs) {
      const matchData = matchDoc.data();
      const matchId = matchDoc.id;
      
      console.log(`Processing match ${matchId}...`);
      
      // Get all games for this match
      const gamesSnapshot = await db.collection("matches").doc(matchId).collection("games").get();
      
      for (const gameDoc of gamesSnapshot.docs) {
        const gameData = gameDoc.data();
        const gameId = gameDoc.id;
        
        // Skip if game already has team information
        if (gameData.radiant_team && gameData.dire_team) {
          console.log(`Game ${gameId} already has team info, skipping`);
          continue;
        }
        
        try {
          console.log(`Fetching OpenDota data for game ${gameId}...`);
          
          // Fetch original OpenDota match data
          const openDotaMatch = await fetchOpenDotaMatch(parseInt(gameId));
          
          // Find tournament teams by matching names
          const radiantTeam = teams.find((t: Team) => 
            t.name.trim().toLowerCase() === openDotaMatch.radiant_name?.trim().toLowerCase()
          );
          const direTeam = teams.find((t: Team) => 
            t.name.trim().toLowerCase() === openDotaMatch.dire_name?.trim().toLowerCase()
          );
          
          if (radiantTeam && direTeam) {
            // Update the game with team information
            await db.collection("matches").doc(matchId).collection("games").doc(gameId).update({
              radiant_team: { id: radiantTeam.id, name: radiantTeam.name },
              dire_team: { id: direTeam.id, name: direTeam.name }
            });
            
            migratedGamesCount++;
            console.log(`Updated game ${gameId}: ${radiantTeam.name} (Radiant) vs ${direTeam.name} (Dire)`);
          } else {
            console.log(`Could not find tournament teams for game ${gameId}: ${openDotaMatch.radiant_name} vs ${openDotaMatch.dire_name}`);
          }
          
          // Add small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
          
        } catch (error) {
          console.error(`Failed to migrate game ${gameId}:`, error);
        }
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      message: `Migration completed. Updated ${migratedGamesCount} games with team information.`,
      migratedGamesCount 
    });
    
  } catch (error) {
    console.error("Migration failed:", error);
    return NextResponse.json({ 
      success: false, 
      error: (error as Error).message 
    }, { status: 500 });
  }
}
