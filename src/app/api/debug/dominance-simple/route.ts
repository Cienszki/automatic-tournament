// @ts-nocheck
// Simple dominance debug endpoint
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, ensureAdminInitialized } from '../../../../server/lib/admin';

export async function GET(request: NextRequest) {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();
    
    // Get team stats to see current calculated values
    const teamStatsSnapshot = await db.collection('teamStats').get();
    const teamStats = teamStatsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    const dominanceValues = teamStats.map(team => ({
      teamName: team.teamName,
      teamId: team.teamId,
      mostDominantVictory: team.mostDominantVictory || { value: 0 }
    }));
    
    // Quick check of one team's raw data
    const firstTeam = teamStats[0];
    if (!firstTeam) {
      return NextResponse.json({ error: 'No team stats found' });
    }
    
    // Get one completed match to analyze structure
    const matchesSnapshot = await db.collection('matches').where('status', '==', 'completed').limit(1).get();
    if (matchesSnapshot.empty) {
      return NextResponse.json({ error: 'No completed matches found' });
    }
    
    const match = { id: matchesSnapshot.docs[0].id, ...matchesSnapshot.docs[0].data() };
    
    // Get games from this match
    const gamesSnapshot = await db.collection('matches').doc(match.id).collection('games').limit(1).get();
    if (gamesSnapshot.empty) {
      return NextResponse.json({ error: 'No games found in match' });
    }
    
    const game = { id: gamesSnapshot.docs[0].id, ...gamesSnapshot.docs[0].data() };
    
    // Get performances from this game
    const perfSnapshot = await db.collection('matches')
      .doc(match.id)
      .collection('games')
      .doc(game.id.toString())
      .collection('performances')
      .get();
    
    const performances = perfSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    const result = {
      teamStatsCount: teamStats.length,
      dominanceValues,
      sampleMatch: {
        id: match.id,
        status: match.status,
        teamA: match.teamA?.name,
        teamB: match.teamB?.name
      },
      sampleGame: {
        id: game.id,
        radiant_team: game.radiant_team,
        dire_team: game.dire_team,
        radiant_win: game.radiant_win,
        duration: game.duration
      },
      samplePerformances: {
        count: performances.length,
        sample: performances[0] ? {
          teamId: performances[0].teamId,
          team_id: performances[0].team_id,
          netWorth: performances[0].netWorth,
          net_worth: performances[0].net_worth,
          keys: Object.keys(performances[0])
        } : null,
        teamIdDistribution: performances.reduce((acc: any, perf: any) => {
          const tid = perf.teamId || perf.team_id || 'unknown';
          acc[tid] = (acc[tid] || 0) + 1;
          return acc;
        }, {})
      }
    };
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Error in simple dominance debug:', error);
    return NextResponse.json({ error: error.message || 'Failed to analyze data' }, { status: 500 });
  }
}