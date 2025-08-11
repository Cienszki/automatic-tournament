// src/app/api/stats/recalculate/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { recalculateAllStats } from '@/lib/stats-service-simple';

export async function POST(request: NextRequest) {
  try {
    console.log('Starting manual stats recalculation...');
    
    // Recalculate all statistics
    await recalculateAllStats();
    
    console.log('Stats recalculation completed successfully');
    
    return NextResponse.json({
      success: true,
      message: 'Statistics recalculated successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error during stats recalculation:', error);
    
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to recalculate statistics',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST to trigger stats recalculation',
    endpoints: {
      POST: '/api/stats/recalculate - Triggers a full recalculation of all tournament statistics'
    }
  });
}
