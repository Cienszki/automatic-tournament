import { NextResponse } from "next/server";
import { recalculateUserFantasyScoresByRound } from "@/lib/fantasy-enhanced-admin";

export async function POST() {
  try {
    console.log('🚀 Starting user fantasy leaderboard recalculation...');
    
    const result = await recalculateUserFantasyScoresByRound();
    
    console.log('✅ User fantasy leaderboard recalculation completed');
    
    return NextResponse.json({
      success: true,
      message: 'User fantasy leaderboards recalculated successfully',
      result
    });
    
  } catch (error: any) {
    console.error('❌ Error in user fantasy recalculation:', error);
    return NextResponse.json(
      {
        success: false,
        message: `User fantasy recalculation failed: ${error.message}`
      },
      { status: 500 }
    );
  }
}