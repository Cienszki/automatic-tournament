import { NextRequest, NextResponse } from 'next/server';
import { recalculateMatchScoresAdmin } from '@/lib/admin-match-actions-server';
import { getAllMatches } from '@/lib/firestore';

export async function POST(request: NextRequest) {
  try {
    console.log('Starting manual recalculation of all matches...');
    
    // Get all matches
    const matches = await getAllMatches();
    
    let recalculatedCount = 0;
    
    for (const match of matches) {
      try {
        await recalculateMatchScoresAdmin(match.id);
        recalculatedCount++;
        console.log(`Recalculated match ${match.id}`);
      } catch (error) {
        console.error(`Failed to recalculate match ${match.id}:`, error);
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      message: `Recalculated ${recalculatedCount} matches`,
      totalMatches: matches.length
    });
  } catch (error) {
    console.error('Error in manual recalculation:', error);
    return NextResponse.json({ 
      success: false, 
      error: (error as Error).message 
    }, { status: 500 });
  }
}
