import { NextRequest, NextResponse } from 'next/server';
import { ensureAdminInitialized, getAdminDb } from '../../../../server/lib/admin';

/**
 * Debug endpoint to check fantasy lineup rounds vs match group_ids
 */
export async function GET(request: NextRequest) {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();
    
    // Get match group_ids
    const matchesSnap = await db.collection('matches').get();
    const matchGroupIds = new Set<string>();
    matchesSnap.docs.forEach(doc => {
      const data = doc.data();
      if (data.group_id) {
        matchGroupIds.add(data.group_id);
      }
    });
    
    // Get fantasy lineup round IDs
    const fantasyLineupsSnap = await db.collection('fantasyLineups').limit(5).get();
    const fantasyRoundIds = new Set<string>();
    
    for (const userDoc of fantasyLineupsSnap.docs) {
      const roundsSnap = await userDoc.ref.collection('rounds').get();
      roundsSnap.docs.forEach(roundDoc => {
        fantasyRoundIds.add(roundDoc.id);
      });
    }
    
    // Sample a few fantasy lineups to see structure
    const sampleLineups: any[] = [];
    for (const userDoc of fantasyLineupsSnap.docs.slice(0, 2)) {
      const userId = userDoc.id;
      const userData = userDoc.data();
      const roundsSnap = await userDoc.ref.collection('rounds').get();
      
      const userRounds: any[] = [];
      roundsSnap.docs.forEach(roundDoc => {
        userRounds.push({
          roundId: roundDoc.id,
          data: roundDoc.data()
        });
      });
      
      sampleLineups.push({
        userId,
        userData: {
          totalFantasyScore: userData.totalFantasyScore,
          gamesPlayed: userData.gamesPlayed,
          averageFantasyScore: userData.averageFantasyScore
        },
        rounds: userRounds
      });
    }
    
    return NextResponse.json({
      success: true,
      matchGroupIds: Array.from(matchGroupIds).sort(),
      fantasyRoundIds: Array.from(fantasyRoundIds).sort(),
      roundIdMatch: {
        matchHasFantasy: Array.from(matchGroupIds).filter(id => fantasyRoundIds.has(id)),
        fantasyHasNoMatch: Array.from(fantasyRoundIds).filter(id => !matchGroupIds.has(id)),
        matchHasNoFantasy: Array.from(matchGroupIds).filter(id => !fantasyRoundIds.has(id))
      },
      sampleLineups,
      totalMatches: matchesSnap.docs.length,
      totalFantasyUsers: fantasyLineupsSnap.docs.length
    });
    
  } catch (error) {
    console.error('Failed to debug fantasy rounds:', error);
    return NextResponse.json({
      success: false,
      message: `Failed to debug: ${(error as Error).message}`
    }, { status: 500 });
  }
}