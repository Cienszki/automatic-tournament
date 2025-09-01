import { NextRequest, NextResponse } from 'next/server';
import { ensureAdminInitialized, getAdminDb } from '../../../../server/lib/admin';
import { fetchOpenDotaMatch, requestOpenDotaMatchParse, transformMatchData, isMatchParsed } from '../../../../lib/opendota';
import { updateFantasyScoresAfterMatch } from '../../../../lib/fantasy-scoring-admin';
import { markGameAsProcessedAdmin } from '../../../../lib/processed-games-admin';
import type { Team, Player } from '../../../../lib/definitions';

interface ReprocessResults {
  totalMatches: number;
  processedMatches: number;
  skippedMatches: number;
  errorMatches: number;
  parseRequestsSent: number;
  fantasyScoreUpdates: number;
  errors: string[];
  details: Array<{
    matchId: string;
    status: 'processed' | 'skipped' | 'error' | 'parse_requested';
    message: string;
    gamesCount?: number;
    isManualImport?: boolean;
  }>;
}

/**
 * Reprocesses all tournament matches with updated fantasy scoring
 * Handles both automatically imported matches and manually imported ones
 */
export async function POST(request: NextRequest) {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();
    
    console.log('Starting complete match reprocessing...');
    
    const results: ReprocessResults = {
      totalMatches: 0,
      processedMatches: 0,
      skippedMatches: 0,
      errorMatches: 0,
      parseRequestsSent: 0,
      fantasyScoreUpdates: 0,
      errors: [],
      details: []
    };
    
    // Get request body to check for options
    const body = await request.json().catch(() => ({}));
    const { 
      forceReprocess = false, 
      requestParsingForUnparsed = true,
      updateFantasyScores = true,
      dryRun = false 
    } = body;
    
    console.log(`Reprocessing options: forceReprocess=${forceReprocess}, requestParsingForUnparsed=${requestParsingForUnparsed}, updateFantasyScores=${updateFantasyScores}, dryRun=${dryRun}`);
    
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
    
    console.log(`Found ${results.totalMatches} matches to process`);
    
    // Process each match
    for (const matchDoc of matchesSnap.docs) {
      const matchId = matchDoc.id;
      const matchData = matchDoc.data();
      
      try {
        console.log(`Processing match ${matchId}...`);
        
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
        
        let gamesProcessed = 0;
        
        // Process each game individually
        for (const gameDoc of gamesSnap.docs) {
          const openDotaMatchId = gameDoc.id; // Game ID is the OpenDota match ID
          
          try {
            console.log(`Fetching OpenDota data for game ${openDotaMatchId}...`);
            const openDotaMatch = await fetchOpenDotaMatch(parseInt(openDotaMatchId));
            
            // Check if match is parsed
            const isParsed = isMatchParsed(openDotaMatch);
            console.log(`Game ${openDotaMatchId} parsed status: ${isParsed}`);
            
            if (!isParsed && requestParsingForUnparsed) {
              // Request parsing for unparsed matches
              console.log(`Requesting parsing for unparsed game ${openDotaMatchId}...`);
              const parseResult = await requestOpenDotaMatchParse(parseInt(openDotaMatchId));
              
              if (parseResult.success) {
                results.parseRequestsSent++;
                console.log(`Parse request sent for game ${openDotaMatchId}: ${parseResult.message}`);
                continue; // Skip processing for now, will need to be rerun later
              } else {
                console.log(`Failed to request parsing for game ${openDotaMatchId}: ${parseResult.message}`);
                // Continue with unparsed data anyway
              }
            }
            
            if (!isParsed && !forceReprocess) {
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
            
            // Transform the match data with updated scoring, preserving team assignments
            const { game, performances } = transformMatchData(openDotaMatch, teams as Team[], players as Player[], isManualImport, existingTeamAssignments);
            
            if (!dryRun) {
              // Update the game document
              await gameDoc.ref.set({
                ...game,
                lastReprocessed: new Date().toISOString(),
                isManualImport: isManualImport
              });
              
              // Update performances
              const performancesRef = gameDoc.ref.collection('performances');
              const batch = db.batch();
              
              // Clear existing performances
              const existingPerformances = await performancesRef.get();
              existingPerformances.docs.forEach(doc => {
                batch.delete(doc.ref);
              });
              
              // Add new performances
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
            
            gamesProcessed++;
            console.log(`Successfully reprocessed game ${openDotaMatchId} (${isParsed ? 'parsed' : 'unparsed'})`);
            
          } catch (gameError) {
            console.error(`Error processing game ${openDotaMatchId}:`, gameError);
            // Continue with next game
          }
          
          // Small delay between games to avoid overwhelming OpenDota API
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        // Update match metadata
        if (!dryRun) {
          await matchDoc.ref.update({
            lastReprocessed: new Date().toISOString(),
            gamesReprocessed: gamesProcessed
          });
        }
        
        results.processedMatches++;
        results.details.push({
          matchId,
          status: 'processed',
          message: `Successfully reprocessed ${gamesProcessed}/${gamesSnap.docs.length} games`,
          gamesCount: gamesProcessed,
          isManualImport: matchData.isManualImport || false
        });
        
        console.log(`Successfully reprocessed match ${matchId}: ${gamesProcessed}/${gamesSnap.docs.length} games processed`);
        
      } catch (error) {
        results.errorMatches++;
        const errorMessage = `Error processing match ${matchId}: ${(error as Error).message}`;
        results.errors.push(errorMessage);
        results.details.push({
          matchId,
          status: 'error',
          message: errorMessage,
          isManualImport: matchData.isManualImport || false
        });
        
        console.error(`Error processing match ${matchId}:`, error);
        // Continue with next match instead of failing completely
      }
    }
    
    const summary = `Reprocessing complete: ${results.processedMatches}/${results.totalMatches} matches processed, ${results.parseRequestsSent} parse requests sent, ${results.fantasyScoreUpdates} fantasy score updates, ${results.errorMatches} errors`;
    console.log(summary);
    
    return NextResponse.json({
      success: true,
      message: summary,
      results,
      dryRun
    });
    
  } catch (error) {
    console.error('Match reprocessing failed:', error);
    return NextResponse.json({
      success: false,
      message: `Match reprocessing failed: ${(error as Error).message}`,
      results: null
    }, { status: 500 });
  }
}