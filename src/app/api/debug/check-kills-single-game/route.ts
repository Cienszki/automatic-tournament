// Debug API to check kills single game calculations
import { NextResponse } from 'next/server';
import { getAdminDb, ensureAdminInitialized } from '../../../../../server/lib/admin';

function findMaxTeamKillsInGame(teamPerformances: any[]): { value: number, matchId: string, gameId: string, breakdown: any } {
  if (teamPerformances.length === 0) return { value: 0, matchId: '', gameId: '', breakdown: {} };
  
  const gameKills = new Map<string, { kills: number, matchId: string, players: any[] }>();
  
  teamPerformances.forEach(perf => {
    const gameId = perf.gameId || perf.game_id || perf.matchId || 'unknown';
    const matchId = perf.matchId || '';
    if (!gameKills.has(gameId)) {
      gameKills.set(gameId, { kills: 0, matchId, players: [] });
    }
    const game = gameKills.get(gameId)!;
    game.kills += (perf.kills || 0);
    game.players.push({
      playerId: perf.playerId || 'unknown',
      kills: perf.kills || 0
    });
  });
  
  if (gameKills.size === 0) return { value: 0, matchId: '', gameId: '', breakdown: {} };
  
  const maxGame = Array.from(gameKills.entries()).reduce((max, [gameId, current]) => 
    current.kills > max[1].kills ? [gameId, current] : max
  );
  
  return { 
    value: maxGame[1].kills,
    matchId: maxGame[1].matchId,
    gameId: maxGame[0],
    breakdown: {
      totalPlayers: maxGame[1].players.length,
      playerKills: maxGame[1].players
    }
  };
}

function findMinTeamKillsInGame(teamPerformances: any[]): { value: number, matchId: string, gameId: string, breakdown: any } {
  if (teamPerformances.length === 0) return { value: 0, matchId: '', gameId: '', breakdown: {} };
  
  const gameKills = new Map<string, { kills: number, matchId: string, players: any[] }>();
  
  teamPerformances.forEach(perf => {
    const gameId = perf.gameId || perf.game_id || perf.matchId || 'unknown';
    const matchId = perf.matchId || '';
    if (!gameKills.has(gameId)) {
      gameKills.set(gameId, { kills: 0, matchId, players: [] });
    }
    const game = gameKills.get(gameId)!;
    game.kills += (perf.kills || 0);
    game.players.push({
      playerId: perf.playerId || 'unknown',
      kills: perf.kills || 0
    });
  });
  
  if (gameKills.size === 0) return { value: 0, matchId: '', gameId: '', breakdown: {} };
  
  const minGame = Array.from(gameKills.entries()).reduce((min, [gameId, current]) => 
    current.kills < min[1].kills ? [gameId, current] : min
  );
  
  return { 
    value: minGame[1].kills,
    matchId: minGame[1].matchId,
    gameId: minGame[0],
    breakdown: {
      totalPlayers: minGame[1].players.length,
      playerKills: minGame[1].players
    }
  };
}

export async function GET() {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();

    // Get all teams
    const teamsSnapshot = await db.collection('teams').get();
    const teams = teamsSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

    // Get all games and performances
    let allGames: any[] = [];
    let allPerformances: any[] = [];
    const matchesSnapshot = await db.collection('matches').get();
    
    for (const matchDoc of matchesSnapshot.docs) {
      const match = { id: matchDoc.id, ...matchDoc.data() };
      const gamesSnapshot = await db.collection('matches').doc(match.id).collection('games').get();
      
      for (const gameDoc of gamesSnapshot.docs) {
        const gameData = { id: gameDoc.id, matchId: match.id, ...gameDoc.data() };
        allGames.push(gameData);
        
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

    // Check kills per game for each team
    const teamKillsAnalysis = [];
    
    for (const team of teams) {
      const teamPerformances = allPerformances.filter(perf => perf.teamId === team.id);
      
      if (teamPerformances.length === 0) continue;
      
      const maxKills = findMaxTeamKillsInGame(teamPerformances);
      const minKills = findMinTeamKillsInGame(teamPerformances);
      
      teamKillsAnalysis.push({
        teamName: team.name,
        maxKills: maxKills.value,
        maxKillsGameId: maxKills.gameId,
        maxKillsBreakdown: maxKills.breakdown,
        minKills: minKills.value,
        minKillsGameId: minKills.gameId,
        minKillsBreakdown: minKills.breakdown,
        totalGames: new Set(teamPerformances.map(p => p.gameId)).size
      });
    }

    // Sort by max kills descending
    teamKillsAnalysis.sort((a, b) => b.maxKills - a.maxKills);

    return NextResponse.json({
      totalTeams: teams.length,
      totalGames: allGames.length,
      totalPerformances: allPerformances.length,
      teamKillsAnalysis: teamKillsAnalysis.slice(0, 10), // Top 10 for readability
      highestSingleGameKills: teamKillsAnalysis[0],
      lowestSingleGameKills: teamKillsAnalysis.reduce((min, team) => 
        team.minKills < min.minKills ? team : min
      )
    });
    
  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}