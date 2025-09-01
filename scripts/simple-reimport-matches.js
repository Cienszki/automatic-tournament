#!/usr/bin/env node
/**
 * Simple Re-import Matches
 * 
 * This script re-imports the specific match IDs from parsed replays
 * using the existing manual match ID import system which already uses
 * the unified save function.
 */

require('dotenv').config({ path: __dirname + '/../.env.local' });
const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    try {
        admin.initializeApp({
            credential: admin.credential.applicationDefault(),
            projectId: 'tournament-tracker-f35tb'
        });
        console.log('Using application default credentials');
    } catch (error) {
        console.error('Failed to initialize Firebase Admin:', error.message);
        process.exit(1);
    }
} else {
    const serviceAccount = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf-8'));
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log('Using service account from environment variable');
}

async function reimportParsedMatches() {
    try {
        console.log('=== RE-IMPORTING PARSED MATCHES ===');
        console.log('Using existing manual match ID import system with unified save function');
        
        // These are the match IDs from our parsed replay files
        const matchIds = [
            8427125277, // CINCO PERROS vs gwiazda
            8430102930, // Ja w sprawie pumy vs Meld z Zaskoczenia (Cienszki's missing game!)
            8431558092, // Skorupiaki vs Dicaprio
            8431678099  // Bubliny Team vs Na Pałę Gaming
        ];
        
        console.log(`Re-importing ${matchIds.length} matches:`);
        matchIds.forEach(id => console.log(`  - ${id}`));
        
        // Use the existing manual import function
        const { importManualMatchesAdmin } = require('../src/lib/admin-actions');
        
        console.log('\nStarting import process...');
        const result = await importManualMatchesAdmin(matchIds);
        
        console.log('\n=== IMPORT RESULTS ===');
        console.log(`Success: ${result.success}`);
        console.log(`Message: ${result.message}`);
        console.log(`Imported: ${result.importedCount || 0}`);
        console.log(`Already processed: ${result.alreadyProcessedCount || 0}`);
        console.log(`Skipped: ${result.skippedCount || 0}`);
        console.log(`Failed: ${result.failedCount || 0}`);
        
        if (result.success) {
            console.log('\n✅ Re-import completed successfully!');
            console.log('\n=== VERIFICATION ===');
            console.log('Now checking if Cienszki has complete data...');
            
            // Check if Cienszki now has the missing game
            setTimeout(async () => {
                try {
                    console.log('\nRunning player verification...');
                    const { debugPlayerMatches } = require('./debug-player-matches');
                    await debugPlayerMatches('Cienszki');
                    
                    console.log('\n=== FINAL STEPS ===');
                    console.log('1. Run: node scripts/export-fantasy-unified-csv.js');
                    console.log('2. Check if Cienszki now has 6 games instead of 5');
                    console.log('3. Verify all performance data is complete');
                } catch (verifyError) {
                    console.error('Verification error:', verifyError.message);
                }
            }, 2000);
        } else {
            console.error('❌ Import failed:', result.message);
        }
        
        return result;
        
    } catch (error) {
        console.error('Re-import script failed:', error);
        throw error;
    }
}

if (require.main === module) {
    reimportParsedMatches()
        .then(() => {
            console.log('Script completed');
        })
        .catch(error => {
            console.error('Script failed:', error);
            process.exit(1);
        });
}

module.exports = { reimportParsedMatches };