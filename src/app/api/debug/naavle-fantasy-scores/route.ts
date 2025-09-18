// @ts-nocheck
import { NextResponse } from 'next/server';
import { getAdminDb, ensureAdminInitialized } from "@/server/lib/admin";

export async function GET() {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();
    
    console.log('🔍 Searching for Naavle fantasy scores...');
    
    // Step 1: Find Naavle's player ID by searching through all performance documents
    console.log('Step 1: Finding Naavle player ID...');
    let naavlePlayerId = null;
    
    const matchesSnapshot = await db.collection('matches').limit(20).get(); // Limit initial search
    console.log(`Scanning ${matchesSnapshot.docs.length} matches for Naavle player ID...`);
    
    outerLoop: for (const matchDoc of matchesSnapshot.docs) {
      const matchId = matchDoc.id;
      
      const gamesSnapshot = await db
        .collection('matches')
        .doc(matchId)
        .collection('games')
        .get();
      
      for (const gameDoc of gamesSnapshot.docs) {
        const gameId = gameDoc.id;
        
        const performancesSnapshot = await db
          .collection('matches')
          .doc(matchId)
          .collection('games')
          .doc(gameId)
          .collection('performances')
          .get();
        
        for (const perfDoc of performancesSnapshot.docs) {
          const perfData = perfDoc.data();
          const playerName = (perfData.personaname || '').toLowerCase();
          
          if (playerName.includes('naavle')) {
            naavlePlayerId = perfDoc.id; // The document ID is the player ID
            console.log(`Found Naavle player ID: ${naavlePlayerId} (name: ${perfData.personaname})`);
            break outerLoop;
          }
        }
      }
    }
    
    if (!naavlePlayerId) {
      return NextResponse.json({
        success: false,
        error: 'Could not find Naavle player ID',
        performances: []
      });
    }
    
    // Step 2: Now search for all performances using the player ID
    console.log(`Step 2: Searching for all performances for player ID ${naavlePlayerId}...`);
    const allPerformances = [];
    const allMatchesSnapshot = await db.collection('matches').get();
    console.log(`Found ${allMatchesSnapshot.docs.length} total matches to search through`);
    
    for (const matchDoc of allMatchesSnapshot.docs) {
      const matchId = matchDoc.id;
      const matchData = matchDoc.data();
      
      const gamesSnapshot = await db
        .collection('matches')
        .doc(matchId)
        .collection('games')
        .get();
      
      for (const gameDoc of gamesSnapshot.docs) {
        const gameId = gameDoc.id;
        const gameData = gameDoc.data();
        
        // Check if this player has a performance in this game
        const playerPerfRef = db
          .collection('matches')
          .doc(matchId)
          .collection('games')
          .doc(gameId)
          .collection('performances')
          .doc(naavlePlayerId);
          
        const playerPerfSnap = await playerPerfRef.get();
        
        if (playerPerfSnap.exists) {
          const perfData = playerPerfSnap.data();
          
          console.log(`Found Naavle performance in match ${matchId}, game ${gameId} - ${perfData?.fantasyPoints || 0} points`);
          
          allPerformances.push({
            matchId,
            gameId,
            perfId: naavlePlayerId,
            matchInfo: {
              teamA: matchData.teamA,
              teamB: matchData.teamB,
              status: matchData.status
            },
            gameInfo: {
              duration: gameData.duration,
              radiant_win: gameData.radiant_win,
              id: gameData.id
            },
            performance: {
              playerId: naavlePlayerId,
              personaname: perfData?.personaname,
              fantasyPoints: perfData?.fantasyPoints,
              kills: perfData?.kills,
              deaths: perfData?.deaths,
              assists: perfData?.assists,
              hero_name: perfData?.hero_name,
              teamId: perfData?.teamId,
              teamName: perfData?.teamName,
              role: perfData?.role,
              gpm: perfData?.gpm,
              xpm: perfData?.xpm,
              lastHits: perfData?.lastHits,
              netWorth: perfData?.netWorth,
              heroDamage: perfData?.heroDamage,
              towerDamage: perfData?.towerDamage,
              heroHealing: perfData?.heroHealing
            }
          });
        }
      }
    }
    
    console.log(`Found ${allPerformances.length} Naavle performances`);
    
    // Sort by fantasy points descending
    allPerformances.sort((a, b) => (b.performance.fantasyPoints || 0) - (a.performance.fantasyPoints || 0));
    
    return NextResponse.json({
      success: true,
      totalPerformances: allPerformances.length,
      totalFantasyPoints: allPerformances.reduce((sum, perf) => sum + (perf.performance.fantasyPoints || 0), 0),
      averageFantasyPoints: allPerformances.length > 0 ? 
        allPerformances.reduce((sum, perf) => sum + (perf.performance.fantasyPoints || 0), 0) / allPerformances.length : 0,
      performances: allPerformances
    });
    
  } catch (error) {
    console.error('Error searching for Naavle performances:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      performances: []
    });
  }
}