// Debug API to check if comprehensive stats are being saved with new fields
import { NextResponse } from 'next/server';
import { getAdminDb, ensureAdminInitialized } from '../../../../../server/lib/admin';

export async function GET() {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();

    // Check if comprehensive stats document exists
    const comprehensiveStatsDoc = await db.collection('tournament_stats').doc('comprehensive_stats').get();
    
    if (!comprehensiveStatsDoc.exists) {
      return NextResponse.json({ 
        error: 'Comprehensive stats document not found',
        suggestion: 'Stats may not have been calculated yet'
      });
    }

    const data = comprehensiveStatsDoc.data();
    
    // Check team stats structure
    const teamStatsKeys = data?.teamStats ? Object.keys(data.teamStats) : [];
    const sampleTeam = teamStatsKeys.length > 0 ? data.teamStats[teamStatsKeys[0]] : null;
    
    // Look for our new fields
    const hasFewestAssistsPerKill = sampleTeam?.fewestAssistsPerKill !== undefined;
    const hasMostAssistsPerKill = sampleTeam?.mostAssistsPerKill !== undefined;
    const hasFewestKillsPerWin = sampleTeam?.fewestKillsPerWin !== undefined;
    
    // Get some sample values
    const teamSamples = teamStatsKeys.slice(0, 5).map(teamId => ({
      teamId,
      teamName: data.teamStats[teamId]?.teamName || 'Unknown',
      hasFewestAssistsPerKill: data.teamStats[teamId]?.fewestAssistsPerKill !== undefined,
      fewestAssistsPerKill: data.teamStats[teamId]?.fewestAssistsPerKill?.value || 'N/A',
      hasMostAssistsPerKill: data.teamStats[teamId]?.mostAssistsPerKill !== undefined,
      mostAssistsPerKill: data.teamStats[teamId]?.mostAssistsPerKill?.value || 'N/A',
      hasFewestKillsPerWin: data.teamStats[teamId]?.fewestKillsPerWin !== undefined,
      fewestKillsPerWin: data.teamStats[teamId]?.fewestKillsPerWin?.value || 'N/A',
      // Check old field
      hasAverageAssists: data.teamStats[teamId]?.averageAssists !== undefined,
      averageAssists: data.teamStats[teamId]?.averageAssists?.value || 'N/A'
    }));

    // Check what team has the lowest fewestAssistsPerKill value
    let lowestAssistsPerKill = { teamId: '', teamName: '', value: 999 };
    
    for (const [teamId, teamData] of Object.entries(data.teamStats || {})) {
      const team = teamData as any;
      if (team.fewestAssistsPerKill?.value < lowestAssistsPerKill.value) {
        lowestAssistsPerKill = {
          teamId,
          teamName: team.teamName || 'Unknown',
          value: team.fewestAssistsPerKill.value
        };
      }
    }

    return NextResponse.json({
      documentExists: true,
      lastUpdated: data?.lastUpdated || 'Unknown',
      totalTeamsInStats: teamStatsKeys.length,
      newFieldsDetected: {
        fewestAssistsPerKill: hasFewestAssistsPerKill,
        mostAssistsPerKill: hasMostAssistsPerKill,
        fewestKillsPerWin: hasFewestKillsPerWin
      },
      lowestAssistsPerKillTeam: lowestAssistsPerKill,
      sampleTeams: teamSamples,
      sampleTeamKeys: sampleTeam ? Object.keys(sampleTeam).filter(key => 
        key.includes('assist') || key.includes('kill') || key.includes('Assist') || key.includes('Kill')
      ) : []
    });
    
  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}