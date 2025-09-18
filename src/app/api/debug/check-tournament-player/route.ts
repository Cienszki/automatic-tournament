import { NextResponse } from "next/server";
import { getAdminDb, ensureAdminInitialized } from "@/server/lib/admin";

export async function GET(request: Request) {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();
    
    const { searchParams } = new URL(request.url);
    const playerName = searchParams.get('playerName');
    
    if (!playerName) {
      return NextResponse.json({ error: 'playerName parameter required' }, { status: 400 });
    }
    
    console.log(`🔍 Checking tournament player data for ${playerName}...`);
    
    // Search for the player in tournament players
    const playersQuery = await db.collection('tournamentPlayers').get();
    const matchingPlayers: any[] = [];
    
    playersQuery.forEach(doc => {
      const player = doc.data();
      if (player.nickname && player.nickname.toLowerCase().includes(playerName.toLowerCase())) {
        matchingPlayers.push({
          id: doc.id,
          nickname: player.nickname,
          steamId32: player.steamId32,
          teamName: player.teamName,
          teamId: player.teamId,
          role: player.role,
          steamProfile: player.steamProfile,
          discordUsername: player.discordUsername
        });
      }
    });
    
    console.log(`✅ Found ${matchingPlayers.length} matching players`);
    
    return NextResponse.json({
      success: true,
      searchTerm: playerName,
      matchingPlayers,
      totalMatches: matchingPlayers.length
    });
    
  } catch (error: any) {
    console.error('❌ Error checking tournament player:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    );
  }
}