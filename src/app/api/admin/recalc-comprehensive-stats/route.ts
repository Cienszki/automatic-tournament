import { NextResponse } from "next/server";
import { calculateAllComprehensiveStats } from "@/lib/comprehensive-stats-calculator";

export async function POST() {
  try {
    console.log('🚀 Starting comprehensive stats recalculation...');
    
    await calculateAllComprehensiveStats();
    
    console.log('✅ Comprehensive stats recalculation completed');
    
    return NextResponse.json({
      success: true,
      message: 'Comprehensive stats recalculation completed successfully'
    });
    
  } catch (error: any) {
    console.error('❌ Error in comprehensive stats recalculation:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Comprehensive stats recalculation failed: ${error.message}`
      },
      { status: 500 }
    );
  }
}