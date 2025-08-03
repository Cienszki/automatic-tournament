// Test importing match data to populate team statistics
// POST request to import OpenDota match 8394752388 and map it to our match EylGWEZmv6X10xz9tM2M

const url = 'http://localhost:3000/api/admin/import-match-test';
const data = {
    openDotaMatchId: 8394752388,
    ourMatchId: 'EylGWEZmv6X10xz9tM2M'
};

fetch(url, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
})
.then(response => response.json())
.then(result => {
    console.log('Import result:', result);
    
    if (result.success) {
        console.log('✅ Match imported successfully!');
        // Now update team statistics
        return fetch('http://localhost:3000/api/admin/update-team-stats', { method: 'POST' });
    } else {
        throw new Error(result.message || 'Import failed');
    }
})
.then(response => response.json())
.then(statsResult => {
    console.log('✅ Team statistics updated:', statsResult);
})
.catch(error => {
    console.error('❌ Error:', error);
});
