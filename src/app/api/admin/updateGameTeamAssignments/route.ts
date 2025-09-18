import { NextRequest, NextResponse } from 'next/server';
import { ensureAdminInitialized, getAdminDb } from '../../../../server/lib/admin';

interface TeamAssignmentUpdate {
  gameId: string;
  radiantTeam: {
    teamId: string;
    teamName: string;
  };
  direTeam: {
    teamId: string;
    teamName: string;
  };
}

/**
 * Update team assignments for specific games
 */
export async function POST(request: NextRequest) {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();
    
    const body = await request.json();
    const { assignments = [], dryRun = false } = body;
    
    if (!Array.isArray(assignments) || assignments.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'assignments array is required'
      }, { status: 400 });
    }
    
    console.log(`🔄 Updating team assignments for ${assignments.length} games...`);
    
    const results: Array<{
      gameId: string;
      matchId: string;
      status: 'updated' | 'error' | 'not_found';
      message: string;
      oldRadiantTeam?: string;
      oldDireTeam?: string;
      newRadiantTeam?: string;
      newDireTeam?: string;
    }> = [];
    
    // Process each assignment
    for (const assignment of assignments as TeamAssignmentUpdate[]) {
      console.log(`🎮 Updating team assignment for game ${assignment.gameId}...`);
      
      // Find the game in the database
      let gameFound = false;
      let matchId = '';
      
      const matchesSnap = await db.collection('matches').get();
      
      for (const matchDoc of matchesSnap.docs) {
        const gameRef = matchDoc.ref.collection('games').doc(assignment.gameId);
        const gameSnap = await gameRef.get();
        
        if (gameSnap.exists) {
          gameFound = true;
          matchId = matchDoc.id;
          
          try {
            const existingGameData = gameSnap.data();
            const oldRadiantTeam = existingGameData?.radiant_team?.name || existingGameData?.radiantTeam?.name;
            const oldDireTeam = existingGameData?.dire_team?.name || existingGameData?.direTeam?.name;
            
            console.log(`Game ${assignment.gameId} current teams: Radiant="${oldRadiantTeam}", Dire="${oldDireTeam}"`);
            console.log(`Game ${assignment.gameId} new teams: Radiant="${assignment.radiantTeam.teamName}", Dire="${assignment.direTeam.teamName}"`);
            
            if (!dryRun) {
              // Update team assignments
              const updateData = {
                radiantTeam: {
                  id: assignment.radiantTeam.teamId,
                  name: assignment.radiantTeam.teamName,
                  logo: ''
                },
                direTeam: {
                  id: assignment.direTeam.teamId,
                  name: assignment.direTeam.teamName,
                  logo: ''
                },
                radiant_team: {
                  team_id: assignment.radiantTeam.teamId,
                  name: assignment.radiantTeam.teamName,
                  logo: ''
                },
                dire_team: {
                  team_id: assignment.direTeam.teamId,
                  name: assignment.direTeam.teamName,
                  logo: ''
                },
                lastUpdated: new Date().toISOString(),
                teamAssignmentUpdated: new Date().toISOString()
              };
              
              await gameRef.update(updateData);
            }
            
            results.push({
              gameId: assignment.gameId,
              matchId,
              status: 'updated',
              message: 'Successfully updated team assignments',
              oldRadiantTeam,
              oldDireTeam,
              newRadiantTeam: assignment.radiantTeam.teamName,
              newDireTeam: assignment.direTeam.teamName
            });
            
            console.log(`✅ Updated team assignment for game ${assignment.gameId}`);
            
          } catch (error: any) {
            results.push({
              gameId: assignment.gameId,
              matchId,
              status: 'error',
              message: `Error updating team assignment: ${error.message}`
            });
            
            console.error(`❌ Error updating team assignment for game ${assignment.gameId}:`, error);
          }
          
          break;
        }
      }
      
      if (!gameFound) {
        results.push({
          gameId: assignment.gameId,
          matchId: 'unknown',
          status: 'not_found',
          message: 'Game not found in database'
        });
        
        console.log(`❌ Game ${assignment.gameId} not found in database`);
      }
    }
    
    const successCount = results.filter(r => r.status === 'updated').length;
    const summary = `Updated team assignments for ${successCount}/${assignments.length} games`;
    
    console.log(`🎉 ${summary}`);
    
    return NextResponse.json({
      success: true,
      message: summary,
      results,
      dryRun
    });
    
  } catch (error: any) {
    console.error('❌ Team assignment update failed:', error);
    return NextResponse.json({
      success: false,
      message: `Team assignment update failed: ${error.message}`,
      results: []
    }, { status: 500 });
  }
}