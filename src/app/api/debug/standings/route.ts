import { NextResponse } from 'next/server';
import { getAllGroupsAdmin } from '../../../../server/lib/getAllAdmin';
import { getAllMatchesAdmin } from '../../../../server/lib/getAllMatchesAdmin';

export async function GET() {
  try {
    const [groups, matches] = await Promise.all([
      getAllGroupsAdmin(),
      getAllMatchesAdmin()
    ]);

    const completedMatches = matches.filter(m => m.status === 'completed');
    
    return NextResponse.json({
      success: true,
      data: {
        groups: groups.map(g => ({
          id: g.id,
          name: g.name,
          standings: g.standings
        })),
        completedMatches: completedMatches.map(m => ({
          id: m.id,
          teamA: m.teamA,
          teamB: m.teamB,
          status: m.status,
          group_id: m.group_id,
          winnerId: m.winnerId
        })),
        totalMatches: matches.length,
        totalCompletedMatches: completedMatches.length
      }
    });
  } catch (error) {
    console.error('Error fetching debug data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch debug data' },
      { status: 500 }
    );
  }
}
