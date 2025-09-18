// @ts-nocheck
// Debug API that calculates assists per kill using the same logic as comprehensive stats
import { NextResponse } from 'next/server';
import { getAdminDb, ensureAdminInitialized } from '../../../../../server/lib/admin';

function calculateOverallAssistsPerKill(teamPerformances: any[]): number {
  if (teamPerformances.length === 0) return 0;
  
  // Sum ALL assists and ALL kills across ALL games
  let totalAssists = 0;
  let totalKills = 0;
  
  teamPerformances.forEach(perf => {
    totalAssists += (perf.assists || 0);
    totalKills += (perf.kills || 0);
  });

  // Calculate overall ratio: total assists / total kills
  if (totalKills === 0) return 0;
  
  const ratio = totalAssists / totalKills;
  return Math.round(ratio * 100) / 100; // Round to 2 decimal places
}

export async function GET() {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();

    // Get all teams
    const teamsSnapshot = await db.collection('teams').get();
    const teams = teamsSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

    // Get all games with team assignments
    let allGames: any[] = [];
    const matchesSnapshot = await db.collection('matches').get();
    const matches = matchesSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    
    for (const match of matches) {
      const gamesSnapshot = await db.collection('matches').doc(match.id).collection('games').get();
      
      for (const gameDoc of gamesSnapshot.docs) {
        const gameData = { id: gameDoc.id, matchId: match.id, ...gameDoc.data() };
        allGames.push(gameData);
      }
    }

    // Get all performances
    let allPerformances: any[] = [];
    for (const match of matches) {
      const gamesSnapshot = await db.collection('matches').doc(match.id).collection('games').get();
      
      for (const gameDoc of gamesSnapshot.docs) {
        const performancesSnapshot = await db.collection('matches')
          .doc(match.id)
          .collection('games')
          .doc(gameDoc.id)
          .collection('performances')
          .get();
          
        const performances = performancesSnapshot.docs.map((doc: any) => ({
          id: doc.id,
          gameId: gameDoc.id,
          matchId: match.id,
          ...doc.data()
        }));
        allPerformances.push(...performances);
      }
    }

    // Calculate assists per kill for each team using the same logic as comprehensive stats
    const teamAssistsPerKill: any[] = [];
    
    for (const team of teams) {
      // Find games where this team participated (using the same logic as comprehensive stats)
      const teamGames = allGames.filter(game => 
        game.radiant_team?.id == team.id || game.dire_team?.id == team.id
      );

      // Get performances for this team
      const teamPerformances = allPerformances.filter(perf => perf.teamId === team.id);

      // Calculate overall assists per kill ratio (total assists / total kills)
      const overallAssistsPerKill = calculateOverallAssistsPerKill(teamPerformances);
      
      // Also calculate total assists and kills for transparency
      let totalAssists = 0;
      let totalKills = 0;
      teamPerformances.forEach(perf => {
        totalAssists += (perf.assists || 0);
        totalKills += (perf.kills || 0);
      });

      teamAssistsPerKill.push({
        teamName: team.name,
        gamesPlayed: teamGames.length,
        performancesFound: teamPerformances.length,
        totalAssists,
        totalKills,
        assistsPerKill: overallAssistsPerKill
      });
    }

    // Sort by assists per kill (ascending - lowest teamwork first)
    teamAssistsPerKill.sort((a, b) => {
      if (a.assistsPerKill === 0 && b.assistsPerKill === 0) return 0;
      if (a.assistsPerKill === 0) return 1;
      if (b.assistsPerKill === 0) return -1;
      return a.assistsPerKill - b.assistsPerKill;
    });

    return NextResponse.json({
      totalTeams: teams.length,
      totalGames: allGames.length,
      totalPerformances: allPerformances.length,
      teamAssistsPerKillTable: teamAssistsPerKill
    });
    
  } catch (error) {
    console.error('Calculation error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}