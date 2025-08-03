// src/app/api/debug/match-games/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const { getAllMatches } = await import('@/lib/firestore');
    const matches = await getAllMatches();
    
    // Get matches that have games
    const matchesWithGames = matches.filter(match => match.game_ids && match.game_ids.length > 0);
    
    const matchGameData = matchesWithGames.map(match => ({
      id: match.id,
      teamA: match.teamA.name,
      teamB: match.teamB.name,
      game_ids: match.game_ids,
      gameCount: match.game_ids?.length || 0
    }));
    
    return NextResponse.json({ 
      totalMatches: matches.length,
      matchesWithGames: matchesWithGames.length,
      matches: matchGameData 
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to fetch match games' }, { status: 500 });
  }
}
