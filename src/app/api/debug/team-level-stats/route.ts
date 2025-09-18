// @ts-nocheck
// Debug API to get stats directly from team documents
import { NextResponse } from 'next/server';
import { getAdminDb, ensureAdminInitialized } from '../../../../../server/lib/admin';

export async function GET() {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();

    // Get all teams
    const teamsSnapshot = await db.collection('teams').get();
    const teams = teamsSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

    // Check if there's a separate stats collection
    const statsSnapshot = await db.collection('stats').get();
    const hasStatsCollection = !statsSnapshot.empty;

    // Check tournament_stats collection
    const tournamentStatsSnapshot = await db.collection('tournament_stats').get();
    const tournamentStatsDocs = tournamentStatsSnapshot.docs.map(doc => ({
      id: doc.id,
      hasTeamStats: !!doc.data().teamStats,
      docSize: Object.keys(doc.data()).length
    }));

    return NextResponse.json({
      totalTeams: teams.length,
      teamNames: teams.map(t => t.name),
      hasStatsCollection,
      tournamentStatsDocs,
      sampleTeamData: teams.slice(0, 3).map(team => ({
        id: team.id,
        name: team.name,
        keys: Object.keys(team).filter(key => 
          key.includes('assist') || key.includes('kill') || key.includes('Assist') || key.includes('Kill')
        )
      }))
    });
    
  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}