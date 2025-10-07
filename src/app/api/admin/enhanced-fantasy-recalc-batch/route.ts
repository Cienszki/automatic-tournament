import { NextResponse } from "next/server";
import { recalculateUserFantasyScoresByRound } from "@/lib/fantasy-enhanced-admin";

export async function POST() {
  try {
    console.log('🚀 Starting BATCH enhanced fantasy recalculation...');

    // Use the lighter, round-aware recalculation instead of the full enhanced version
    const result = await recalculateUserFantasyScoresByRound();

    console.log('✅ Batch enhanced fantasy recalculation completed');

    return NextResponse.json({
      success: true,
      message: result.message,
      usersProcessed: result.usersProcessed,
      roundsProcessed: result.roundsProcessed,
      totalGamesAnalyzed: result.totalGamesAnalyzed
    });

  } catch (error: any) {
    console.error('❌ Error in batch enhanced fantasy recalculation:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Batch enhanced fantasy recalculation failed: ${error.message}`
      },
      { status: 500 }
    );
  }
}