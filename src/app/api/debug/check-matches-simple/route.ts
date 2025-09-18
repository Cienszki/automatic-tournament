// @ts-nocheck
import { NextResponse } from "next/server";
import { getAdminDb, ensureAdminInitialized } from "@/server/lib/admin";

export async function GET() {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();
    
    const matchesRef = db.collection('matches');
    const matchesSnap = await matchesRef.get();
    
    const roundCounts: Record<string, number> = {};
    let totalMatches = 0;
    
    for (const matchDoc of matchesSnap.docs) {
      const matchData = matchDoc.data();
      totalMatches++;
      
      // Check all possible round identifiers
      const roundFields = [
        matchData.group_id,
        matchData.roundId, 
        matchData.round,
        matchData.phase,
        matchData.stage
      ];
      
      for (const round of roundFields) {
        if (round) {
          roundCounts[round] = (roundCounts[round] || 0) + 1;
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      totalMatches,
      roundCounts,
      uniqueRounds: Object.keys(roundCounts).sort()
    });
    
  } catch (error: any) {
    console.error('Error checking matches:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}