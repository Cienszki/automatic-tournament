import { NextRequest, NextResponse } from 'next/server';
import { ensureAdminInitialized, getAdminDb } from '../../../../server/lib/admin';
import { fetchOpenDotaMatch, transformMatchData, isMatchParsed } from '../../../../lib/opendota';
import { updateFantasyScoresAfterMatch } from '../../../../lib/fantasy-scoring-admin';
import { markGameAsProcessedAdmin } from '../../../../lib/processed-games-admin';
import type { Team, Player } from '../../../../lib/definitions';

interface ResyncResults {
  totalTargetGames: number;
  resyncedGames: number;
  skippedGames: number;
  errorGames: number;
  fantasyScoreUpdates: number;
  errors: string[];
  details: Array<{
    matchId: string;
    gameId: string;
    status: 'resynced' | 'skipped' | 'error' | 'not_found';
    message: string;
    radiantTeam?: string;
    direTeam?: string;
  }>;
}

/**
 * Re-syncs specific matches by game IDs with enhanced OpenDota data
 */
export async function POST(request: NextRequest) {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();
    
    console.log('🔄 Starting targeted re-sync of specific matches...');
    
    const body = await request.json();
    const { 
      gameIds = [],
      updateFantasyScores = false,
      dryRun = false 
    } = body;
    
    if (!Array.isArray(gameIds) || gameIds.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'gameIds array is required'
      }, { status: 400 });
    }
    
    const results: ResyncResults = {
      totalTargetGames: gameIds.length,
      resyncedGames: 0,
      skippedGames: 0,
      errorGames: 0,
      fantasyScoreUpdates: 0,
      errors: [],
      details: []
    };
    
    console.log(`Re-sync options: updateFantasyScores=${updateFantasyScores}, dryRun=${dryRun}, targets=${gameIds.length}`);
    
    // Load all teams and players for match transformation
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
    
    console.log(`Loaded ${teams.length} teams and ${players.length} players`);
    
    // Find and process each target game
    for (const gameId of gameIds) {
      console.log(`🔍 Searching for game ${gameId}...`);
      
      let gameFound = false;
      
      // Search through all matches to find this game
      const matchesSnap = await db.collection('matches').get();
      
      for (const matchDoc of matchesSnap.docs) {
        const matchId = matchDoc.id;
        const matchData = matchDoc.data();
        
        // Check if this game exists in this match
        const gameRef = matchDoc.ref.collection('games').doc(gameId.toString());
        const gameSnap = await gameRef.get();
        
        if (gameSnap.exists) {
          gameFound = true;
          const existingGameData = gameSnap.data();
          
          try {
            console.log(`🎮 Re-syncing game ${gameId} in match ${matchId}...`);
            
            // Fetch latest data from OpenDota
            console.log(`📡 Fetching OpenDota data for game ${gameId}...`);
            const openDotaMatch = await fetchOpenDotaMatch(parseInt(gameId));
            
            // Check if match is parsed
            const isParsed = isMatchParsed(openDotaMatch);
            console.log(`Game ${gameId} parsed status: ${isParsed}`);
            
            if (!isParsed) {
              results.skippedGames++;
              results.details.push({
                matchId,
                gameId: gameId.toString(),
                status: 'skipped',
                message: 'OpenDota match not parsed yet'
              });
              console.log(`⏭️ Skipping unparsed game ${gameId}`);
              break;
            }
            
            // Get existing team assignments to preserve manual assignments
            const existingTeamAssignments = existingGameData?.radiant_team && existingGameData?.dire_team ? {
              radiant_team: existingGameData.radiant_team,
              dire_team: existingGameData.dire_team
            } : undefined;
            
            console.log(`Game ${gameId} existing teams: Radiant="${existingTeamAssignments?.radiant_team?.name}", Dire="${existingTeamAssignments?.dire_team?.name}"`);
            
            // Transform the match data with latest OpenDota data including new fields
            const { game, performances } = transformMatchData(
              openDotaMatch, 
              teams as Team[], 
              players as Player[], 
              existingGameData?.isManualImport || false,
              existingTeamAssignments
            );
            
            if (!dryRun) {
              // Update the game document with enhanced data
              await gameRef.set({
                ...game,
                lastUpdated: new Date().toISOString(),
                resyncedAt: new Date().toISOString(),
                isManualImport: existingGameData?.isManualImport || false
              });
              
              // Update performances with enhanced data including multikills
              const performancesRef = gameRef.collection('performances');
              const batch = db.batch();
              
              // Clear existing performances
              const existingPerformances = await performancesRef.get();
              existingPerformances.docs.forEach(doc => {
                batch.delete(doc.ref);
              });
              
              // Add enhanced performances with new fields
              performances.forEach(perf => {
                const perfRef = performancesRef.doc(perf.playerId);
                batch.set(perfRef, perf);
              });
              
              await batch.commit();
              
              // Mark as processed
              await markGameAsProcessedAdmin(gameId.toString());
              
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
            
            results.resyncedGames++;
            results.details.push({
              matchId,
              gameId: gameId.toString(),
              status: 'resynced',
              message: 'Successfully re-synced with enhanced OpenDota data',
              radiantTeam: game.radiant_team?.name || 'Unknown',
              direTeam: game.dire_team?.name || 'Unknown'
            });
            
            console.log(`✅ Successfully re-synced game ${gameId} in match ${matchId}`);
            
          } catch (gameError: any) {
            results.errorGames++;
            const errorMessage = `Error re-syncing game ${gameId}: ${gameError.message}`;
            results.errors.push(errorMessage);
            
            results.details.push({
              matchId,
              gameId: gameId.toString(),
              status: 'error',
              message: errorMessage,
              radiantTeam: existingGameData?.radiant_team?.name,
              direTeam: existingGameData?.dire_team?.name
            });
            
            console.error(`❌ Error re-syncing game ${gameId}:`, gameError);
          }
          
          break; // Found the game, no need to search other matches
        }
      }
      
      if (!gameFound) {
        results.errorGames++;
        const errorMessage = `Game ${gameId} not found in any match`;
        results.errors.push(errorMessage);
        
        results.details.push({
          matchId: 'unknown',
          gameId: gameId.toString(),
          status: 'not_found',
          message: errorMessage
        });
        
        console.log(`❌ Game ${gameId} not found in any match`);
      }
      
      // Small delay between games to avoid overwhelming OpenDota API
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    const summary = `Targeted re-sync complete: ${results.resyncedGames}/${results.totalTargetGames} games re-synced, ${results.fantasyScoreUpdates} fantasy score updates, ${results.errorGames} errors`;
    console.log(`🎉 ${summary}`);
    
    return NextResponse.json({
      success: true,
      message: summary,
      results,
      dryRun
    });
    
  } catch (error: any) {
    console.error('❌ Targeted match re-sync failed:', error);
    return NextResponse.json({
      success: false,
      message: `Targeted match re-sync failed: ${error.message}`,
      results: null
    }, { status: 500 });
  }
}