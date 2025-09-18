import { NextRequest, NextResponse } from 'next/server';
import { ensureAdminInitialized, getAdminDb } from '../../../../server/lib/admin';
import { fetchOpenDotaMatch, transformMatchData } from '../../../../lib/opendota';
import { markGameAsProcessedAdmin } from '../../../../lib/processed-games-admin';

/**
 * Force import matches even if they're unparsed - uses basic WebAPI data
 */
export async function POST(request: NextRequest) {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();
    
    const body = await request.json();
    const { matchIds = [] } = body;
    
    if (!Array.isArray(matchIds) || matchIds.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'matchIds array is required'
      }, { status: 400 });
    }
    
    console.log(`🔄 Force importing ${matchIds.length} matches (including unparsed)...`);
    
    // Load teams and players for match transformation
    const { getAllTeamsAdmin, getAllTournamentPlayersAdmin } = await import('../../../../lib/admin-actions');
    const [teams, players] = await Promise.all([
      getAllTeamsAdmin(),
      getAllTournamentPlayersAdmin(),
    ]);
    
    const results: Array<{
      matchId: string;
      status: 'imported' | 'skipped' | 'error';
      message: string;
      radiantTeam?: string;
      direTeam?: string;
      isParsed?: boolean;
    }> = [];
    
    for (const matchId of matchIds) {
      console.log(`🎮 Force importing match ${matchId}...`);
      
      try {
        // Fetch match from OpenDota
        const openDotaMatch = await fetchOpenDotaMatch(parseInt(matchId));
        const { isMatchParsed, requestOpenDotaMatchParse } = await import('../../../../lib/opendota');
        const isParsed = isMatchParsed(openDotaMatch);
        
        console.log(`Match ${matchId} - Parsed: ${isParsed}, RadiantTeam: "${openDotaMatch.radiant_name}", DireTeam: "${openDotaMatch.dire_name}"`);
        
        // If not parsed, request parsing from OpenDota
        if (!isParsed) {
          console.log(`Match ${matchId} is unparsed, requesting parse from OpenDota...`);
          try {
            const parseResult = await requestOpenDotaMatchParse(parseInt(matchId));
            if (parseResult.success) {
              console.log(`✅ Parse request successful for match ${matchId}: ${parseResult.message || 'Queued for parsing'}`);
            } else {
              console.log(`⚠️ Parse request failed for match ${matchId}: ${parseResult.message}`);
            }
          } catch (parseError) {
            console.log(`❌ Parse request error for match ${matchId}: ${(parseError as Error).message}`);
          }
        }
        
        // Transform match data (handles both parsed and unparsed)
        const { game, performances } = transformMatchData(openDotaMatch, teams as any[], players as any[], false);
        
        // Find teams by name matching
        const radiantTeam = teams.find((t: any) => 
          t.name.trim().toLowerCase() === openDotaMatch.radiant_name?.trim().toLowerCase()
        );
        const direTeam = teams.find((t: any) => 
          t.name.trim().toLowerCase() === openDotaMatch.dire_name?.trim().toLowerCase()
        );
        
        if (radiantTeam && direTeam) {
          // Find existing match between these teams
          const { getAllMatchesAdmin } = await import('../../../../lib/admin-actions');
          const allMatches = await getAllMatchesAdmin();
          
          const existingMatch = allMatches.find(match => 
            (match.teams.includes(radiantTeam.id) && match.teams.includes(direTeam.id))
          );
          
          if (existingMatch) {
            // Save to existing tournament match
            const { saveGameResultsUnifiedSafe } = await import('../../../../lib/unified-game-save');
            const saveResult = await saveGameResultsUnifiedSafe(existingMatch.id, game, performances, {
              logPrefix: '[ForceImport]'
            });
            
            if (saveResult.success) {
              // Mark as processed
              await markGameAsProcessedAdmin(matchId);
              
              results.push({
                matchId,
                status: 'imported',
                message: `Successfully imported to existing match ${existingMatch.id}`,
                radiantTeam: radiantTeam.name,
                direTeam: direTeam.name,
                isParsed
              });
              
              console.log(`✅ Successfully imported game ${matchId} to match ${existingMatch.id} (${radiantTeam.name} vs ${direTeam.name})`);
            } else {
              results.push({
                matchId,
                status: 'skipped',
                message: `Game skipped: ${saveResult.errors?.join(', ') || 'validation failed'}`,
                radiantTeam: radiantTeam.name,
                direTeam: direTeam.name,
                isParsed
              });
              
              console.log(`⏭️ Skipped game ${matchId}: ${saveResult.errors?.[0] || 'validation failed'}`);
            }
          } else {
            // Create external match (fallback)
            const { saveExternalGameResultsAdmin } = await import('../../../../lib/admin-actions');
            await saveExternalGameResultsAdmin(matchId, game, performances, { radiantTeam, direTeam });
            await markGameAsProcessedAdmin(matchId);
            
            results.push({
              matchId,
              status: 'imported',
              message: `Created new external match`,
              radiantTeam: radiantTeam.name,
              direTeam: direTeam.name,
              isParsed
            });
            
            console.log(`✅ Created external match ${matchId} for ${radiantTeam.name} vs ${direTeam.name}`);
          }
        } else {
          results.push({
            matchId,
            status: 'error',
            message: `Team matching failed - Radiant: "${openDotaMatch.radiant_name}" (${radiantTeam ? 'found' : 'not found'}), Dire: "${openDotaMatch.dire_name}" (${direTeam ? 'found' : 'not found'})`,
            isParsed
          });
          
          console.log(`❌ Team matching failed for ${matchId}`);
        }
        
      } catch (error: any) {
        results.push({
          matchId,
          status: 'error',
          message: `Import failed: ${error.message}`,
        });
        
        console.error(`❌ Error importing match ${matchId}:`, error);
      }
    }
    
    const importedCount = results.filter(r => r.status === 'imported').length;
    const skippedCount = results.filter(r => r.status === 'skipped').length;
    const errorCount = results.filter(r => r.status === 'error').length;
    
    const summary = `Force import complete: ${importedCount} imported, ${skippedCount} skipped, ${errorCount} errors`;
    
    console.log(`🎉 ${summary}`);
    
    return NextResponse.json({
      success: true,
      message: summary,
      results,
      summary: {
        total: matchIds.length,
        imported: importedCount,
        skipped: skippedCount,
        errors: errorCount
      }
    });
    
  } catch (error: any) {
    console.error('❌ Force import failed:', error);
    return NextResponse.json({
      success: false,
      message: `Force import failed: ${error.message}`,
      results: []
    }, { status: 500 });
  }
}