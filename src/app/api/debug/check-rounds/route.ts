// @ts-nocheck
import { NextResponse } from "next/server";
import { getAdminDb, ensureAdminInitialized } from "@/server/lib/admin";

export async function GET() {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();
    
    // Get all matches and check what round identifiers they have
    const matchesRef = db.collection('matches');
    const matchesSnap = await matchesRef.get();
    
    const roundCounts: Record<string, number> = {};
    const roundExamples: Record<string, any[]> = {};
    
    for (const matchDoc of matchesSnap.docs) {
      const matchId = matchDoc.id;
      const matchData = matchDoc.data();
      
      // Check different possible round field names
      const possibleRounds = [
        matchData.group_id,
        matchData.roundId, 
        matchData.round,
        matchData.phase,
        matchData.stage
      ].filter(Boolean);
      
      possibleRounds.forEach(round => {
        if (!roundCounts[round]) {
          roundCounts[round] = 0;
          roundExamples[round] = [];
        }
        roundCounts[round]++;
        
        if (roundExamples[round].length < 3) {
          roundExamples[round].push({
            matchId,
            group_id: matchData.group_id,
            roundId: matchData.roundId,
            round: matchData.round,
            phase: matchData.phase,
            stage: matchData.stage
          });
        }
      });
    }
    
    return NextResponse.json({
      success: true,
      totalMatches: matchesSnap.size,
      roundCounts,
      roundExamples
    });
    
  } catch (error: any) {
    console.error('❌ Error checking rounds:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Failed to check rounds: ${error.message}`
      },
      { status: 500 }
    );
  }
}