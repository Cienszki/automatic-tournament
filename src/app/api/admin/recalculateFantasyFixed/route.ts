import { NextResponse } from "next/server";
import { completeFantasyRecalculation, calculatePlayerRoundStats, calculateUserRoundScores, generateLeaderboards } from "@/lib/fantasy-recalc-fixed";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phase } = body; // Optional: run specific phase only
    
    console.log('🚀 Starting FIXED fantasy recalculation via API...');
    
    let result;
    
    switch (phase) {
      case 'playerStats':
        console.log('Running Phase 1 only: Player Round Stats');
        result = await calculatePlayerRoundStats();
        break;
        
      case 'userScores':
        console.log('Running Phase 2 only: User Round Scores');
        result = await calculateUserRoundScores();
        break;
        
      case 'leaderboards':
        console.log('Running Phase 3 only: Generate Leaderboards');
        result = await generateLeaderboards();
        break;
        
      default:
        console.log('Running complete 3-phase recalculation');
        result = await completeFantasyRecalculation();
        break;
    }
    
    if (result.success) {
      console.log(`✅ Fixed fantasy recalculation completed: ${result.message}`);
      return NextResponse.json({
        success: true,
        message: result.message,
        data: result,
        algorithm: 'FIXED - Player-centric scoring with accurate game counting'
      });
    } else {
      console.error(`❌ Fixed fantasy recalculation failed: ${result.message}`);
      return NextResponse.json(
        {
          success: false,
          message: result.message,
          error: 'Fixed recalculation failed',
          algorithm: 'FIXED - Player-centric scoring with accurate game counting'
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Fixed fantasy recalculation API error:', error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to run fixed fantasy recalculation.",
        error: error.message,
        algorithm: 'FIXED - Player-centric scoring with accurate game counting'
      },
      { status: 500 }
    );
  }
}