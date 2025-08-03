// Check the structure of player performance data to understand missing fields
import { ensureAdminInitialized, getAdminDb } from '../server/lib/admin.js';

async function main() {
    try {
        ensureAdminInitialized();
        const db = getAdminDb();
        
        console.log('=== Checking Player Performance Structure ===');
        
        // Get a sample performance record
        const matchId = 'EylGWEZmv6X10xz9tM2M';
        const gameId = '8011946478';
        
        const performancesSnapshot = await db
            .collection('matches')
            .doc(matchId)
            .collection('games')
            .doc(gameId)
            .collection('performances')
            .limit(1)
            .get();
        
        if (!performancesSnapshot.empty) {
            const samplePerf = performancesSnapshot.docs[0].data();
            console.log('Sample performance data:');
            console.log(JSON.stringify(samplePerf, null, 2));
            
            // Check if fantasy points field exists but is named differently
            console.log('\nAvailable fields:');
            Object.keys(samplePerf).forEach(key => {
                console.log(`- ${key}: ${samplePerf[key]}`);
            });
        } else {
            console.log('No performance data found');
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
}

main().catch(console.error);
