import { NextRequest, NextResponse } from 'next/server';
import { getMatchReprocessingStatus } from '../../../../lib/match-reprocessing-admin';

/**
 * Get status and recommendations for match reprocessing
 */
export async function GET(request: NextRequest) {
  try {
    const status = await getMatchReprocessingStatus();
    
    return NextResponse.json({
      success: true,
      status
    });
    
  } catch (error) {
    console.error('Failed to get match reprocessing status:', error);
    return NextResponse.json({
      success: false,
      message: `Failed to get status: ${(error as Error).message}`
    }, { status: 500 });
  }
}