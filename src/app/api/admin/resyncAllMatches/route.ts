import { NextRequest, NextResponse } from 'next/server';
import { ensureAdminInitialized, getAdminDb } from '../../../../server/lib/admin';
import { fetchOpenDotaMatch, transformMatchData, isMatchParsed } from '../../../../lib/opendota';
import { updateFantasyScoresAfterMatch } from '../../../../lib/fantasy-scoring-admin';
import { markGameAsProcessedAdmin } from '../../../../lib/processed-games-admin';
import type { Team, Player } from '../../../../lib/definitions';

interface ResyncResults {
  totalMatches: number;
  totalGames: number;
  resyncedGames: number;
  skippedGames: number;
  errorGames: number;
  fantasyScoreUpdates: number;
  manualMatches: Array<{
    matchId: string;
    gameId: string;
    radiantTeam: string;
    direTeam: string;
    reason: string;
  }>;
  errors: string[];
  details: Array<{
    matchId: string;
    gameId: string;
    status: 'resynced' | 'skipped' | 'error' | 'manual';
    message: string;
    radiantTeam?: string;
    direTeam?: string;
  }>;
}

/**
 * Re-syncs all existing matches with latest OpenDota data including new multikill fields
 * This is needed after adding new fields to the PlayerPerformanceInGame interface
 */
export async function POST(request: NextRequest) {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();
    
    console.log('🔄 Starting re-sync of all matches with enhanced OpenDota data...');
    
    const results: ResyncResults = {
      totalMatches: 0,
      totalGames: 0,
      resyncedGames: 0,
      skippedGames: 0,
      errorGames: 0,
      fantasyScoreUpdates: 0,
      manualMatches: [],
      errors: [],
      details: []
    };
    
    // Get request body to check for options
    const body = await request.json().catch(() => ({}));
    const { 
      updateFantasyScores = true,
      dryRun = false 
    } = body;
    
    console.log(`Re-sync options: updateFantasyScores=${updateFantasyScores}, dryRun=${dryRun}`);
    
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
    
    // Get all matches
    const matchesSnap = await db.collection('matches').get();
    results.totalMatches = matchesSnap.docs.length;
    
    console.log(`Found ${results.totalMatches} matches to re-sync`);
    
    // Process each match
    for (const matchDoc of matchesSnap.docs) {
      const matchId = matchDoc.id;
      const matchData = matchDoc.data();
      
      try {
        console.log(`🔍 Processing match ${matchId}...`);
        
        // Get all games for this match
        const gamesRef = db.collection('matches').doc(matchId).collection('games');
        const gamesSnap = await gamesRef.get();
        
        if (gamesSnap.empty) {
          results.skippedGames++;
          results.details.push({
            matchId,
            gameId: 'none',
            status: 'skipped',
            message: 'No games found for this match'
          });
          console.log(`⏭️ Skipping match ${matchId} - no games found`);
          continue;
        }
        
        console.log(`Found ${gamesSnap.docs.length} games for match ${matchId}`);
        results.totalGames += gamesSnap.docs.length;
        
        // Process each game
        for (const gameDoc of gamesSnap.docs) {
          const gameId = gameDoc.id; // This should be the OpenDota match ID
          const existingGameData = gameDoc.data();
          
          try {
            console.log(`🎮 Re-syncing game ${gameId}...`);
            
            // Check if this was a manual import
            const isManualImport = existingGameData?.isManualImport || matchData?.isManualImport || false;
            
            if (isManualImport) {
              // Skip manual imports but track them for reporting
              results.manualMatches.push({
                matchId,
                gameId,
                radiantTeam: existingGameData?.radiant_team?.name || 'Unknown',
                direTeam: existingGameData?.dire_team?.name || 'Unknown',
                reason: 'Manual import - cannot re-sync from OpenDota'
              });
              
              results.details.push({
                matchId,
                gameId,
                status: 'manual',
                message: 'Skipped manual import',
                radiantTeam: existingGameData?.radiant_team?.name,
                direTeam: existingGameData?.dire_team?.name
              });
              
              console.log(`📝 Skipping manual import game ${gameId}`);
              continue;
            }
            
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
                gameId,
                status: 'skipped',
                message: 'OpenDota match not parsed yet'
              });
              console.log(`⏭️ Skipping unparsed game ${gameId}`);
              continue;
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
              isManualImport, 
              existingTeamAssignments
            );
            
            if (!dryRun) {
              // Update the game document with enhanced data
              await gameDoc.ref.set({
                ...game,
                lastUpdated: new Date().toISOString(),
                resyncedAt: new Date().toISOString(),
                isManualImport: isManualImport
              });
              
              // Update performances with enhanced data including multikills
              const performancesRef = gameDoc.ref.collection('performances');
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
              await markGameAsProcessedAdmin(gameId);
              
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
              gameId,
              status: 'resynced',
              message: 'Successfully re-synced with enhanced OpenDota data',
              radiantTeam: game.radiant_team?.name || 'Unknown',
              direTeam: game.dire_team?.name || 'Unknown'
            });
            
            console.log(`✅ Successfully re-synced game ${gameId}`);
            
          } catch (gameError: any) {
            results.errorGames++;
            const errorMessage = `Error re-syncing game ${gameId}: ${gameError.message}`;
            results.errors.push(errorMessage);
            
            // Check if it's a 404 error (match not found on OpenDota)
            if (gameError.message?.includes('404') || gameError.message?.includes('not found')) {
              results.manualMatches.push({
                matchId,
                gameId,
                radiantTeam: existingGameData?.radiant_team?.name || 'Unknown',
                direTeam: existingGameData?.dire_team?.name || 'Unknown',
                reason: 'Not found on OpenDota - likely manual import'
              });
              
              results.details.push({
                matchId,
                gameId,
                status: 'manual',
                message: 'Not found on OpenDota - treating as manual import',
                radiantTeam: existingGameData?.radiant_team?.name,
                direTeam: existingGameData?.dire_team?.name
              });
            } else {
              results.details.push({
                matchId,
                gameId,
                status: 'error',
                message: errorMessage,
                radiantTeam: existingGameData?.radiant_team?.name,
                direTeam: existingGameData?.dire_team?.name
              });
            }
            
            console.error(`❌ Error re-syncing game ${gameId}:`, gameError);
            // Continue with next game
          }
          
          // Small delay between games to avoid overwhelming OpenDota API
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        // Update match metadata
        if (!dryRun) {
          await matchDoc.ref.update({
            lastResynced: new Date().toISOString(),
            resyncedGamesCount: results.resyncedGames
          });
        }
        
        console.log(`✅ Completed processing match ${matchId}`);
        
      } catch (error: any) {
        const errorMessage = `Error processing match ${matchId}: ${error.message}`;
        results.errors.push(errorMessage);
        console.error(`❌ Error processing match ${matchId}:`, error);
        // Continue with next match
      }
    }
    
    const summary = `Re-sync complete: ${results.resyncedGames}/${results.totalGames} games re-synced, ${results.manualMatches.length} manual matches identified, ${results.fantasyScoreUpdates} fantasy score updates, ${results.errorGames} errors`;
    console.log(`🎉 ${summary}`);
    
    return NextResponse.json({
      success: true,
      message: summary,
      results,
      dryRun
    });
    
  } catch (error: any) {
    console.error('❌ Match re-sync failed:', error);
    return NextResponse.json({
      success: false,
      message: `Match re-sync failed: ${error.message}`,
      results: null
    }, { status: 500 });
  }
}