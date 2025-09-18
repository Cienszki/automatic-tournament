// @ts-nocheck
// src/app/api/debug/teams/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const { getAllTeams } = await import('@/lib/firestore');
    const teams = await getAllTeams();
    
    const teamNames = teams.map(team => ({
      id: team.id,
      name: team.name,
      tag: team.tag
    }));
    
    return NextResponse.json({ teams: teamNames });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to fetch teams' }, { status: 500 });
  }
}
