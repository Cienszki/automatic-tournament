#!/usr/bin/env node
/**
 * Batch Import via API
 * 
 * This script re-imports all parsed OpenDota JSON files by calling the fixed API route
 * which now uses the unified save system to ensure complete performance data.
 */

const fs = require('fs');
const path = require('path');

// Mock the NextJS environment variables and globals needed for the API
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

async function findAllParsedReplays() {
    const parsedReplaysDir = path.join(process.cwd(), 'parsed replays');
    
    if (!fs.existsSync(parsedReplaysDir)) {
        throw new Error('Parsed replays directory not found');
    }
    
    const files = fs.readdirSync(parsedReplaysDir);
    const openDotaFiles = files.filter(file => file.endsWith('_opendota.json'));
    
    console.log(`Found ${openDotaFiles.length} OpenDota JSON files:`);
    openDotaFiles.forEach(file => console.log(`  - ${file}`));
    
    return openDotaFiles.map(file => ({
        filename: file,
        matchId: file.replace('_opendota.json', ''),
        filePath: path.join(parsedReplaysDir, file)
    }));
}

const MATCH_TEAM_MAPPING = {
    '8427125277': { radiantTeam: 'ASkLQqoDGCOPsextQFsl', direTeam: 'uTtgHBN81CYiRx0yY4ip', matchId: 'o2H30RJvnYByDcM2dINB' },
    '8430102930': { radiantTeam: 'kutPIkCyWUTRi0mjLnzJ', direTeam: '17rPs1frASvF0lK8rxY2', matchId: '7VdHDXHUb0uSjOOiaD9r' },
    '8431558092': { radiantTeam: 'YPpnY5CDx9LzN3ZM0723', direTeam: 'yFVMFQqLclFVJxIb9z4D', matchId: 'sHRVKy03EAKtc77DllAr' },
    '8431678099': { radiantTeam: 'oOJjrP0iXQLe7TStAtL2', direTeam: 'c9bDJBixghg2ZubJtArw', matchId: 'WUmUm5A7K1M3hEBGW9Id' }
};

async function importSingleReplay(replayFile) {
    console.log(`\n=== IMPORTING ${replayFile.filename} ===`);
    
    const gameId = replayFile.matchId;
    const mapping = MATCH_TEAM_MAPPING[gameId];
    
    if (!mapping) {
        console.error(`No team mapping found for ${gameId}`);
        return { success: false, error: `No team mapping for ${gameId}` };
    }
    
    // Load the JSON file
    let matchData;
    try {
        const fileContent = fs.readFileSync(replayFile.filePath, 'utf8');
        matchData = JSON.parse(fileContent);
        console.log(`Loaded JSON file with match ID: ${matchData.match_id}`);
    } catch (error) {
        console.error(`Failed to load ${replayFile.filename}:`, error.message);
        return { success: false, error: `Failed to load JSON: ${error.message}` };
    }
    
    try {
        console.log(`Using team mapping: ${mapping.radiantTeam} vs ${mapping.direTeam} for match ${mapping.matchId}`);
        
        // Import the API route handler directly
        const { POST } = require('../src/app/api/import-match/route');
        
        // Create a mock request object
        const mockRequest = {
            json: async () => ({
                openDotaData: matchData,
                radiantTeam: mapping.radiantTeam,
                direTeam: mapping.direTeam,
                matchId: mapping.matchId
            })
        };
        
        console.log(`Calling import API for game ${gameId}...`);
        const response = await POST(mockRequest);
        const result = await response.json();
        
        if (response.status === 200 && result.success) {
            console.log(`✅ Successfully imported ${replayFile.filename}`);
            return { 
                success: true, 
                matchId: mapping.matchId, 
                gameId: gameId
            };
        } else {
            console.error(`❌ API returned error for ${replayFile.filename}:`, result);
            return { success: false, error: result.error || 'API call failed' };
        }
        
    } catch (error) {
        console.error(`❌ Failed to import ${replayFile.filename}:`, error.message);
        return { success: false, error: error.message };
    }
}

async function batchImportAllReplays() {
    try {
        console.log('=== BATCH IMPORT VIA API ===');
        console.log('Using fixed import-match API route with unified save system');
        
        // Find all files to import
        const replayFiles = await findAllParsedReplays();
        if (replayFiles.length === 0) {
            console.log('No OpenDota JSON files found to import');
            return;
        }
        
        // Import each file
        const results = [];
        for (const replayFile of replayFiles) {
            const result = await importSingleReplay(replayFile);
            results.push({
                filename: replayFile.filename,
                gameId: replayFile.matchId,
                ...result
            });
            
            // Small delay between imports
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        // Summary report
        console.log('\n=== IMPORT SUMMARY ===');
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);
        
        console.log(`Total files: ${results.length}`);
        console.log(`Successful: ${successful.length}`);
        console.log(`Failed: ${failed.length}`);
        
        if (successful.length > 0) {
            console.log('\n✅ Successful imports:');
            successful.forEach(result => {
                console.log(`  ${result.filename} -> Match ${result.matchId}, Game ${result.gameId}`);
            });
        }
        
        if (failed.length > 0) {
            console.log('\n❌ Failed imports:');
            failed.forEach(result => {
                console.log(`  ${result.filename}: ${result.error}`);
            });
        }
        
        console.log('\n=== VERIFICATION ===');
        if (successful.length > 0) {
            console.log('Running verification commands...');
            
            // Check Cienszki specifically (he should be in game 8430102930)
            console.log('\nChecking Cienszki player data...');
            try {
                const { debugPlayerMatches } = require('./debug-player-matches');
                await debugPlayerMatches('Cienszki');
            } catch (error) {
                console.error('Could not run player verification:', error.message);
            }
        }
        
        console.log('\n=== NEXT STEPS ===');
        console.log('1. Run CSV export to verify all player data is now present');
        console.log('2. Check that Cienszki now has 6 games instead of 5');
        console.log('3. All imported games should now have complete performance data');
        
        return results;
        
    } catch (error) {
        console.error('Batch import failed:', error);
        throw error;
    }
}

if (require.main === module) {
    batchImportAllReplays()
        .then(() => {
            console.log('Batch import completed');
            process.exit(0);
        })
        .catch(error => {
            console.error('Batch import failed:', error);
            process.exit(1);
        });
}

module.exports = { batchImportAllReplays };