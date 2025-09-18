// Debug endpoint to analyze dominance calculation data
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, ensureAdminInitialized } from '../../../../server/lib/admin';

export async function GET(request: NextRequest) {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();
    
    console.log('🔍 Debugging Most Dominant Victory calculation...');
    
    // Get all collections
    const [matchesSnapshot, teamsSnapshot] = await Promise.all([
      db.collection('matches').get(),
      db.collection('teams').get()
    ]);
    
    const matches = matchesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
    const teams = teamsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    console.log(`Found ${matches.length} matches, ${teams.length} teams`);
    
    // Get all games and performances from matches
    const allGames: any[] = [];
    const allPerformances: any[] = [];
    
    for (const match of matches) {
      if (match.status !== 'completed') continue;
      
      const gamesSnapshot = await db.collection('matches').doc(match.id).collection('games').get();
      const games = gamesSnapshot.docs.map(doc => ({ 
        id: doc.id, 
        matchId: match.id,
        ...doc.data() 
      }));
      
      for (const game of games) {
        allGames.push(game);
        
        const gameIdStr = game.id.toString();
        const performancesSnapshot = await db.collection('matches')
          .doc(match.id)
          .collection('games')
          .doc(gameIdStr)
          .collection('performances')
          .get();
        
        const performances = performancesSnapshot.docs.map(doc => ({
          id: doc.id,
          gameId: gameIdStr,
          matchId: match.id,
          ...doc.data()
        }));
        
        allPerformances.push(...performances);
      }
    }
    
    console.log(`Total games: ${allGames.length}, Total performances: ${allPerformances.length}`);
    
    // Analyze first team's data
    const firstTeam = teams[0];
    if (!firstTeam) {
      return NextResponse.json({ error: 'No teams found' });
    }
    
    console.log(`Analyzing team: ${firstTeam.name} (ID: ${firstTeam.id})`);
    
    // Find team's games
    const teamGames = allGames.filter(game => 
      game.radiant_team?.id == firstTeam.id || game.dire_team?.id == firstTeam.id
    );
    
    // Find team's performances
    const teamPerformances = allPerformances.filter(perf => 
      perf.teamId === firstTeam.id || perf.team_id === firstTeam.id
    );
    
    console.log(`Team games: ${teamGames.length}, Team performances: ${teamPerformances.length}`);
    
    // Find wins
    const wins = teamGames.filter(game => {
      const teamIsRadiant = game.radiant_team?.id == firstTeam.id;
      const teamIsDire = game.dire_team?.id == firstTeam.id;
      const radiantWon = game.radiant_win === true;
      return (teamIsRadiant && radiantWon) || (teamIsDire && !radiantWon);
    });
    
    console.log(`Team wins: ${wins.length}`);
    
    const debugData = {
      teamName: firstTeam.name,
      teamId: firstTeam.id,
      totalGames: teamGames.length,
      totalPerformances: teamPerformances.length,
      wins: wins.length,
      sampleGame: teamGames[0] ? {
        id: teamGames[0].id,
        radiant_team: teamGames[0].radiant_team,
        dire_team: teamGames[0].dire_team,
        radiant_win: teamGames[0].radiant_win,
        keys: Object.keys(teamGames[0])
      } : null,
      samplePerformance: teamPerformances[0] ? {
        keys: Object.keys(teamPerformances[0]),
        teamId: teamPerformances[0].teamId,
        team_id: teamPerformances[0].team_id,
        netWorth: teamPerformances[0].netWorth,
        net_worth: teamPerformances[0].net_worth,
        gameId: teamPerformances[0].gameId,
        game_id: teamPerformances[0].game_id
      } : null
    };
    
    // Try to calculate dominance for first win
    if (wins.length > 0) {
      const firstWin = wins[0];
      console.log(`Analyzing first win: game ${firstWin.id}`);
      
      // Get all performances for this game
      const gamePerformances = allPerformances.filter(perf => {
        return (
          (perf.gameId && perf.gameId === firstWin.id) ||
          (perf.game_id && perf.game_id === firstWin.id) ||
          (perf.matchId && perf.matchId === firstWin.matchId)
        );
      });
      
      console.log(`Performances in this game: ${gamePerformances.length}`);
      
      const ourTeamPerfs = gamePerformances.filter(perf => {
        const perfTeamId = perf.teamId || perf.team_id || perf.team;
        return perfTeamId === firstTeam.id || String(perfTeamId) === String(firstTeam.id);
      });
      
      const enemyTeamPerfs = gamePerformances.filter(perf => {
        const perfTeamId = perf.teamId || perf.team_id || perf.team;
        return perfTeamId !== firstTeam.id && String(perfTeamId) !== String(firstTeam.id);
      });
      
      const ourNetWorth = ourTeamPerfs.reduce((sum, perf) => sum + (perf.net_worth || perf.netWorth || 0), 0);
      const enemyNetWorth = enemyTeamPerfs.reduce((sum, perf) => sum + (perf.net_worth || perf.netWorth || 0), 0);
      
      debugData.firstWinAnalysis = {
        gameId: firstWin.id,
        matchId: firstWin.matchId,
        totalGamePerformances: gamePerformances.length,
        ourTeamPerfs: ourTeamPerfs.length,
        enemyTeamPerfs: enemyTeamPerfs.length,
        ourNetWorth,
        enemyNetWorth,
        dominance: (ourNetWorth + enemyNetWorth) > 0 ? ((ourNetWorth - enemyNetWorth) / (ourNetWorth + enemyNetWorth)) * 100 : 0,
        ourTeamSample: ourTeamPerfs[0] ? {
          teamId: ourTeamPerfs[0].teamId,
          team_id: ourTeamPerfs[0].team_id,
          netWorth: ourTeamPerfs[0].netWorth,
          net_worth: ourTeamPerfs[0].net_worth
        } : null,
        enemyTeamSample: enemyTeamPerfs[0] ? {
          teamId: enemyTeamPerfs[0].teamId,
          team_id: enemyTeamPerfs[0].team_id,
          netWorth: enemyTeamPerfs[0].netWorth,
          net_worth: enemyTeamPerfs[0].net_worth
        } : null
      };
    }
    
    return NextResponse.json(debugData);
    
  } catch (error) {
    console.error('Error in dominance analysis:', error);
    return NextResponse.json({ error: 'Failed to analyze dominance data' }, { status: 500 });
  }
}