import { NextResponse } from "next/server";
import { recalculateAllFantasyScoresEnhanced } from "@/lib/fantasy-enhanced-admin";

export async function POST() {
  try {
    console.log('🚀 Starting enhanced fantasy recalculation...');
    
    const result = await recalculateAllFantasyScoresEnhanced();
    
    console.log('✅ Enhanced fantasy recalculation completed');
    
    return NextResponse.json({
      success: true,
      message: 'Enhanced fantasy recalculation completed successfully',
      result
    });
    
  } catch (error: any) {
    console.error('❌ Error in enhanced fantasy recalculation:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Enhanced fantasy recalculation failed: ${error.message}`
      },
      { status: 500 }
    );
  }
}