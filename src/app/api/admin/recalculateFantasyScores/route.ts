import { NextResponse } from "next/server";
import { recalculateAllFantasyScores } from "@/lib/fantasy-scoring-admin";

export async function POST() {
  try {
    console.log('Starting fantasy score recalculation via API...');
    
    const result = await recalculateAllFantasyScores();
    
    if (result.success) {
      console.log(`Fantasy score recalculation completed: ${result.message}`);
      return NextResponse.json({
        success: true,
        message: result.message,
        usersProcessed: result.usersProcessed,
        roundsProcessed: result.roundsProcessed,
        totalPointsDistributed: result.totalPointsDistributed,
        totalGamesPlayed: result.totalGamesPlayed
      });
    } else {
      console.error(`Fantasy score recalculation failed: ${result.message}`);
      return NextResponse.json(
        {
          success: false,
          message: result.message,
          error: 'Recalculation failed'
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Fantasy score recalculation API error:', error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to recalculate fantasy scores.",
        error: error.message
      },
      { status: 500 }
    );
  }
}