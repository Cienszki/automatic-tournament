// @ts-nocheck
import { NextResponse } from "next/server";
import { getAdminDb, ensureAdminInitialized } from "@/server/lib/admin";

export async function GET() {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();
    
    // Check what rounds users have fantasy lineups for
    const fantasyLineupsRef = db.collection('fantasyLineups');
    const lineupsSnap = await fantasyLineupsRef.get();
    
    const roundCounts: Record<string, number> = {};
    const roundExamples: Record<string, any[]> = {};
    const samples: any[] = [];
    
    for (const lineupDoc of lineupsSnap.docs) {
      const lineupData = lineupDoc.data();
      
      if (samples.length < 5) {
        samples.push({
          docId: lineupDoc.id,
          allKeys: Object.keys(lineupData),
          userData: {
            userId: lineupData.userId,
            displayName: lineupData.displayName,
            roundId: lineupData.roundId,
            round: lineupData.round,
            phase: lineupData.phase,
            submittedAt: lineupData.submittedAt
          }
        });
      }
      
      // Check for different round field names
      const possibleRounds = [
        lineupData.roundId,
        lineupData.round,
        lineupData.phase
      ].filter(Boolean);
      
      possibleRounds.forEach(round => {
        if (!roundCounts[round]) {
          roundCounts[round] = 0;
          roundExamples[round] = [];
        }
        roundCounts[round]++;
        
        if (roundExamples[round].length < 3) {
          roundExamples[round].push({
            userId: lineupData.userId,
            displayName: lineupData.displayName,
            roundId: lineupData.roundId,
            round: lineupData.round,
            phase: lineupData.phase
          });
        }
      });
    }
    
    return NextResponse.json({
      success: true,
      totalLineups: lineupsSnap.size,
      samples,
      roundCounts,
      roundExamples
    });
    
  } catch (error: any) {
    console.error('❌ Error checking user rounds:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Failed to check user rounds: ${error.message}`
      },
      { status: 500 }
    );
  }
}