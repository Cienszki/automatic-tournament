import { NextResponse } from "next/server";
import { recalculateAllFantasyScoresEnhanced } from "@/lib/fantasy-enhanced-admin";

export async function POST() {
  try {
    console.log('Starting ENHANCED fantasy score recalculation via API...');
    
    const result = await recalculateAllFantasyScoresEnhanced();
    
    if (result.success) {
      console.log(`Enhanced fantasy recalculation completed: ${result.message}`);
      return NextResponse.json({
        success: true,
        message: result.message,
        usersProcessed: result.usersProcessed,
        playersProcessed: result.playersProcessed,
        totalGamesAnalyzed: result.totalGamesAnalyzed
      });
    } else {
      console.error(`Enhanced fantasy recalculation failed: ${result.message}`);
      return NextResponse.json(
        {
          success: false,
          message: result.message,
          error: 'Enhanced recalculation failed'
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Enhanced fantasy recalculation API error:', error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to run enhanced fantasy recalculation.",
        error: error.message
      },
      { status: 500 }
    );
  }
}