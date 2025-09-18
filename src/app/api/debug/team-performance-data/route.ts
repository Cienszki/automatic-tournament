// Debug API to check team performance data structure
import { NextResponse } from 'next/server';
import { getAdminDb, ensureAdminInitialized } from '../../../../../server/lib/admin';

export async function GET() {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();

    // Fetch teams
    const teamsSnapshot = await db.collection('teams').get();
    const teams = teamsSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    
    // Fetch a sample of performances
    let allPerformances: any[] = [];
    let sampleCount = 0;
    
    const matchesSnapshot = await db.collection('matches').limit(3).get();
    const matches = matchesSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    
    for (const match of matches) {
      const gamesSnapshot = await db.collection('matches').doc(match.id).collection('games').get();
      
      for (const gameDoc of gamesSnapshot.docs) {
        const performancesSnapshot = await db.collection('matches')
          .doc(match.id)
          .collection('games')
          .doc(gameDoc.id)
          .collection('performances')
          .get();
          
        const performances = performancesSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
        allPerformances.push(...performances);
        sampleCount++;
        if (sampleCount >= 2) break;
      }
      if (sampleCount >= 2) break;
    }
    
    const result = {
      teamsCount: teams.length,
      teams: teams.map(t => ({ id: t.id, name: t.name })),
      performancesCount: allPerformances.length,
      samplePerformance: allPerformances.length > 0 ? {
        keys: Object.keys(allPerformances[0]),
        teamFields: {
          teamId: allPerformances[0].teamId,
          team_id: allPerformances[0].team_id,
          playerId: allPerformances[0].playerId,
          account_id: allPerformances[0].account_id
        }
      } : null,
      teamMatches: teams.map(team => ({
        teamName: team.name,
        teamId: team.id,
        matchingPerformances: allPerformances.filter(perf => 
          perf.teamId === team.id || perf.team_id === team.id
        ).length
      }))
    };
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}