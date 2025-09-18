// @ts-nocheck
// Debug API to check team game data structure
import { NextResponse } from 'next/server';
import { getAdminDb, ensureAdminInitialized } from '../../../../../server/lib/admin';

export async function GET() {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();

    // Fetch sample games data
    let allGames: any[] = [];
    
    const matchesSnapshot = await db.collection('matches').limit(3).get();
    const matches = matchesSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    
    for (const match of matches) {
      const gamesSnapshot = await db.collection('matches').doc(match.id).collection('games').get();
      
      for (const gameDoc of gamesSnapshot.docs) {
        const gameData = { id: gameDoc.id, ...gameDoc.data() };
        allGames.push(gameData);
        if (allGames.length >= 5) break; // Just get a few samples
      }
      if (allGames.length >= 5) break;
    }
    
    // Get a couple of teams for comparison
    const teamsSnapshot = await db.collection('teams').limit(5).get();
    const teams = teamsSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    
    const result = {
      gamesCount: allGames.length,
      teamsCount: teams.length,
      sampleGames: allGames.map(game => ({
        id: game.id,
        duration: game.duration,
        radiant_win: game.radiant_win,
        radiant_team: game.radiant_team,
        dire_team: game.dire_team,
        matchId: game.matchId,
        firstBloodTime: game.firstBloodTime,
        keys: Object.keys(game)
      })),
      sampleTeams: teams.map(team => ({
        id: team.id,
        name: team.name
      }))
    };
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}