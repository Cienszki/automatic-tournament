// Debug API to test assists per kill calculation for all teams
import { NextResponse } from 'next/server';
import { getAdminDb, ensureAdminInitialized } from '../../../../../server/lib/admin';

export async function GET() {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();

    // Get all teams
    const teamsSnapshot = await db.collection('teams').get();
    const teams = teamsSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

    // Get all games with team assignments
    let allGames: any[] = [];
    const matchesSnapshot = await db.collection('matches').limit(5).get();
    const matches = matchesSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    
    for (const match of matches) {
      const gamesSnapshot = await db.collection('matches').doc(match.id).collection('games').get();
      
      for (const gameDoc of gamesSnapshot.docs) {
        const gameData = { id: gameDoc.id, ...gameDoc.data() };
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

    // Calculate assists per kill for each team
    const teamStats: any[] = [];
    
    for (const team of teams) {
      // Find games where this team participated
      const teamGames = allGames.filter(game => 
        game.radiant_team?.id == team.id || game.dire_team?.id == team.id
      );

      // Get performances for this team
      const teamPerformances = allPerformances.filter(perf => perf.teamId === team.id);

      // Calculate assists per kill for each game
      const gameStats = new Map<string, { assists: number, kills: number, matchId: string }>();
      
      teamPerformances.forEach(perf => {
        const gameId = perf.gameId || perf.game_id || perf.matchId || 'unknown';
        const matchId = perf.matchId || '';
        if (!gameStats.has(gameId)) {
          gameStats.set(gameId, { assists: 0, kills: 0, matchId });
        }
        const stats = gameStats.get(gameId)!;
        stats.assists += (perf.assists || 0);
        stats.kills += (perf.kills || 0);
      });

      // Calculate ratios for games with kills
      const gameRatios = Array.from(gameStats.values())
        .filter(stats => stats.kills > 0)
        .map(stats => ({
          ratio: stats.assists / stats.kills,
          matchId: stats.matchId,
          assists: stats.assists,
          kills: stats.kills
        }));

      const mostAssistsPerKill = gameRatios.length > 0 ? 
        gameRatios.reduce((max, current) => current.ratio > max.ratio ? current : max) : null;
        
      const fewestAssistsPerKill = gameRatios.length > 0 ? 
        gameRatios.reduce((min, current) => current.ratio < min.ratio ? current : min) : null;

      teamStats.push({
        teamId: team.id,
        teamName: team.name,
        gamesPlayed: teamGames.length,
        gamesWithKills: gameRatios.length,
        performancesFound: teamPerformances.length,
        mostAssistsPerKill: mostAssistsPerKill ? {
          ratio: Math.round(mostAssistsPerKill.ratio * 100) / 100,
          assists: mostAssistsPerKill.assists,
          kills: mostAssistsPerKill.kills,
          matchId: mostAssistsPerKill.matchId
        } : null,
        fewestAssistsPerKill: fewestAssistsPerKill ? {
          ratio: Math.round(fewestAssistsPerKill.ratio * 100) / 100,
          assists: fewestAssistsPerKill.assists,
          kills: fewestAssistsPerKill.kills,
          matchId: fewestAssistsPerKill.matchId
        } : null,
        allGameRatios: gameRatios.map(r => ({
          ratio: Math.round(r.ratio * 100) / 100,
          assists: r.assists,
          kills: r.kills
        }))
      });
    }

    return NextResponse.json({
      totalTeams: teams.length,
      totalGames: allGames.length,
      totalPerformances: allPerformances.length,
      teamStats: teamStats.sort((a, b) => b.gamesWithKills - a.gamesWithKills)
    });
    
  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}