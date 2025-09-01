import { NextResponse } from "next/server";
import { getAdminDb, ensureAdminInitialized } from "@/server/lib/admin";

export async function GET() {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();
    
    console.log('🔍 Verifying fantasy recalculation data requirements...');
    
    const verification = {
      matches: { count: 0, withGames: 0, issues: [] as string[] },
      games: { count: 0, withPerformances: 0, issues: [] as string[] },
      performances: { count: 0, withFantasyPoints: 0, issues: [] as string[] },
      fantasyLineups: { count: 0, withRounds: 0, issues: [] as string[] },
      tournamentPlayers: { count: 0, withRoles: 0, issues: [] as string[] },
      rounds: { found: new Set<string>(), mapped: new Map<string, number>() },
      sampleData: {
        matches: [] as any[],
        performances: [] as any[],
        lineups: [] as any[]
      }
    };
    
    // 1. Check matches collection
    console.log('📋 Checking matches...');
    const matchesSnap = await db.collection('matches').limit(100).get();
    verification.matches.count = matchesSnap.size;
    
    for (const matchDoc of matchesSnap.docs) {
      const matchData = matchDoc.data();
      
      // Check round mapping
      let roundId = matchData.group_id || matchData.roundId || matchData.round || 'group_stage';
      if (roundId.startsWith('grupa-')) {
        roundId = 'group_stage';
      }
      verification.rounds.found.add(roundId);
      verification.rounds.mapped.set(roundId, (verification.rounds.mapped.get(roundId) || 0) + 1);
      
      // Sample match data
      if (verification.sampleData.matches.length < 3) {
        verification.sampleData.matches.push({
          matchId: matchDoc.id,
          group_id: matchData.group_id,
          roundId: matchData.roundId,
          round: matchData.round,
          mappedRound: roundId,
          teamA: matchData.teamA?.name,
          teamB: matchData.teamB?.name
        });
      }
      
      // Check if match has games
      const gamesSnap = await db.collection('matches').doc(matchDoc.id).collection('games').limit(1).get();
      if (!gamesSnap.empty) {
        verification.matches.withGames++;
      } else {
        verification.matches.issues.push(`Match ${matchDoc.id} has no games`);
      }
    }
    
    // 2. Check games and performances
    console.log('🎮 Checking games and performances...');
    let totalGames = 0;
    let totalPerformances = 0;
    let performancesWithFantasyPoints = 0;
    
    for (const matchDoc of matchesSnap.docs.slice(0, 20)) { // Sample first 20 matches
      const gamesSnap = await db.collection('matches').doc(matchDoc.id).collection('games').get();
      totalGames += gamesSnap.size;
      
      for (const gameDoc of gamesSnap.docs.slice(0, 3)) { // Sample first 3 games per match
        const gameData = gameDoc.data();
        
        const performancesSnap = await db.collection('matches').doc(matchDoc.id)
          .collection('games').doc(gameDoc.id).collection('performances').get();
        
        totalPerformances += performancesSnap.size;
        
        performancesSnap.docs.forEach(perfDoc => {
          const perfData = perfDoc.data();
          
          if (perfData.fantasyPoints !== undefined && perfData.fantasyPoints !== null) {
            performancesWithFantasyPoints++;
          }
          
          // Sample performance data
          if (verification.sampleData.performances.length < 5) {
            verification.sampleData.performances.push({
              matchId: matchDoc.id,
              gameId: gameDoc.id,
              playerId: perfDoc.id,
              fantasyPoints: perfData.fantasyPoints,
              kills: perfData.kills,
              deaths: perfData.deaths,
              assists: perfData.assists,
              hasFantasyScoring: perfData.fantasyPoints !== undefined
            });
          }
        });
        
        if (performancesSnap.empty) {
          verification.games.issues.push(`Game ${gameDoc.id} in match ${matchDoc.id} has no performances`);
        }
      }
      
      if (gamesSnap.empty) {
        verification.matches.issues.push(`Match ${matchDoc.id} has no games`);
      }
    }
    
    verification.games.count = totalGames;
    verification.games.withPerformances = totalPerformances > 0 ? totalGames : 0;
    verification.performances.count = totalPerformances;
    verification.performances.withFantasyPoints = performancesWithFantasyPoints;
    
    // 3. Check fantasy lineups
    console.log('👥 Checking fantasy lineups...');
    const fantasyLineupsSnap = await db.collection('fantasyLineups').limit(50).get();
    verification.fantasyLineups.count = fantasyLineupsSnap.size;
    
    for (const userDoc of fantasyLineupsSnap.docs.slice(0, 10)) { // Sample first 10 users
      const userData = userDoc.data();
      
      // Sample lineup data
      if (verification.sampleData.lineups.length < 3) {
        verification.sampleData.lineups.push({
          userId: userDoc.id,
          displayName: userData.discordUsername || userData.displayName || 'Anonymous',
          currentTotalScore: userData.totalFantasyScore,
          currentGamesPlayed: userData.gamesPlayed,
          currentAverage: userData.averageFantasyScore
        });
      }
      
      const userRoundsSnap = await userDoc.ref.collection('rounds').get();
      
      if (!userRoundsSnap.empty) {
        verification.fantasyLineups.withRounds++;
        
        // Check lineup structure
        for (const roundDoc of userRoundsSnap.docs.slice(0, 2)) { // Sample 2 rounds per user
          const roundData = roundDoc.data();
          const lineup = roundData?.lineup || {};
          
          const lineupPlayers = Object.values(lineup).filter((player: any) => 
            player && typeof player === 'object' && player.id
          );
          
          if (lineupPlayers.length === 0) {
            verification.fantasyLineups.issues.push(
              `User ${userDoc.id} round ${roundDoc.id} has empty lineup`
            );
          }
        }
      } else {
        verification.fantasyLineups.issues.push(`User ${userDoc.id} has no rounds`);
      }
    }
    
    // 4. Check tournament players
    console.log('⭐ Checking tournament players...');
    const playersSnap = await db.collection('tournamentPlayers').limit(100).get();
    verification.tournamentPlayers.count = playersSnap.size;
    
    playersSnap.docs.forEach(playerDoc => {
      const playerData = playerDoc.data();
      if (playerData.role) {
        verification.tournamentPlayers.withRoles++;
      } else {
        verification.tournamentPlayers.issues.push(`Player ${playerDoc.id} (${playerData.nickname}) missing role`);
      }
    });
    
    // 5. Generate summary and recommendations
    const isReady = 
      verification.matches.count > 0 &&
      verification.games.count > 0 &&
      verification.performances.withFantasyPoints > 0 &&
      verification.fantasyLineups.count > 0 &&
      verification.tournamentPlayers.count > 0;
    
    const warnings = [];
    const criticalIssues = [];
    
    if (verification.performances.withFantasyPoints === 0) {
      criticalIssues.push('❌ No performances have fantasy points calculated');
    }
    
    if (verification.fantasyLineups.withRounds === 0) {
      criticalIssues.push('❌ No fantasy users have lineup rounds');
    }
    
    if (verification.tournamentPlayers.withRoles < verification.tournamentPlayers.count) {
      warnings.push(`⚠️ ${verification.tournamentPlayers.count - verification.tournamentPlayers.withRoles} players missing roles`);
    }
    
    if (verification.matches.withGames < verification.matches.count) {
      warnings.push(`⚠️ ${verification.matches.count - verification.matches.withGames} matches have no games`);
    }
    
    console.log('✅ Data verification complete');
    
    return NextResponse.json({
      success: true,
      isReadyForRecalculation: isReady,
      criticalIssues,
      warnings,
      summary: {
        matches: verification.matches.count,
        games: verification.games.count,
        performances: verification.performances.count,
        performancesWithFantasyPoints: verification.performances.withFantasyPoints,
        fantasyUsers: verification.fantasyLineups.count,
        fantasyUsersWithRounds: verification.fantasyLineups.withRounds,
        tournamentPlayers: verification.tournamentPlayers.count,
        roundsFound: Array.from(verification.rounds.found),
        roundDistribution: Object.fromEntries(verification.rounds.mapped)
      },
      detailed: verification,
      recommendations: isReady ? [
        '✅ All required data is available',
        '🚀 You can proceed with fantasy recalculation',
        '💡 Consider backing up current scores before recalculation'
      ] : [
        '❌ Missing critical data - cannot proceed with recalculation',
        '🔧 Fix the critical issues listed above first',
        '📋 Ensure matches have been imported with fantasy scoring enabled'
      ]
    });
    
  } catch (error) {
    console.error('❌ Data verification failed:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Data verification failed: ${(error as Error).message}`,
        isReadyForRecalculation: false
      },
      { status: 500 }
    );
  }
}