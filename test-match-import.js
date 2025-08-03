// Quick test to import the sample match data
// This will import match 8394752388 and map it to one of our existing matches

import { importMatchFromOpenDota } from '../src/lib/actions.js';

async function main() {
    try {
        console.log('Importing sample match 8394752388...');
        
        // Import the match using the existing tournament match ID  
        // Let's map it to the completed match we saw in logs: EylGWEZmv6X10xz9tM2M
        const result = await importMatchFromOpenDota(8394752388, 'EylGWEZmv6X10xz9tM2M');
        
        console.log('Import result:', result);
        
        if (result.success) {
            console.log('✅ Match imported successfully!');
            console.log('Now updating team statistics...');
            
            // Call our team stats update API
            const response = await fetch('http://localhost:3000/api/admin/update-team-stats', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            const statsResult = await response.json();
            console.log('Stats update result:', statsResult);
        } else {
            console.log('❌ Match import failed:', result.message);
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
}

main().catch(console.error);
