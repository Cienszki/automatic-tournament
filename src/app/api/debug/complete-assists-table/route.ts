// Debug API to provide complete assists per kill table for ALL teams
import { NextResponse } from 'next/server';
import { getAdminDb, ensureAdminInitialized } from '../../../../../server/lib/admin';

export async function GET() {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();

    // Try multiple locations where stats might be stored
    let teamStatsData: any = {};
    
    // Check comprehensive stats document
    try {
      const comprehensiveStatsDoc = await db.collection('tournament_stats').doc('comprehensive_stats').get();
      if (comprehensiveStatsDoc.exists) {
        const data = comprehensiveStatsDoc.data();
        teamStatsData = data?.teamStats || {};
      }
    } catch (e) {
      console.log('Comprehensive stats not found, trying other locations...');
    }
    
    // If comprehensive stats not found, check for other documents
    if (Object.keys(teamStatsData).length === 0) {
      // Check all documents in tournament_stats collection
      const tournamentStatsSnapshot = await db.collection('tournament_stats').get();
      
      for (const doc of tournamentStatsSnapshot.docs) {
        const data = doc.data();
        if (data.teamStats && Object.keys(data.teamStats).length > 0) {
          teamStatsData = data.teamStats;
          break;
        }
      }
    }
    
    // If still no data, check individual team documents
    if (Object.keys(teamStatsData).length === 0) {
      const teamsSnapshot = await db.collection('teams').get();
      const teams = teamsSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      
      return NextResponse.json({
        error: 'No comprehensive stats found',
        availableTeams: teams.length,
        suggestion: 'Run comprehensive stats calculation first',
        teamSample: teams.slice(0, 3).map(t => ({
          name: t.name,
          hasBasicStats: !!(t.averageKillsPerGame || t.averageAssistsPerGame)
        }))
      });
    }

    // Extract complete table data
    const completeTable = Object.entries(teamStatsData).map(([teamId, teamData]: [string, any]) => ({
      teamName: teamData.teamName || 'Unknown',
      mostAssistsPerKill: teamData.mostAssistsPerKill?.value || 'N/A',
      fewestAssistsPerKill: teamData.fewestAssistsPerKill?.value || 'N/A',
      averageKills: teamData.averageKills?.value || 'N/A',
      fewestKillsPerWin: teamData.fewestKillsPerWin?.value || 'N/A'
    }))
    .sort((a, b) => {
      // Sort by team name alphabetically
      return a.teamName.localeCompare(b.teamName);
    });

    return NextResponse.json({
      totalTeams: completeTable.length,
      table: completeTable,
      // Also provide sorted by assists per kill
      sortedByFewestAssists: [...completeTable].sort((a, b) => {
        const aVal = typeof a.fewestAssistsPerKill === 'number' ? a.fewestAssistsPerKill : 999;
        const bVal = typeof b.fewestAssistsPerKill === 'number' ? b.fewestAssistsPerKill : 999;
        return aVal - bVal;
      }),
      sortedByMostAssists: [...completeTable].sort((a, b) => {
        const aVal = typeof a.mostAssistsPerKill === 'number' ? a.mostAssistsPerKill : 0;
        const bVal = typeof b.mostAssistsPerKill === 'number' ? b.mostAssistsPerKill : 0;
        return bVal - aVal;
      })
    });
    
  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}