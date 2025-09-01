import { NextRequest, NextResponse } from 'next/server';
import { ensureAdminInitialized, getAdminDb } from '../../../../server/lib/admin';

/**
 * Debug endpoint to check the actual structure of team documents
 */
export async function GET(request: NextRequest) {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();
    
    // Check if there's a separate players collection
    const playersCollectionSnap = await db.collection('players').limit(5).get();
    const playersFromCollection = playersCollectionSnap.docs.map(doc => ({
      id: doc.id,
      data: doc.data()
    }));
    
    // Check if players are in subcollections under teams
    const teamsSnap = await db.collection('teams').limit(2).get();
    const teamSubcollectionSamples: any[] = [];
    
    for (const teamDoc of teamsSnap.docs) {
      try {
        // Try to get players subcollection
        const playersSubSnap = await teamDoc.ref.collection('players').limit(3).get();
        if (!playersSubSnap.empty) {
          teamSubcollectionSamples.push({
            teamId: teamDoc.id,
            teamName: teamDoc.data().name,
            players: playersSubSnap.docs.map(doc => ({ id: doc.id, data: doc.data() }))
          });
        }
      } catch (e) {
        // Subcollection might not exist
      }
    }
    
    // Get first few teams to inspect structure
    const sampleTeams = teamsSnap.docs.map(doc => ({ 
      id: doc.id, 
      data: doc.data() 
    }));
    
    return NextResponse.json({
      success: true,
      playersCollection: {
        exists: !playersCollectionSnap.empty,
        count: playersCollectionSnap.docs.length,
        samples: playersFromCollection
      },
      teamSubcollections: {
        count: teamSubcollectionSamples.length,
        samples: teamSubcollectionSamples
      },
      sampleTeams,
      totalTeams: teamsSnap.docs.length
    });
    
  } catch (error) {
    console.error('Failed to debug team structure:', error);
    return NextResponse.json({
      success: false,
      message: `Failed to debug: ${(error as Error).message}`
    }, { status: 500 });
  }
}