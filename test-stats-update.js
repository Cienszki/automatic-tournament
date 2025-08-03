// Test script to check database state and update team stats
import { getAllMatches, getAllTeams, updateAllTeamStatistics } from '../src/lib/firestore.js';

async function main() {
    try {
        console.log('=== Checking Database State ===');
        
        // Get all teams
        const teams = await getAllTeams();
        console.log(`Found ${teams.length} teams`);
        
        // Get all matches
        const matches = await getAllMatches();
        console.log(`Found ${matches.length} total matches`);
        
        // Check completed matches
        const completedMatches = matches.filter(m => m.status === 'completed');
        console.log(`Found ${completedMatches.length} completed matches`);
        
        if (completedMatches.length > 0) {
            console.log('\n=== Sample Completed Match ===');
            const sampleMatch = completedMatches[0];
            console.log('Match ID:', sampleMatch.id);
            console.log('Teams:', sampleMatch.teamA?.name, 'vs', sampleMatch.teamB?.name);
            console.log('Score:', sampleMatch.teamA?.score, '-', sampleMatch.teamB?.score);
            console.log('Status:', sampleMatch.status);
            console.log('Has player performances:', !!sampleMatch.playerPerformances);
            if (sampleMatch.playerPerformances) {
                console.log('Player performances count:', sampleMatch.playerPerformances.length);
                console.log('Sample performance:', sampleMatch.playerPerformances[0]);
            }
        }
        
        console.log('\n=== Updating Team Statistics ===');
        await updateAllTeamStatistics();
        console.log('Team statistics update completed!');
        
    } catch (error) {
        console.error('Error:', error);
    }
}

main().catch(console.error);
