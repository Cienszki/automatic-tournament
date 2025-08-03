import { NextRequest, NextResponse } from 'next/server';
import { recalculateMatchScoresAdmin } from '@/lib/admin-match-actions-server';

export async function POST(request: NextRequest) {
  try {
    const { matchId } = await request.json();
    
    if (!matchId) {
      return NextResponse.json({ 
        success: false, 
        error: 'matchId is required' 
      }, { status: 400 });
    }

    // Recalculate match scores and update standings
    await recalculateMatchScoresAdmin(matchId);
    
    return NextResponse.json({ 
      success: true, 
      message: `Match ${matchId} scores and standings recalculated successfully` 
    });
  } catch (error) {
    console.error('Error recalculating match:', error);
    return NextResponse.json({ 
      success: false, 
      error: (error as Error).message 
    }, { status: 500 });
  }
}
