// Debug script to check and reinitialize playoff data
const admin = require('firebase-admin');
require('dotenv').config();

// Initialize Firebase Admin (using environment variable for service account)
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString());
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id
  });
}

const db = admin.firestore();

async function debugAndReinitialize() {
  try {
    console.log('Checking current playoff data...');
    
    const doc = await db.collection('playoffs').doc('main-playoffs').get();
    
    if (doc.exists) {
      const data = doc.data();
      console.log('✅ Playoff data exists');
      console.log('Number of brackets:', data.brackets?.length || 0);
      
      if (data.brackets) {
        data.brackets.forEach((bracket, index) => {
          console.log(`\nBracket ${index + 1}: ${bracket.name} (${bracket.type})`);
          console.log(`  Slots: ${bracket.slots?.length || 0}`);
          console.log(`  Matches: ${bracket.matches?.length || 0}`);
          
          if (bracket.type === 'lower') {
            console.log('  Lower bracket matches:');
            if (bracket.matches && bracket.matches.length > 0) {
              bracket.matches.forEach(match => {
                console.log(`    - ${match.id}: Round ${match.round}, Position ${match.position}, Format: ${match.format}`);
              });
            } else {
              console.log('    ❌ NO MATCHES FOUND');
            }
          }
        });
      }
      
      // Delete existing data to force re-initialization
      console.log('\n🗑️ Deleting existing playoff data to force re-initialization...');
      await db.collection('playoffs').doc('main-playoffs').delete();
      console.log('✅ Deleted successfully');
      
    } else {
      console.log('❌ No playoff data found');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  process.exit(0);
}

debugAndReinitialize();
