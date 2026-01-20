// src/app/api/admin/mock-data/add-game/route.ts
// API endpoint for adding mock game with auto-generated performances

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth, ensureAdminInitialized } from '../../../../../../server/lib/admin';
import { headers } from 'next/headers';

// Helper to generate realistic stats based on role and game outcome
function generatePlayerPerformance(role: string, isWinner: boolean, duration: number) {
  const durationMinutes = duration / 60;
  
  // Base stats by role
  const baseStats: Record<string, any> = {
    'Carry': {
      kills: isWinner ? [8, 15] : [3, 8],
      deaths: isWinner ? [2, 6] : [5, 10],
      assists: [5, 12],
      gpm: [550, 700],
      xpm: [600, 750],
      lastHits: [300, 450],
      denies: [10, 30],
      heroDamage: [25000, 45000],
      towerDamage: [3000, 8000],
      healing: [0, 500],
    },
    'Mid': {
      kills: isWinner ? [7, 14] : [4, 9],
      deaths: isWinner ? [2, 5] : [4, 9],
      assists: [6, 14],
      gpm: [500, 650],
      xpm: [550, 700],
      lastHits: [250, 400],
      denies: [15, 40],
      heroDamage: [22000, 40000],
      towerDamage: [2000, 6000],
      healing: [0, 1000],
    },
    'Offlane': {
      kills: isWinner ? [5, 10] : [2, 6],
      deaths: isWinner ? [3, 7] : [5, 11],
      assists: [10, 18],
      gpm: [400, 550],
      xpm: [500, 650],
      lastHits: [200, 350],
      denies: [5, 20],
      heroDamage: [15000, 30000],
      towerDamage: [1500, 5000],
      healing: [0, 2000],
    },
    'Soft Support': {
      kills: isWinner ? [3, 8] : [1, 5],
      deaths: isWinner ? [4, 8] : [6, 12],
      assists: [12, 22],
      gpm: [300, 450],
      xpm: [350, 500],
      lastHits: [50, 150],
      denies: [2, 10],
      heroDamage: [8000, 18000],
      towerDamage: [500, 2000],
      healing: [1000, 5000],
    },
    'Hard Support': {
      kills: isWinner ? [2, 6] : [1, 4],
      deaths: isWinner ? [5, 10] : [7, 15],
      assists: [15, 25],
      gpm: [250, 380],
      xpm: [300, 450],
      lastHits: [20, 80],
      denies: [1, 8],
      heroDamage: [5000, 15000],
      towerDamage: [200, 1500],
      healing: [2000, 8000],
    },
  };

  const stats = baseStats[role] || baseStats['Soft Support'];
  
  // Generate random values within ranges
  const randomInRange = (range: number[]) => 
    Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0];

  const kills = randomInRange(stats.kills);
  const deaths = randomInRange(stats.deaths);
  const assists = randomInRange(stats.assists);
  
  return {
    kills,
    deaths,
    assists,
    gpm: randomInRange(stats.gpm),
    xpm: randomInRange(stats.xpm),
    lastHits: randomInRange(stats.lastHits),
    denies: randomInRange(stats.denies),
    heroDamage: randomInRange(stats.heroDamage),
    towerDamage: randomInRange(stats.towerDamage),
    healing: randomInRange(stats.healing),
    // Calculate fantasy points (simplified)
    fantasyPoints: kills * 0.3 + assists * 0.15 - deaths * 0.3 + 
                   (isWinner ? 3 : 0) + 
                   randomInRange([0, 2]),
  };
}

export async function POST(request: NextRequest) {
  try {
    ensureAdminInitialized();
    const headersList = await headers();
    const authHeader = headersList.get('Authorization');

    if (!authHeader) {
      return NextResponse.json({ error: 'No Authorization header' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 });
    }

    // Verify admin status
    const decodedToken = await getAdminAuth().verifyIdToken(token);
    const adminDoc = await getAdminDb().collection('admins').doc(decodedToken.uid).get();
    
    if (!adminDoc.exists) {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
    }

    const data = await request.json();
    const { tournamentId, matchId, radiantWin, duration, generatePerformances } = data;

    // Validate required fields
    if (!tournamentId || !matchId || radiantWin === undefined || !duration) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get match data
    const matchDoc = await getAdminDb()
      .collection('tournaments')
      .doc(tournamentId)
      .collection('matches')
      .doc(matchId)
      .get();

    if (!matchDoc.exists) {
      return NextResponse.json(
        { error: 'Match not found' },
        { status: 404 }
      );
    }

    const match = matchDoc.data();
    const gameNumber = (match?.teamA?.score || 0) + (match?.teamB?.score || 0) + 1;
    const gameId = `${matchId}-game-${gameNumber}`;

    // Create game document
    const gameData = {
      id: gameId,
      matchId,
      gameNumber,
      radiant_team: match?.teamA?.id,
      dire_team: match?.teamB?.id,
      radiant_win: radiantWin,
      duration,
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + duration * 1000).toISOString(),
      matchId_opendota: null,
      isMockData: true,
    };

    await getAdminDb()
      .collection('tournaments')
      .doc(tournamentId)
      .collection('matches')
      .doc(matchId)
      .collection('games')
      .doc(gameId)
      .set(gameData);

    // Generate performances if requested
    let performancesCreated = 0;
    if (generatePerformances) {
      // Get players from both teams
      const teamAPlayers = await getAdminDb()
        .collection('tournaments')
        .doc(tournamentId)
        .collection('teams')
        .doc(match?.teamA?.id)
        .collection('players')
        .get();

      const teamBPlayers = await getAdminDb()
        .collection('tournaments')
        .doc(tournamentId)
        .collection('teams')
        .doc(match?.teamB?.id)
        .collection('players')
        .get();

      // Generate performances for Team A (Radiant)
      for (const playerDoc of teamAPlayers.docs) {
        const player = playerDoc.data();
        const stats = generatePlayerPerformance(player.role, radiantWin, duration);
        
        await getAdminDb()
          .collection('tournaments')
          .doc(tournamentId)
          .collection('matches')
          .doc(matchId)
          .collection('games')
          .doc(gameId)
          .collection('performances')
          .doc(player.id)
          .set({
            playerId: player.id,
            playerName: player.nickname,
            teamId: match?.teamA?.id,
            isRadiant: true,
            heroId: Math.floor(Math.random() * 130) + 1, // Random hero
            ...stats,
            isMockData: true,
          });
        
        performancesCreated++;
      }

      // Generate performances for Team B (Dire)
      for (const playerDoc of teamBPlayers.docs) {
        const player = playerDoc.data();
        const stats = generatePlayerPerformance(player.role, !radiantWin, duration);
        
        await getAdminDb()
          .collection('tournaments')
          .doc(tournamentId)
          .collection('matches')
          .doc(matchId)
          .collection('games')
          .doc(gameId)
          .collection('performances')
          .doc(player.id)
          .set({
            playerId: player.id,
            playerName: player.nickname,
            teamId: match?.teamB?.id,
            isRadiant: false,
            heroId: Math.floor(Math.random() * 130) + 1, // Random hero
            ...stats,
            isMockData: true,
          });
        
        performancesCreated++;
      }
    }

    // Update match score
    const newScore = {
      teamA: {
        ...match?.teamA,
        score: (match?.teamA?.score || 0) + (radiantWin ? 1 : 0),
      },
      teamB: {
        ...match?.teamB,
        score: (match?.teamB?.score || 0) + (radiantWin ? 0 : 1),
      },
    };

    await getAdminDb()
      .collection('tournaments')
      .doc(tournamentId)
      .collection('matches')
      .doc(matchId)
      .update(newScore);

    return NextResponse.json({ 
      success: true, 
      gameId,
      performancesCreated,
      message: `Game added with ${performancesCreated} performances` 
    });
  } catch (error: any) {
    console.error('Error adding game:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to add game' },
      { status: 500 }
    );
  }
}
