import { NextRequest, NextResponse } from 'next/server';
import { ensureAdminInitialized, getAdminDb } from '../../../../server/lib/admin';
import { fetchOpenDotaMatch, transformMatchData, isMatchParsed } from '../../../../lib/opendota';
import { updateFantasyScoresAfterMatch } from '../../../../lib/fantasy-scoring-admin';
import { markGameAsProcessedAdmin } from '../../../../lib/processed-games-admin';
import type { Team, Player } from '../../../../lib/definitions';

interface UpdateResults {
  totalMatches: number;
  updatedMatches: number;
  skippedMatches: number;
  errorMatches: number;
  fantasyScoreUpdates: number;
  errors: string[];
  details: Array<{
    matchId: string;
    status: 'updated' | 'skipped' | 'error';
    message: string;
    gamesCount?: number;
  }>;
}

/**
 * Updates all saved matches with latest data from OpenDota
 * Use this when new data fields are added that should be saved from OpenDota matches
 */
export async function POST(request: NextRequest) {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();
    
    console.log('Starting update of all saved matches...');
    
    const results: UpdateResults = {
      totalMatches: 0,
      updatedMatches: 0,
      skippedMatches: 0,
      errorMatches: 0,
      fantasyScoreUpdates: 0,
      errors: [],
      details: []
    };
    
    // Get request body to check for options
    const body = await request.json().catch(() => ({}));
    const { 
      updateFantasyScores = true,
      dryRun = false 
    } = body;
    
    console.log(`Update options: updateFantasyScores=${updateFantasyScores}, dryRun=${dryRun}`);
    
    // Get all teams and extract players from team subcollections
    const teamsSnap = await db.collection('teams').get();
    const teams = teamsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Extract all players from team subcollections
    const players: any[] = [];
    for (const teamDoc of teamsSnap.docs) {
      try {
        const playersSnap = await teamDoc.ref.collection('players').get();
        playersSnap.docs.forEach(playerDoc => {
          const playerData = playerDoc.data();
          players.push({
            id: playerDoc.id,
            steamId32: playerData.steamId32,
            name: playerData.nickname || playerData.name,
            role: playerData.role,
            teamId: teamDoc.id
          });
        });
      } catch (error) {
        console.warn(`Failed to load players for team ${teamDoc.id}:`, error);
      }
    }
    
    console.log(`Loaded ${teams.length} teams and ${players.length} players from team subcollections`);
    
    // Get all matches
    const matchesSnap = await db.collection('matches').get();
    results.totalMatches = matchesSnap.docs.length;
    
    console.log(`Found ${results.totalMatches} matches to update`);
    
    // Process each match
    for (const matchDoc of matchesSnap.docs) {
      const matchId = matchDoc.id;
      const matchData = matchDoc.data();
      
      try {
        console.log(`Updating match ${matchId}...`);
        
        // Get all games for this match - game IDs are OpenDota match IDs
        const gamesRef = db.collection('matches').doc(matchId).collection('games');
        const gamesSnap = await gamesRef.get();
        
        if (gamesSnap.empty) {
          results.skippedMatches++;
          results.details.push({
            matchId,
            status: 'skipped',
            message: 'No games found for this match'
          });
          console.log(`Skipping match ${matchId} - no games found`);
          continue;
        }
        
        console.log(`Found ${gamesSnap.docs.length} games for match ${matchId}`);
        
        let gamesUpdated = 0;
        
        // Update each game with latest OpenDota data
        for (const gameDoc of gamesSnap.docs) {
          const openDotaMatchId = gameDoc.id; // Game ID is the OpenDota match ID
          
          try {
            console.log(`Fetching latest OpenDota data for game ${openDotaMatchId}...`);
            const openDotaMatch = await fetchOpenDotaMatch(parseInt(openDotaMatchId));
            
            // Check if match is parsed
            const isParsed = isMatchParsed(openDotaMatch);
            console.log(`Game ${openDotaMatchId} parsed status: ${isParsed}`);
            
            if (!isParsed) {
              console.log(`Skipping unparsed game ${openDotaMatchId}`);
              continue;
            }
            
            // Determine if this was a manual import
            const existingGameData = gameDoc.data();
            const isManualImport = existingGameData?.isManualImport || matchData.isManualImport || false;
            
            // Get existing team assignments from the database to preserve manual assignments
            const existingTeamAssignments = existingGameData?.radiant_team && existingGameData?.dire_team ? {
              radiant_team: existingGameData.radiant_team,
              dire_team: existingGameData.dire_team
            } : undefined;
            
            console.log(`Game ${openDotaMatchId} existing teams: Radiant="${existingTeamAssignments?.radiant_team?.name}", Dire="${existingTeamAssignments?.dire_team?.name}"`);
            
            // Transform the match data with latest data, preserving team assignments
            const { game, performances } = transformMatchData(openDotaMatch, teams as Team[], players as Player[], isManualImport, existingTeamAssignments);
            
            if (!dryRun) {
              // Update the game document with latest data
              await gameDoc.ref.set({
                ...game,
                lastUpdated: new Date().toISOString(),
                isManualImport: isManualImport
              });
              
              // Update performances with latest data
              const performancesRef = gameDoc.ref.collection('performances');
              const batch = db.batch();
              
              // Clear existing performances
              const existingPerformances = await performancesRef.get();
              existingPerformances.docs.forEach(doc => {
                batch.delete(doc.ref);
              });
              
              // Add updated performances
              performances.forEach(perf => {
                const perfRef = performancesRef.doc(perf.playerId);
                batch.set(perfRef, perf);
              });
              
              await batch.commit();
              
              // Mark as processed
              await markGameAsProcessedAdmin(openDotaMatchId);
              
              // Update fantasy scores if requested
              let roundId = matchData.group_id || matchData.roundId;
              // Map Polish group names to fantasy round
              if (roundId && roundId.startsWith('grupa-')) {
                roundId = 'group_stage';
              }
              
              if (updateFantasyScores && roundId) {
                const fantasyUpdateResult = await updateFantasyScoresAfterMatch(
                  matchId, 
                  roundId, 
                  game.id
                );
                
                if (fantasyUpdateResult.success) {
                  results.fantasyScoreUpdates += fantasyUpdateResult.updatesCount;
                }
              }
            }
            
            gamesUpdated++;
            console.log(`Successfully updated game ${openDotaMatchId} with latest data`);
            
          } catch (gameError) {
            console.error(`Error updating game ${openDotaMatchId}:`, gameError);
            // Continue with next game
          }
          
          // Small delay between games to avoid overwhelming OpenDota API
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        // Update match metadata
        if (!dryRun) {
          await matchDoc.ref.update({
            lastUpdated: new Date().toISOString(),
            gamesUpdated: gamesUpdated
          });
        }
        
        results.updatedMatches++;
        results.details.push({
          matchId,
          status: 'updated',
          message: `Successfully updated ${gamesUpdated}/${gamesSnap.docs.length} games`,
          gamesCount: gamesUpdated
        });
        
        console.log(`Successfully updated match ${matchId}: ${gamesUpdated}/${gamesSnap.docs.length} games updated`);
        
      } catch (error) {
        results.errorMatches++;
        const errorMessage = `Error updating match ${matchId}: ${(error as Error).message}`;
        results.errors.push(errorMessage);
        results.details.push({
          matchId,
          status: 'error',
          message: errorMessage
        });
        
        console.error(`Error updating match ${matchId}:`, error);
        // Continue with next match instead of failing completely
      }
    }
    
    const summary = `Update complete: ${results.updatedMatches}/${results.totalMatches} matches updated, ${results.fantasyScoreUpdates} fantasy score updates, ${results.errorMatches} errors`;
    console.log(summary);
    
    return NextResponse.json({
      success: true,
      message: summary,
      results,
      dryRun
    });
    
  } catch (error) {
    console.error('Match update failed:', error);
    return NextResponse.json({
      success: false,
      message: `Match update failed: ${(error as Error).message}`,
      results: null
    }, { status: 500 });
  }
}