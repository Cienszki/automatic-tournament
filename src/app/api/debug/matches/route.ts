// src/app/api/debug/matches/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const { getAllMatches } = await import('@/lib/firestore');
    const matches = await getAllMatches();
    
    const matchData = matches.map(match => ({
      id: match.id,
      teamA: match.teamA,
      teamB: match.teamB,
      teams: match.teams,
      game_ids: match.game_ids || [],
      status: match.status,
      group_id: match.group_id,
      schedulingStatus: match.schedulingStatus
    }));
    
    return NextResponse.json({ matches: matchData });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to fetch matches' }, { status: 500 });
  }
}
