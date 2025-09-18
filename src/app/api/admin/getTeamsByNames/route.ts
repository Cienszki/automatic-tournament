import { NextRequest, NextResponse } from 'next/server';
import { ensureAdminInitialized, getAdminDb } from '../../../../server/lib/admin';

/**
 * Get team IDs and details by team names
 */
export async function POST(request: NextRequest) {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();
    
    const { teamNames } = await request.json();
    
    if (!teamNames || !Array.isArray(teamNames)) {
      return NextResponse.json({
        success: false,
        message: 'teamNames array is required'
      }, { status: 400 });
    }
    
    console.log(`🔍 Finding team IDs for ${teamNames.length} teams:`, teamNames);
    
    const results: Array<{
      teamName: string;
      teamId?: string;
      teamTag?: string;
      teamStatus?: string;
      found: boolean;
    }> = [];
    
    // Get all teams
    const teamsSnap = await db.collection('teams').get();
    
    for (const teamName of teamNames) {
      console.log(`🔍 Searching for team: ${teamName}...`);
      
      let found = false;
      
      // Search through all teams
      for (const teamDoc of teamsSnap.docs) {
        const teamData = teamDoc.data();
        const dbTeamName = teamData.name || '';
        
        // Check for exact match or close match (trim and case insensitive)
        if (dbTeamName.trim().toLowerCase() === teamName.trim().toLowerCase()) {
          results.push({
            teamName: teamName,
            teamId: teamDoc.id,
            teamTag: teamData.tag || '',
            teamStatus: teamData.status || 'unknown',
            found: true
          });
          
          console.log(`✅ Found team "${teamName}" with ID: ${teamDoc.id}`);
          found = true;
          break;
        }
      }
      
      if (!found) {
        results.push({
          teamName: teamName,
          found: false
        });
        console.log(`❌ Team "${teamName}" not found`);
      }
    }
    
    const foundCount = results.filter(r => r.found).length;
    console.log(`🎉 Found ${foundCount}/${teamNames.length} teams`);
    
    return NextResponse.json({
      success: true,
      message: `Found ${foundCount}/${teamNames.length} teams`,
      results: results,
      summary: {
        total: teamNames.length,
        found: foundCount,
        notFound: teamNames.length - foundCount
      }
    });
    
  } catch (error: any) {
    console.error('❌ Error finding team IDs:', error);
    return NextResponse.json({
      success: false,
      message: `Error finding team IDs: ${error.message}`,
      results: []
    }, { status: 500 });
  }
}