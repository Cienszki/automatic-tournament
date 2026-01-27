// scripts/test-pdl-sync.ts
// Quick test script for PDL match import system

import { syncPDLMatchesAdmin, getPDLTeamsAdmin, getPDLPlayersAdmin } from '../src/lib/pdl-admin-actions';
import { getLeagueId } from '../src/lib/definitions';
import { fetchAllSteamLeagueMatches } from '../src/lib/steam-api';

const TOURNAMENT_ID = 'pdl-s1';

async function testPDLSync() {
    console.log('='.repeat(60));
    console.log('PDL Match Import System - Test Suite');
    console.log('='.repeat(60));
    console.log('');

    // Test 1: Verify League ID Configuration
    console.log('📋 Test 1: League ID Configuration');
    const leagueId = getLeagueId(TOURNAMENT_ID);
    console.log(`   Tournament: ${TOURNAMENT_ID}`);
    console.log(`   League ID: ${leagueId}`);
    console.log(`   ✅ ${leagueId === 19206 ? 'Correct!' : '❌ WRONG! Should be 19206'}`);
    console.log('');

    // Test 2: Check Steam API connectivity
    console.log('📋 Test 2: Steam API - Match Discovery');
    try {
        console.log(`   Fetching matches from Steam league ${leagueId}...`);
        const steamMatches = await fetchAllSteamLeagueMatches(leagueId);
        console.log(`   ✅ Found ${steamMatches.length} matches in Steam API`);

        if (steamMatches.length > 0) {
            const latestMatch = steamMatches[0];
            console.log(`   Latest match: ${latestMatch.match_id}`);
            console.log(`   Radiant: ${latestMatch.radiant_team_id}, Dire: ${latestMatch.dire_team_id}`);
        } else {
            console.log(`   ⚠️  No matches found - league might be empty or not started yet`);
        }
    } catch (error: any) {
        console.log(`   ❌ Steam API failed: ${error.message}`);
        console.log(`   Check: STEAM_API_KEY environment variable`);
    }
    console.log('');

    // Test 3: Check Firestore Data
    console.log('📋 Test 3: Firestore Data Structure');
    try {
        const teams = await getPDLTeamsAdmin(TOURNAMENT_ID);
        const players = await getPDLPlayersAdmin(TOURNAMENT_ID);

        console.log(`   Teams: ${teams.length}`);
        console.log(`   Players: ${players.length}`);

        if (teams.length === 0) {
            console.log(`   ⚠️  No teams found in tournaments/${TOURNAMENT_ID}/teams`);
            console.log(`   Action: Register teams in Firestore first`);
        } else {
            console.log(`   ✅ Teams loaded successfully`);

            // Check team structure
            const sampleTeam = teams[0];
            console.log(`   Sample team: "${sampleTeam.name}"`);
            console.log(`   - Has players: ${(sampleTeam.players?.length || 0) > 0 ? '✅' : '❌'}`);
            console.log(`   - Division: ${sampleTeam.divisionId || 'not set'}`);

            // Check player Steam IDs
            const playersWithSteamId = players.filter(p => p.steamId32);
            console.log(`   Players with steamId32: ${playersWithSteamId.length}/${players.length}`);

            if (playersWithSteamId.length === 0) {
                console.log(`   ❌ CRITICAL: No players have steamId32 field!`);
                console.log(`   Action: Add steamId32 to player documents`);
            } else if (playersWithSteamId.length < players.length) {
                console.log(`   ⚠️  ${players.length - playersWithSteamId.length} players missing steamId32`);
            } else {
                console.log(`   ✅ All players have steamId32`);
            }
        }
    } catch (error: any) {
        console.log(`   ❌ Firestore read failed: ${error.message}`);
        console.log(`   Check: Firebase Admin credentials`);
    }
    console.log('');

    // Test 4: Run Sync (Dry Run Analysis)
    console.log('📋 Test 4: Sync System Test');
    console.log(`   Running syncPDLMatchesAdmin("${TOURNAMENT_ID}")...`);
    console.log('');

    try {
        const result = await syncPDLMatchesAdmin(TOURNAMENT_ID);

        console.log('   Sync Result:');
        console.log(`   - Success: ${result.success ? '✅' : '❌'}`);
        console.log(`   - Message: ${result.message}`);
        console.log(`   - Imported: ${result.importedCount}`);
        console.log(`   - Skipped: ${result.skippedCount || 0}`);
        console.log(`   - Unparsed: ${result.unparsedCount || 0}`);
        console.log(`   - Failed: ${result.failedCount || 0}`);

        if (result.success && result.importedCount > 0) {
            console.log('');
            console.log('   🎉 SUCCESS! Matches were imported!');
        } else if (result.success && result.importedCount === 0) {
            console.log('');
            console.log('   ℹ️  No new matches to import (database up to date)');
        }
    } catch (error: any) {
        console.log(`   ❌ Sync failed: ${error.message}`);
        console.log(`   ${error.stack}`);
    }
    console.log('');

    console.log('='.repeat(60));
    console.log('Test Complete');
    console.log('='.repeat(60));
}

// Run the test
testPDLSync()
    .then(() => {
        console.log('\n✅ Test script completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Test script failed:', error);
        process.exit(1);
    });
