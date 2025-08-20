import { NextRequest, NextResponse } from 'next/server';
import { getAllMatchesAdmin } from '../../../../server/lib/getAllMatchesAdmin';

export async function GET(request: NextRequest) {
  try {
  const allMatches = await getAllMatchesAdmin();
    const completedMatches = allMatches.filter(match => match.status === 'completed');
    
    const matchDetails = completedMatches.map(match => ({
      id: match.id,
      status: match.status,
      teamA: { id: match.teamA.id, name: match.teamA.name, score: match.teamA.score },
      teamB: { id: match.teamB.id, name: match.teamB.name, score: match.teamB.score },
      winnerId: match.winnerId,
      group_id: match.group_id,
      teams: match.teams,
      series_format: match.series_format
    }));
    
    return NextResponse.json({ 
      totalMatches: allMatches.length,
      completedMatches: completedMatches.length,
      matchDetails
    });
  } catch (error) {
    console.error('Error getting match details:', error);
    return NextResponse.json({ 
      success: false, 
      error: (error as Error).message 
    }, { status: 500 });
  }
}
