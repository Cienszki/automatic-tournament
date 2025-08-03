// Script to manually update team statistics
const { updateAllTeamStatistics } = require('../src/lib/firestore');

async function main() {
    console.log('Starting team statistics update...');
    try {
        await updateAllTeamStatistics();
        console.log('Team statistics update completed successfully!');
    } catch (error) {
        console.error('Error updating team statistics:', error);
        process.exit(1);
    }
}

main();
