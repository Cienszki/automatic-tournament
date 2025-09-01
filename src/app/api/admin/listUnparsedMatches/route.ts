import { NextResponse } from "next/server";
import { getAllUnparsedMatchesAdmin } from "@/lib/unparsed-matches-admin";

export async function GET() {
  try {
    const unparsedMatches = await getAllUnparsedMatchesAdmin();
    return NextResponse.json({
      success: true,
      count: unparsedMatches.length,
      matches: unparsedMatches.map(match => ({
        openDotaMatchId: match.openDotaMatchId,
        matchId: match.matchId,
        gameNumber: match.gameNumber,
        radiantTeam: match.radiantTeam,
        direTeam: match.direTeam,
        createdAt: match.createdAt,
        lastAttemptAt: match.lastAttemptAt,
        attemptCount: match.attemptCount
      }))
    });
  } catch (error: any) {
    return NextResponse.json(
      { 
        success: false, 
        message: "Failed to list unparsed matches.", 
        error: error.message,
        count: 0,
        matches: []
      },
      { status: 500 }
    );
  }
}