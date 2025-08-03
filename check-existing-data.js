// Check what player performance data already exists in the database
import { getAllMatches } from '../src/lib/firestore.js';

async function main() {
    try {
        console.log('=== Checking Existing Player Performance Data ===');
        
        const matches = await getAllMatches();
        console.log(`Found ${matches.length} total matches`);
        
        for (const match of matches) {
            console.log(`\n--- Match: ${match.id} ---`);
            console.log(`Teams: ${match.teamA?.name} vs ${match.teamB?.name}`);
            console.log(`Status: ${match.status}`);
            console.log(`Score: ${match.teamA?.score} - ${match.teamB?.score}`);
            
            if (match.playerPerformances) {
                console.log(`✅ Has player performances: ${match.playerPerformances.length} players`);
                
                // Show sample performance data
                const samplePerf = match.playerPerformances[0];
                console.log(`Sample performance:`, {
                    playerId: samplePerf.playerId,
                    teamId: samplePerf.teamId,
                    hero: samplePerf.hero,
                    kills: samplePerf.kills,
                    deaths: samplePerf.deaths,
                    assists: samplePerf.assists,
                    fantasyPoints: samplePerf.fantasyPoints
                });
                
                // Check if there are subcollections (games)
                console.log(`Game IDs: ${match.game_ids || 'none'}`);
            } else {
                console.log(`❌ No player performances in main match document`);
                
                // Check if there are game subcollections
                if (match.game_ids && match.game_ids.length > 0) {
                    console.log(`🔍 Found game IDs: ${match.game_ids.join(', ')}`);
                    console.log(`   -> Player performances might be in game subcollections`);
                }
            }
        }
        
    } catch (error) {
        console.error('Error checking match data:', error);
    }
}

main().catch(console.error);
