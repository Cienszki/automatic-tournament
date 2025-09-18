import { NextResponse } from "next/server";
import { getAdminDb, ensureAdminInitialized } from "@/server/lib/admin";

export async function GET() {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();
    
    // Check all user lineups for all rounds
    const fantasyLineupsRef = db.collection('fantasyLineups');
    const usersSnap = await fantasyLineupsRef.get();
    
    const roundCounts: Record<string, number> = {};
    const userRounds: Record<string, string[]> = {};
    
    for (const userDoc of usersSnap.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();
      
      // Get the rounds subcollection for this user
      const roundsRef = userDoc.ref.collection('rounds');
      const roundsSnap = await roundsRef.get();
      
      const userRoundsArray: string[] = [];
      
      for (const roundDoc of roundsSnap.docs) {
        const roundId = roundDoc.id;
        userRoundsArray.push(roundId);
        
        if (!roundCounts[roundId]) {
          roundCounts[roundId] = 0;
        }
        roundCounts[roundId]++;
      }
      
      if (userRoundsArray.length > 0) {
        userRounds[userData.displayName || userId] = userRoundsArray;
      }
    }
    
    return NextResponse.json({
      success: true,
      totalUsers: usersSnap.size,
      roundCounts,
      userRounds,
      analysis: {
        usersWithGroupStage: roundCounts['group_stage'] || 0,
        usersWithWildcards: roundCounts['wildcards'] || 0,
        uniqueRounds: Object.keys(roundCounts)
      }
    });
    
  } catch (error: any) {
    console.error('❌ Error checking all rounds:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Failed to check all rounds: ${error.message}`
      },
      { status: 500 }
    );
  }
}