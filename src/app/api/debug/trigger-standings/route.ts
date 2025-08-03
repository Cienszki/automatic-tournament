import { NextResponse } from 'next/server';

export async function POST() {
  try {
    // Import dynamically to avoid server action issues
    const { updateStandingsAfterGameAdmin } = await import('@/lib/group-actions-admin');
    
    // Manual match data for the completed match that should update standings
    const matchData = {
      id: "P5B0D7exIWyO0wDP9ml2",
      teamA: {
        name: "Herbatka u Bratka",
        id: "rVNxI6Uxf4UEH3H1tsAU",
        score: 1
      },
      teamB: {
        name: "Budzik Team",
        id: "RohssvN56tR0WoGmu7c0", 
        score: 2
      },
      teams: ["rVNxI6Uxf4UEH3H1tsAU", "RohssvN56tR0WoGmu7c0"],
      status: "completed",
      group_id: "grupa-a",
      winnerId: "RohssvN56tR0WoGmu7c0"
    };

    console.log('Triggering standings update for match:', matchData.id);
    const result = await updateStandingsAfterGameAdmin(matchData as any);
    console.log('Standings update result:', result);
    
    return NextResponse.json({
      success: result.success,
      message: result.message
    });
  } catch (error) {
    console.error('Error triggering standings update:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update standings' },
      { status: 500 }
    );
  }
}
