// scripts/test-match-import-simple.ts
// Simple test using Steam/OpenDota APIs directly without server imports

import { fetchAllSteamLeagueMatches } from '../src/lib/steam-api';
import { fetchOpenDotaMatch, isMatchParsed } from '../src/lib/opendota';
import { getLeagueId } from '../src/lib/definitions';

async function testMatchImportAPIs() {
    console.log('='.repeat(60));
    console.log('Match Import System - API Connectivity Test');
    console.log('='.repeat(60));
    console.log('');

    // Test 1: League ID Configuration
    console.log('📋 Test 1: League ID Configuration');
    const letniaLeagueId = getLeagueId('letnia');
    const pdlLeagueId = getLeagueId('pdl');
    console.log(`   Letnia League ID: ${letniaLeagueId} ${letniaLeagueId === 18559 ? '✅' : '❌'}`);
    console.log(`   PDL League ID: ${pdlLeagueId} ${pdlLeagueId === 19206 ? '✅' : '❌'}`);
    console.log('');

    // Test 2: Steam API - Test with Letnia (known to have matches)
    console.log('📋 Test 2: Steam API - Letnia League (Proof of Concept)');
    try {
        console.log(`   Fetching matches from Letnia league ${letniaLeagueId}...`);
        const letniaMatches = await fetchAllSteamLeagueMatches(letniaLeagueId);
        console.log(`   ✅ Found ${letniaMatches.length} Letnia matches`);

        if (letniaMatches.length > 0) {
            const sample = letniaMatches[0];
            console.log(`   Sample: Match ${sample.match_id}`);
            console.log(`   - Radiant Team: ${sample.radiant_team_id}`);
            console.log(`   - Dire Team: ${sample.dire_team_id}`);
            console.log(`   - Start Time: ${new Date(sample.start_time * 1000).toISOString()}`);
        }
    } catch (error: any) {
        console.log(`   ❌ Failed: ${error.message}`);
        if (error.message.includes('STEAM_API_KEY')) {
            console.log(`   Action: Set STEAM_API_KEY in .env.local`);
        }
    }
    console.log('');

    // Test 3: Steam API - PDL League
    console.log('📋 Test 3: Steam API - PDL League');
    try {
        console.log(`   Fetching matches from PDL league ${pdlLeagueId}...`);
        const pdlMatches = await fetchAllSteamLeagueMatches(pdlLeagueId);
        console.log(`   Found ${pdlMatches.length} PDL matches`);

        if (pdlMatches.length === 0) {
            console.log(`   ℹ️  League is empty - no matches played yet`);
            console.log(`   This is expected if PDL hasn't started`);
        } else {
            console.log(`   ✅ PDL has ${pdlMatches.length} matches!`);
            const sample = pdlMatches[0];
            console.log(`   Latest: Match ${sample.match_id}`);
        }
    } catch (error: any) {
        console.log(`   ❌ Failed: ${error.message}`);
    }
    console.log('');

    // Test 4: OpenDota API - Fetch a known Letnia match
    console.log('📋 Test 4: OpenDota API - Fetch Match Data');
    try {
        const letniaMatches = await fetchAllSteamLeagueMatches(letniaLeagueId);
        if (letniaMatches.length > 0) {
            const testMatchId = letniaMatches[0].match_id;
            console.log(`   Fetching match ${testMatchId} from OpenDota...`);

            const matchData = await fetchOpenDotaMatch(testMatchId);
            const isParsed = isMatchParsed(matchData);

            console.log(`   ✅ Match fetched successfully`);
            console.log(`   - Parsed: ${isParsed ? '✅ Yes' : '⚠️  No (basic data only)'}`);
            console.log(`   - Duration: ${Math.floor(matchData.duration / 60)} minutes`);
            console.log(`   - Radiant Win: ${matchData.radiant_win ? 'Yes' : 'No'}`);
            console.log(`   - Players: ${matchData.players?.length || 0}`);

            if (isParsed) {
                const samplePlayer = matchData.players[0];
                console.log(`   Sample Player Stats:`);
                console.log(`     - K/D/A: ${samplePlayer.kills}/${samplePlayer.deaths}/${samplePlayer.assists}`);
                console.log(`     - GPM: ${samplePlayer.gold_per_min}`);
                console.log(`     - Wards: ${samplePlayer.obs_placed || 0} obs, ${samplePlayer.sen_placed || 0} sen`);
            } else {
                console.log(`   ⚠️  Match not fully parsed - missing advanced stats`);
            }
        } else {
            console.log(`   ⚠️  No Letnia matches to test with`);
        }
    } catch (error: any) {
        console.log(`   ❌ Failed: ${error.message}`);
    }
    console.log('');

    // Summary
    console.log('='.repeat(60));
    console.log('Test Summary');
    console.log('='.repeat(60));
    console.log('');
    console.log('✅ If Tests 1-4 passed:');
    console.log('   → API connectivity is working');
    console.log('   → System can discover and fetch matches');
    console.log('   → Ready to test full import when PDL has matches');
    console.log('');
    console.log('📝 Next Steps:');
    console.log('   1. Play a test match in PDL league (ID: 19206)');
    console.log('   2. Wait 10-30 min for OpenDota to parse it');
    console.log('   3. Register teams in Firestore (tournaments/pdl-s1/teams)');
    console.log('   4. Run the full sync via API endpoint');
    console.log('');
}

testMatchImportAPIs()
    .then(() => {
        console.log('✅ Test completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Test failed:', error);
        process.exit(1);
    });
