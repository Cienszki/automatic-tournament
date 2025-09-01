const admin = require('firebase-admin');

// Try to get existing app or error silently
let app;
try {
  app = admin.app();
} catch (error) {
  // If no app exists, we'll need to initialize but skip it for now
  console.log('Firebase admin not initialized in existing context');
  process.exit(1);
}

const db = admin.firestore();

async function checkPerformanceFields() {
  try {
    console.log('Checking performance document structure...');
    
    // Get a few sample performance documents directly
    const performancesSnapshot = await db.collection('performances').limit(5).get();
    
    console.log(`Found ${performancesSnapshot.docs.length} performance documents`);
    
    performancesSnapshot.docs.forEach((perfDoc, index) => {
      const perf = perfDoc.data();
      console.log(`\nPerformance ${index + 1} (${perfDoc.id}):`);
      console.log(`  - All fields: ${Object.keys(perf).join(', ')}`);
      console.log(`  - Hero ID: ${perf.heroId}`);
      console.log(`  - Player ID: ${perf.playerId}`);
      console.log(`  - Team ID: ${perf.teamId}`);
      console.log(`  - Has 'role' field: ${perf.role !== undefined ? perf.role : 'NO'}`);
      console.log(`  - Has 'position' field: ${perf.position !== undefined ? perf.position : 'NO'}`);
      console.log(`  - Has 'playerSlot' field: ${perf.playerSlot !== undefined ? perf.playerSlot : 'NO'}`);
      console.log(`  - Has 'lane' field: ${perf.lane !== undefined ? perf.lane : 'NO'}`);
      console.log(`  - Has 'laneRole' field: ${perf.laneRole !== undefined ? perf.laneRole : 'NO'}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

checkPerformanceFields();
