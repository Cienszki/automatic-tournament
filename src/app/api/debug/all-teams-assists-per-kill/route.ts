// @ts-nocheck
// Debug API to show assists per kill values for ALL teams
import { NextResponse } from 'next/server';
import { getAdminDb, ensureAdminInitialized } from '../../../../../server/lib/admin';

export async function GET() {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();

    // Get the comprehensive stats document
    const comprehensiveStatsDoc = await db.collection('tournament_stats').doc('comprehensive_stats').get();
    
    if (!comprehensiveStatsDoc.exists) {
      return NextResponse.json({ 
        error: 'Comprehensive stats document not found',
        suggestion: 'Run stats recalculation first'
      });
    }

    const data = comprehensiveStatsDoc.data();
    const teamStats = data?.teamStats || {};

    // Extract assists per kill data for all teams
    const allTeamsData = Object.entries(teamStats).map(([teamId, teamData]: [string, any]) => ({
      teamId,
      teamName: teamData.teamName || 'Unknown',
      mostAssistsPerKill: teamData.mostAssistsPerKill?.value || 'N/A',
      fewestAssistsPerKill: teamData.fewestAssistsPerKill?.value || 'N/A',
      // Include some context data
      averageKills: teamData.averageKills?.value || 'N/A',
      fewestKillsPerWin: teamData.fewestKillsPerWin?.value || 'N/A'
    }))
    .sort((a, b) => {
      // Sort by fewest assists per kill (lowest first)
      const aVal = typeof a.fewestAssistsPerKill === 'number' ? a.fewestAssistsPerKill : 999;
      const bVal = typeof b.fewestAssistsPerKill === 'number' ? b.fewestAssistsPerKill : 999;
      return aVal - bVal;
    });

    return NextResponse.json({
      totalTeams: allTeamsData.length,
      lastUpdated: data?.lastUpdated || 'Unknown',
      teamsData: allTeamsData
    });
    
  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}